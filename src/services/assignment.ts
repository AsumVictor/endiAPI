// Assignment service
import { supabase } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { azureServiceBusProducer, type QuestionGenerationJobRequest } from './azure-service-bus-producer.js';
import type {
  CreateAssignmentRequest,
  AssignmentResponse,
  StudentAssignmentView,
  AssignmentTimeStatus
} from '../models/assignment.js';

export class AssignmentService {
  /**
   * Create a new assignment
   */
  static async createAssignment(data: CreateAssignmentRequest, userId: string): Promise<AssignmentResponse> {
    try {
      // First, get the lecturer record for this user
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found. Please complete your lecturer profile first.', 404);
      }

      // Verify the lecturer owns this course
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', data.course_id)
        .single();

      if (courseError || !course) {
        throw new AppError('Course not found', 404);
      }

      if (course.lecturer_id !== lecturer.id) {
        throw new AppError('You can only create assignments for your own courses', 403);
      }

      // Calculate total_types from question_types and code_programs
      const questionTypesCount = data.question_types ? Object.keys(data.question_types).length : 0;
      const codeProgramsCount = data.code_programs ? data.code_programs.length : 0;
      const totalTypes = questionTypesCount + codeProgramsCount;

      // Create assignment
      const assignmentData = {
        id: crypto.randomUUID(),
        course_id: data.course_id,
        lecturer_id: lecturer.id,
        title: data.title,
        description: data.description || null,
        start_time: data.start_time || null,
        duration_minutes: data.duration || null,
        deadline: data.deadline ?? null,
        ai_allowed: data.is_ai_allowed || false,
        status: 'draft' as const,
        total_types: totalTypes,
        generated_types: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .insert([assignmentData])
        .select()
        .single();

      if (assignmentError) {
        throw new AppError(`Failed to create assignment: ${assignmentError.message}`, 400);
      }

      // Create assignment resources if provided
      if (data.resources && data.resources.length > 0) {
        const resourcesData = data.resources.map(resource => ({
          id: crypto.randomUUID(),
          assignment_id: assignment.id,
          resource_type: resource.type,
          url: resource.url,
          description: resource.description || null,
          created_at: new Date().toISOString(),
        }));

        const { error: resourcesError } = await supabase
          .from('assignment_resources')
          .insert(resourcesData)
          .select();

        if (resourcesError) {
          // Log error but don't fail the entire operation
          logger.error('Failed to create assignment resources:', resourcesError);
          throw new AppError(`Failed to create assignment resources: ${resourcesError.message}`, 400);
        }

      }

      // Send question generation job to Azure Service Bus if we have question data
      if (data.total_questions && (data.question_types || data.code_programs)) {
        try {
          // Transform question_types from percentages to actual numbers and ranges
          const totalQuestions = data.total_questions;
          const questionTypesArray: Array<{ type: string; count: number; range: { start: number; end: number } }> = [];
          let currentOrder = 1;

          // Process question_types (percentages -> actual numbers and ranges)
          if (data.question_types) {
            for (const [type, percentage] of Object.entries(data.question_types)) {


              const count = Math.round((percentage / 100) * totalQuestions);
              if (count > 0) {
                questionTypesArray.push({
                  type: type,
                  count,
                  range: {
                    start: currentOrder,
                    end: currentOrder + count - 1,
                  },
                });
                currentOrder += count;
              }
            }
          }

          // Send job to Azure Service Bus
          const jobRequest: QuestionGenerationJobRequest = {
            assignment_id: assignment.id,
            total_questions: totalQuestions,
            question_types: questionTypesArray,
            ...(data.code_programs && { code_programs: data.code_programs }),
            ...(data.prompt && { prompt: data.prompt }),
            ...(data.files && { files: data.files }),
          };

          await azureServiceBusProducer.sendQuestionGenerationJob(jobRequest);

          logger.info('Question generation job sent for assignment', {
            assignment_id: assignment.id,
            total_questions: totalQuestions,
          });
        } catch (error) {
          // Log error but don't fail the assignment creation
          logger.error('Failed to send question generation job', {
            assignment_id: assignment.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        message: 'Assignment created successfully',
        data: assignment,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create assignment', 500);
    }
  }

  /**
   * Get assignment details for a student (includes timing status + existing session id)
   */
  static async getAssignmentForStudent(assignmentId: string, userId: string): Promise<{ success: boolean; message: string; data: StudentAssignmentView }> {
    // Get student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (studentError || !student) {
      throw new AppError('Student profile not found', 404);
    }

    // Load assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, course_id, status, start_time, duration_minutes, deadline')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      throw new AppError('Assignment not found', 404);
    }

    // Students can view published/graded assignments
    if (assignment.status !== 'published' && assignment.status !== 'graded') {
      throw new AppError('Assignment is not published yet', 403);
    }

    // Ensure student is enrolled in the course
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', assignment.course_id)
      .eq('student_id', student.id)
      .limit(1);

    if (enrollmentError) {
      throw new AppError(`Failed to verify enrollment: ${enrollmentError.message}`, 400);
    }
    if (!enrollment || enrollment.length === 0) {
      throw new AppError('You are not enrolled in this course', 403);
    }

    // Fetch course title
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('title')
      .eq('id', assignment.course_id)
      .single();

    if (courseError || !course) {
      throw new AppError('Course not found', 404);
    }

    // Compute timing status
    const now = new Date();
    let timeStatus: AssignmentTimeStatus = 'started';

    if (assignment.start_time) {
      const startTime = new Date(assignment.start_time);
      if (startTime > now) {
        timeStatus = 'not_started';
      } else {
        // Ended only when deadline passes (if set); if no deadline then only when graded
        const deadlineValue = (assignment as any).deadline as string | null | undefined;
        if (deadlineValue) {
          const deadlineDate = new Date(deadlineValue);
          timeStatus = now > deadlineDate ? 'ended' : 'started';
        } else {
          timeStatus = assignment.status === 'graded' ? 'ended' : 'started';
        }
      }
    } else {
      // No start_time means available immediately
      const deadlineValue = (assignment as any).deadline as string | null | undefined;
      if (deadlineValue) {
        const deadlineDate = new Date(deadlineValue);
        timeStatus = now > deadlineDate ? 'ended' : 'started';
      } else {
        timeStatus = assignment.status === 'graded' ? 'ended' : 'started';
      }
    }

    // Load existing session id (if any)
    const { data: sessions, error: sessionError } = await supabase
      .from('student_assignment_sessions')
      .select('id')
      .eq('student_id', student.id)
      .eq('assignment_id', assignmentId)
      .limit(1);

    if (sessionError) {
      throw new AppError(`Failed to check student session: ${sessionError.message}`, 400);
    }

    const sessionId = sessions && sessions.length > 0 ? (sessions as any)[0]?.id ?? null : null;

    return {
      success: true,
      message: 'Assignment retrieved successfully',
      data: {
        assignment_id: assignment.id,
        title: assignment.title,
        course_title: course.title,
        time_status: timeStatus,
        start_time: assignment.start_time,
        duration_minutes: assignment.duration_minutes,
        session_id: sessionId,
      },
    };
  }
}
