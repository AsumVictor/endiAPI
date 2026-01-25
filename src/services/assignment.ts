// Assignment service
import { supabase } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { azureServiceBusProducer, type QuestionGenerationJobRequest } from './azure-service-bus-producer.js';
import type {
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
  AssignmentResponse,
  StudentAssignmentView,
  StudentAssignmentsListResponse,
  StudentAssignmentDetailsResponse,
  AssignmentTimeStatus,
  LecturerAssignmentsListResponse,
  AssignmentDetailsResponse,
  AssignmentDetails,
  SubmissionsListResponse,
  QuestionsListResponse
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
        type: data.type ?? 'EXERCISE',
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

  /**
   * Get all assignments for a lecturer with filtering and pagination
   */
  static async getLecturerAssignments(
    userId: string,
    filters: {
      course_id?: string;
      type?: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
      status?: 'draft' | 'processing' | 'ready_for_review' | 'published' | 'graded';
      time_status?: 'ongoing' | 'ended';
      deadline_before?: string;
      deadline_after?: string;
      search?: string; // search in title
    },
    pagination: {
      page: number;
      limit: number;
    }
  ): Promise<LecturerAssignmentsListResponse> {
    try {
      // Get lecturer record
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Build query with join to courses
      let query = supabase
        .from('assignments')
        .select(`
          id,
          title,
          type,
          deadline,
          status,
          created_at,
          updated_at,
          course_id,
          courses!assignments_course_id_fkey(title)
        `, { count: 'exact' })
        .eq('lecturer_id', lecturer.id);

      // Removed unused variable

      // Apply filters
      if (filters.course_id) {
        query = query.eq('course_id', filters.course_id);
      }

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.deadline_before) {
        query = query.lte('deadline', filters.deadline_before);
      }

      if (filters.deadline_after) {
        query = query.gte('deadline', filters.deadline_after);
      }

      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      // Apply time_status filter in query when possible
      if (filters.time_status === 'ended') {
        // Ended: deadline < now OR (deadline IS NULL AND status = 'graded')
        // We'll handle this after fetching since Supabase doesn't easily support complex OR
      } else if (filters.time_status === 'ongoing') {
        // Ongoing: deadline >= now OR (deadline IS NULL AND status != 'graded')
        // We'll handle this after fetching
      }

      // Order by created_at descending (newest first)
      query = query.order('created_at', { ascending: false });

      // Fetch all matching records (we'll filter by time_status after)
      const { data: assignments, error: assignmentsError } = await query;

      if (assignmentsError) {
        throw new AppError(`Failed to fetch assignments: ${assignmentsError.message}`, 400);
      }

      // Transform and calculate time_status, then apply time_status filter
      let transformedAssignments = (assignments || []).map((assignment: any) => {
        let timeStatus: 'ongoing' | 'ended' = 'ongoing';

        // Calculate time_status based on deadline and status
        if (assignment.deadline) {
          const deadlineDate = new Date(assignment.deadline);
          timeStatus = deadlineDate < new Date() ? 'ended' : 'ongoing';
        } else {
          // No deadline: ended only if status is graded
          timeStatus = assignment.status === 'graded' ? 'ended' : 'ongoing';
        }

        // Handle courses data structure (could be object or array)
        const courseData = assignment.courses;
        const courseTitle = Array.isArray(courseData) 
          ? (courseData[0]?.title || 'Unknown Course')
          : (courseData?.title || 'Unknown Course');

        return {
          id: assignment.id,
          title: assignment.title,
          type: assignment.type,
          course_name: courseTitle,
          course_id: assignment.course_id,
          deadline: assignment.deadline,
          status: assignment.status,
          time_status: timeStatus,
          created_at: assignment.created_at,
          updated_at: assignment.updated_at,
        };
      });

      // Apply time_status filter if provided
      if (filters.time_status) {
        transformedAssignments = transformedAssignments.filter(
          (item) => item.time_status === filters.time_status
        );
      }

      // Apply pagination after filtering
      const total = transformedAssignments.length;
      const totalPages = Math.ceil(total / pagination.limit);
      const offset = (pagination.page - 1) * pagination.limit;
      const paginatedAssignments = transformedAssignments.slice(offset, offset + pagination.limit);

      return {
        success: true,
        message: 'Assignments retrieved successfully',
        data: {
          assignments: paginatedAssignments,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            total_pages: totalPages,
          },
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch assignments', 500);
    }
  }

  /**
   * Get detailed assignment information for lecturer (with statistics)
   */
  static async getAssignmentDetails(assignmentId: string, userId: string): Promise<AssignmentDetailsResponse> {
    try {
      // Get lecturer record
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Fetch assignment with course info
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          *,
          courses!assignments_course_id_fkey(
            id,
            title,
            description
          )
        `)
        .eq('id', assignmentId)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      // Verify lecturer owns this assignment
      if (assignment.lecturer_id !== lecturer.id) {
        throw new AppError('You can only view your own assignments', 403);
      }

      // Handle different statuses
      if (assignment.status === 'processing') {
        // Return minimal data for processing status
        return {
          success: true,
          message: 'Assignment is being processed',
          data: {
            id: assignment.id,
            title: assignment.title,
            status: assignment.status,
            generated_types: assignment.generated_types,
            total_types: assignment.total_types,
          } as any,
        };
      }

      // Fetch resources (only for ready_for_review, published, graded)
      const shouldFetchFullData = ['ready_for_review', 'published', 'graded'].includes(assignment.status);
      let resources: any[] = [];
      if (shouldFetchFullData) {
        const { data: resourcesData, error: resourcesError } = await supabase
          .from('assignment_resources')
          .select('*')
          .eq('assignment_id', assignmentId)
          .order('created_at', { ascending: true });

        if (resourcesError) {
          logger.error('Failed to fetch assignment resources:', resourcesError);
        } else {
          resources = resourcesData || [];
        }
      }

      // Get course info
      const courseData = Array.isArray(assignment.courses)
        ? assignment.courses[0]
        : assignment.courses;
      const courseName = courseData?.title || 'Unknown Course';
      const courseDescription = courseData?.description || null;

      // Count enrolled students in the course
      const { count: enrolledCount, error: enrolledError } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', assignment.course_id);

      if (enrolledError) {
        logger.error('Failed to count enrolled students:', enrolledError);
      }

      const totalEnrolled = enrolledCount || 0;

      // Count questions for ready_for_review, published, and graded assignments
      // (questions are generated by the time status is ready_for_review)
      let totalQuestions = 0;
      let questionsByType = { MCQ: 0, FILLIN: 0, ESSAY: 0, CODE: 0 };
      
      if (shouldFetchFullData) {
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('type')
          .eq('assignment_id', assignmentId);

        if (questionsError) {
          logger.error('Failed to fetch questions:', questionsError);
        } else {
          const questionsList = questions || [];
          totalQuestions = questionsList.length;
          questionsByType = {
            MCQ: questionsList.filter(q => q.type === 'MCQ').length,
            FILLIN: questionsList.filter(q => q.type === 'Fill_in').length,
            ESSAY: questionsList.filter(q => q.type === 'Essay').length,
            CODE: questionsList.filter(q => q.type === 'Code').length,
          };
        }
      }

      // Fetch full statistics only for published/graded assignments (includes sessions/submissions)
      let statistics: any = null;
      if (assignment.status === 'published' || assignment.status === 'graded') {
        // Count sessions by status
        const { data: allSessions, error: sessionsError } = await supabase
          .from('student_assignment_sessions')
          .select('status, score')
          .eq('assignment_id', assignmentId);

        if (sessionsError) {
          logger.error('Failed to fetch sessions:', sessionsError);
        }

        const sessions = allSessions || [];
        const totalSessions = sessions.length;
        const totalSubmissions = sessions.filter(s => s.status === 'submitted').length;
        const totalInProgress = sessions.filter(s => s.status === 'in_progress').length;
        const totalExpired = sessions.filter(s => s.status === 'expired').length;

        // Calculate average score (only from submitted sessions with scores)
        const submittedSessionsWithScores = sessions.filter(
          s => s.status === 'submitted' && s.score !== null
        );
        const averageScore = submittedSessionsWithScores.length > 0
          ? submittedSessionsWithScores.reduce((sum, s) => sum + Number(s.score || 0), 0) / submittedSessionsWithScores.length
          : null;

        // Calculate submission rate
        const submissionRate = totalEnrolled > 0
          ? Math.round((totalSubmissions / totalEnrolled) * 100)
          : 0;

        statistics = {
          total_enrolled_students: totalEnrolled,
          total_submissions: totalSubmissions,
          total_in_progress: totalInProgress,
          total_expired: totalExpired,
          total_sessions: totalSessions,
          submission_rate: submissionRate,
          total_questions: totalQuestions,
          average_score: averageScore,
          questions_by_type: questionsByType,
        };
      } else if (assignment.status === 'ready_for_review') {
        // For ready_for_review, include question count but no session statistics
        statistics = {
          total_enrolled_students: totalEnrolled,
          total_submissions: 0,
          total_in_progress: 0,
          total_expired: 0,
          total_sessions: 0,
          submission_rate: 0,
          total_questions: totalQuestions,
          average_score: null,
          questions_by_type: questionsByType,
        };
      }

      // Calculate time_status
      const now = new Date();
      let timeStatus: 'ongoing' | 'ended' = 'ongoing';
      if (assignment.deadline) {
        const deadlineDate = new Date(assignment.deadline);
        timeStatus = deadlineDate < now ? 'ended' : 'ongoing';
      } else {
        timeStatus = assignment.status === 'graded' ? 'ended' : 'ongoing';
      }

      // Build response based on status
      const details: AssignmentDetails = {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        type: assignment.type,
        status: assignment.status,
        ai_allowed: assignment.ai_allowed,
        course_id: assignment.course_id,
        course_name: courseName,
        course_description: courseDescription,
        start_time: assignment.start_time,
        duration_minutes: assignment.duration_minutes,
        deadline: assignment.deadline,
        time_status: timeStatus,
        total_types: assignment.total_types,
        generated_types: assignment.generated_types,
        resources: resources,
        statistics: statistics || {
          total_enrolled_students: 0,
          total_submissions: 0,
          total_in_progress: 0,
          total_expired: 0,
          total_sessions: 0,
          submission_rate: 0,
          total_questions: 0,
          average_score: null,
          questions_by_type: { MCQ: 0, FILLIN: 0, ESSAY: 0, CODE: 0 },
        },
        created_at: assignment.created_at,
        updated_at: assignment.updated_at,
      };

      return {
        success: true,
        message: 'Assignment details retrieved successfully',
        data: details,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch assignment details', 500);
    }
  }

  /**
   * Get all submissions for an assignment (lecturer only)
   */
  static async getAssignmentSubmissions(assignmentId: string, userId: string): Promise<SubmissionsListResponse> {
    try {
      // Get lecturer record
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Verify assignment belongs to lecturer
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('lecturer_id')
        .eq('id', assignmentId)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      if (assignment.lecturer_id !== lecturer.id) {
        throw new AppError('You can only view submissions for your own assignments', 403);
      }

      // Fetch sessions with student information
      const { data: sessions, error: sessionsError } = await supabase
        .from('student_assignment_sessions')
        .select(`
          id,
          student_id,
          started_at,
          submitted_at,
          status,
          score,
          time_used_seconds,
          created_at,
          students!student_assignment_sessions_student_id_fkey(
            first_name,
            last_name,
            user_id,
            users!students_user_id_fkey(email)
          )
        `)
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: false });

      if (sessionsError) {
        throw new AppError(`Failed to fetch submissions: ${sessionsError.message}`, 400);
      }

      // Transform sessions to include student info
      const submissions = (sessions || []).map((session: any) => {
        const studentData = Array.isArray(session.students)
          ? session.students[0]
          : session.students;
        const userData = Array.isArray(studentData?.users)
          ? studentData?.users[0]
          : studentData?.users;

        return {
          id: session.id,
          student_id: session.student_id,
          student_name: `${studentData?.first_name || ''} ${studentData?.last_name || ''}`.trim() || 'Unknown Student',
          student_email: userData?.email || 'N/A',
          started_at: session.started_at,
          submitted_at: session.submitted_at,
          status: session.status,
          score: session.score,
          time_used_seconds: session.time_used_seconds,
          created_at: session.created_at,
        };
      });

      return {
        success: true,
        message: 'Submissions retrieved successfully',
        data: submissions,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch submissions', 500);
    }
  }

  /**
   * Get all questions for an assignment (lecturer only)
   */
  static async getAssignmentQuestions(assignmentId: string, userId: string): Promise<QuestionsListResponse> {
    try {
      // Get lecturer record
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Verify assignment belongs to lecturer
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('lecturer_id')
        .eq('id', assignmentId)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      if (assignment.lecturer_id !== lecturer.id) {
        throw new AppError('You can only view questions for your own assignments', 403);
      }

      // Fetch questions
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('order_index', { ascending: true });

      if (questionsError) {
        throw new AppError(`Failed to fetch questions: ${questionsError.message}`, 400);
      }

      // Map database question types to API types and group by code/non-code
      const codePrograms: any[] = [];
      const nonCode: any[] = [];

      (questions || []).forEach((q: any) => {
        let apiType: 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE' = 'MCQ';
        if (q.type === 'Fill_in') apiType = 'FILLIN';
        else if (q.type === 'Essay') apiType = 'ESSAY';
        else if (q.type === 'Code') apiType = 'CODE';
        else if (q.type === 'MCQ') apiType = 'MCQ';

        const mappedQuestion = {
          id: q.id,
          assignment_id: q.assignment_id,
          type: apiType,
          prompt_markdown: q.prompt_markdown,
          content_json: q.content_json,
          explanation: q.explanation,
          answers: q.answers,
          points: q.points,
          order_index: q.order_index,
          created_at: q.created_at,
        };

        // Group by code vs non-code
        if (apiType === 'CODE') {
          codePrograms.push(mappedQuestion);
        } else {
          nonCode.push(mappedQuestion);
        }
      });

      return {
        success: true,
        message: 'Questions retrieved successfully',
        data: {
          code_programs: codePrograms,
          non_code: nonCode,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch questions', 500);
    }
  }

  /**
   * Update assignment (lecturer only)
   */
  static async updateAssignment(assignmentId: string, data: UpdateAssignmentRequest, userId: string): Promise<AssignmentResponse> {
    try {
      // Get lecturer record
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Verify assignment exists and belongs to lecturer
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('lecturer_id, status')
        .eq('id', assignmentId)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      if (assignment.lecturer_id !== lecturer.id) {
        throw new AppError('You can only update your own assignments', 403);
      }

      // Define allowed fields that can be updated (exclude immutable fields)
      const allowedFields = [
        'title',
        'description',
        'start_time',
        'duration_minutes',
        'deadline',
        'status',
        'ai_allowed',
        'type',
      ];

      // Fields that should be ignored (immutable or system-managed)
      const immutableFields = [
        'id',
        'created_at',
        'lecturer_id',
        'course_id',
        'total_types',
        'generated_types',
        'updated_at', // We set this manually
      ];

      // Build update data - only include allowed fields
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Process each field in the request
      for (const [key, value] of Object.entries(data)) {
        // Skip immutable fields
        if (immutableFields.includes(key)) {
          logger.warn('Attempted to update immutable field', {
            assignmentId,
            field: key,
            userId,
          });
          continue;
        }

        // Handle field name mappings
        let dbFieldName = key;
        if (key === 'duration') {
          dbFieldName = 'duration_minutes';
        } else if (key === 'is_ai_allowed') {
          dbFieldName = 'ai_allowed';
        }

        // Only allow updates to whitelisted fields
        if (!allowedFields.includes(dbFieldName)) {
          logger.warn('Attempted to update non-allowed field', {
            assignmentId,
            field: key,
            dbFieldName,
            userId,
          });
          continue;
        }

        // Validate and set the value
        if (value !== undefined) {
          updateData[dbFieldName] = value;
        }
      }

      // If no valid fields to update, return error
      if (Object.keys(updateData).length === 1) {
        // Only updated_at was set
        throw new AppError('No valid fields to update', 400);
      }

      // Update assignment
      const { data: updatedAssignment, error: updateError } = await supabase
        .from('assignments')
        .update(updateData)
        .eq('id', assignmentId)
        .select()
        .single();

      if (updateError) {
        throw new AppError(`Failed to update assignment: ${updateError.message}`, 400);
      }

      return {
        success: true,
        message: 'Assignment updated successfully',
        data: updatedAssignment,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update assignment', 500);
    }
  }

  /**
   * Get all assignments for a student (based on enrolled courses) with filtering and pagination
   */
  static async getStudentAssignments(
    userId: string,
    filters: {
      course_id?: string;
      type?: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
      time_status?: 'not_started' | 'started' | 'ended';
      deadline_before?: string;
      deadline_after?: string;
      search?: string; // search in title
      has_session?: boolean; // filter by whether student has a session
    },
    pagination: {
      page: number;
      limit: number;
    }
  ): Promise<StudentAssignmentsListResponse> {
    try {
      // Get student record
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      // Get all enrolled course IDs
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('student_id', student.id);

      if (enrollmentError) {
        throw new AppError(`Failed to fetch enrollments: ${enrollmentError.message}`, 400);
      }

      const enrolledCourseIds = (enrollments || []).map((e: any) => e.course_id);

      if (enrolledCourseIds.length === 0) {
        return {
          success: true,
          message: 'Assignments retrieved successfully',
          data: {
            assignments: [],
            pagination: {
              page: pagination.page,
              limit: pagination.limit,
              total: 0,
              total_pages: 0,
            },
          },
        };
      }

      // Build query - only published/graded assignments from enrolled courses
      let query = supabase
        .from('assignments')
        .select(`
          id,
          title,
          type,
          deadline,
          status,
          start_time,
          duration_minutes,
          created_at,
          course_id,
          courses!assignments_course_id_fkey(title)
        `)
        .in('course_id', enrolledCourseIds)
        .in('status', ['published', 'graded']);

      // Apply filters
      if (filters.course_id) {
        query = query.eq('course_id', filters.course_id);
      }

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.deadline_before) {
        query = query.lte('deadline', filters.deadline_before);
      }

      if (filters.deadline_after) {
        query = query.gte('deadline', filters.deadline_after);
      }

      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      // Order by created_at descending (newest first)
      query = query.order('created_at', { ascending: false });

      // Fetch all matching records
      const { data: assignments, error: assignmentsError } = await query;

      if (assignmentsError) {
        throw new AppError(`Failed to fetch assignments: ${assignmentsError.message}`, 400);
      }

      // Get all student sessions for these assignments
      const assignmentIds = (assignments || []).map((a: any) => a.id);
      const { data: sessions, error: sessionsError } = await supabase
        .from('student_assignment_sessions')
        .select('id, assignment_id, status')
        .eq('student_id', student.id)
        .in('assignment_id', assignmentIds.length > 0 ? assignmentIds : ['00000000-0000-0000-0000-000000000000']);

      if (sessionsError) {
        throw new AppError(`Failed to fetch sessions: ${sessionsError.message}`, 400);
      }

      // Create a map of assignment_id -> session
      const sessionMap = new Map<string, any>();
      (sessions || []).forEach((session: any) => {
        sessionMap.set(session.assignment_id, session);
      });

      // Transform assignments and calculate time_status
      const now = new Date();
      let transformedAssignments = (assignments || []).map((assignment: any) => {
        let timeStatus: 'not_started' | 'started' | 'ended' = 'started';

        // Calculate time_status
        if (assignment.start_time) {
          const startTime = new Date(assignment.start_time);
          if (startTime > now) {
            timeStatus = 'not_started';
          } else {
            // Started: check if ended
            if (assignment.deadline) {
              const deadlineDate = new Date(assignment.deadline);
              timeStatus = deadlineDate < now ? 'ended' : 'started';
            } else {
              timeStatus = assignment.status === 'graded' ? 'ended' : 'started';
            }
          }
        } else {
          // No start_time: available immediately
          if (assignment.deadline) {
            const deadlineDate = new Date(assignment.deadline);
            timeStatus = deadlineDate < now ? 'ended' : 'started';
          } else {
            timeStatus = assignment.status === 'graded' ? 'ended' : 'started';
          }
        }

        // Get session info
        const session = sessionMap.get(assignment.id);
        const hasSession = !!session;
        const sessionStatus = session?.status;

        // Handle courses data structure
        const courseData = assignment.courses;
        const courseTitle = Array.isArray(courseData)
          ? (courseData[0]?.title || 'Unknown Course')
          : (courseData?.title || 'Unknown Course');

        return {
          id: assignment.id,
          title: assignment.title,
          type: assignment.type,
          course_name: courseTitle,
          course_id: assignment.course_id,
          deadline: assignment.deadline,
          status: assignment.status,
          time_status: timeStatus,
          start_time: assignment.start_time,
          duration_minutes: assignment.duration_minutes,
          has_session: hasSession,
          session_status: sessionStatus,
          created_at: assignment.created_at,
        };
      });

      // Apply time_status filter if provided
      if (filters.time_status) {
        transformedAssignments = transformedAssignments.filter(
          (item) => item.time_status === filters.time_status
        );
      }

      // Apply has_session filter if provided
      if (filters.has_session !== undefined) {
        transformedAssignments = transformedAssignments.filter(
          (item) => item.has_session === filters.has_session
        );
      }

      // Apply pagination after filtering
      const total = transformedAssignments.length;
      const totalPages = Math.ceil(total / pagination.limit);
      const offset = (pagination.page - 1) * pagination.limit;
      const paginatedAssignments = transformedAssignments.slice(offset, offset + pagination.limit);

      return {
        success: true,
        message: 'Assignments retrieved successfully',
        data: {
          assignments: paginatedAssignments,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            total_pages: totalPages,
          },
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch assignments', 500);
    }
  }

  /**
   * Get detailed assignment view for student (for taking exam)
   * Includes questions grouped, resources, session info
   */
  static async getStudentAssignmentDetails(assignmentId: string, userId: string): Promise<StudentAssignmentDetailsResponse> {
    try {
      // Get student record
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      // Load assignment with course info
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          description,
          type,
          course_id,
          start_time,
          duration_minutes,
          deadline,
          ai_allowed,
          status,
          created_at,
          courses!assignments_course_id_fkey(title)
        `)
        .eq('id', assignmentId)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      // Students can only view published/graded assignments
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

      // Get course title
      const courseData = (assignment as any).courses;
      const courseTitle = Array.isArray(courseData)
        ? (courseData[0]?.title || 'Unknown Course')
        : (courseData?.title || 'Unknown Course');

      // Calculate time_status
      const now = new Date();
      let timeStatus: 'not_started' | 'started' | 'ended' = 'started';

      if (assignment.start_time) {
        const startTime = new Date(assignment.start_time);
        if (startTime > now) {
          timeStatus = 'not_started';
        } else {
          if (assignment.deadline) {
            const deadlineDate = new Date(assignment.deadline);
            timeStatus = deadlineDate < now ? 'ended' : 'started';
          } else {
            timeStatus = assignment.status === 'graded' ? 'ended' : 'started';
          }
        }
      } else {
        if (assignment.deadline) {
          const deadlineDate = new Date(assignment.deadline);
          timeStatus = deadlineDate < now ? 'ended' : 'started';
        } else {
          timeStatus = assignment.status === 'graded' ? 'ended' : 'started';
        }
      }

      // Get student session
      const { data: sessions, error: sessionError } = await supabase
        .from('student_assignment_sessions')
        .select('id, status, time_used_seconds')
        .eq('student_id', student.id)
        .eq('assignment_id', assignmentId)
        .limit(1);

      if (sessionError) {
        throw new AppError(`Failed to check student session: ${sessionError.message}`, 400);
      }

      const session = sessions && sessions.length > 0 ? (sessions as any)[0] : null;
      const sessionId = session?.id ?? null;
      const sessionStatus = session?.status;
      const timeUsedSeconds = session?.time_used_seconds;

      // Fetch resources
      const { data: resources, error: resourcesError } = await supabase
        .from('assignment_resources')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });

      if (resourcesError) {
        throw new AppError(`Failed to fetch resources: ${resourcesError.message}`, 400);
      }

      // Fetch questions and group them
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('order_index', { ascending: true });

      if (questionsError) {
        throw new AppError(`Failed to fetch questions: ${questionsError.message}`, 400);
      }

      // Group questions into code_programs and non_code
      // IMPORTANT: For student-facing exam view, we NEVER return answers or explanations
      // Only prompt_markdown, content_json, points, and metadata are exposed.
      const codePrograms: any[] = [];
      const nonCode: any[] = [];

      (questions || []).forEach((q: any) => {
        let apiType: 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE' = 'MCQ';
        if (q.type === 'Fill_in') apiType = 'FILLIN';
        else if (q.type === 'Essay') apiType = 'ESSAY';
        else if (q.type === 'Code') apiType = 'CODE';
        else if (q.type === 'MCQ') apiType = 'MCQ';

        const mappedQuestion = {
          id: q.id,
          assignment_id: q.assignment_id,
          type: apiType,
          prompt_markdown: q.prompt_markdown,
          content_json: q.content_json,
          // answers and explanation are intentionally omitted for students
          points: q.points,
          order_index: q.order_index,
          created_at: q.created_at,
        };

        if (apiType === 'CODE') {
          codePrograms.push(mappedQuestion);
        } else {
          nonCode.push(mappedQuestion);
        }
      });

      // Fetch student answers if session exists and group them
      let codeAnswers: any[] = [];
      let nonCodeAnswers: any[] = [];
      if (sessionId) {
        const { data: answers, error: answersError } = await supabase
          .from('student_answers')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (!answersError && answers && answers.length > 0) {
          // Create a map of question_id -> question type for grouping answers
          const questionTypeMap = new Map<string, 'CODE' | 'NON_CODE'>();
          (questions || []).forEach((q: any) => {
            let apiType: 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE' = 'MCQ';
            if (q.type === 'Fill_in') apiType = 'FILLIN';
            else if (q.type === 'Essay') apiType = 'ESSAY';
            else if (q.type === 'Code') apiType = 'CODE';
            else if (q.type === 'MCQ') apiType = 'MCQ';
            
            questionTypeMap.set(q.id, apiType === 'CODE' ? 'CODE' : 'NON_CODE');
          });

          // Group answers into code_programs and non_code
          answers.forEach((a: any) => {
            const answerType = questionTypeMap.get(a.question_id);
            // Parse code_submission from JSON string to object
            let codeSubmission = a.code_submission;
            if (codeSubmission && typeof codeSubmission === 'string') {
              try {
                codeSubmission = JSON.parse(codeSubmission);
              } catch (e) {
                // If parsing fails, keep as is (might be legacy data)
              }
            }

            const mappedAnswer = {
              id: a.id,
              session_id: a.session_id,
              question_id: a.question_id,
              answer_text: a.answer_text,
              selected_option: a.selected_option,
              code_submission: codeSubmission,
              language: a.language,
              created_at: a.created_at,
            };
            
            if (answerType === 'CODE') {
              codeAnswers.push(mappedAnswer);
            } else {
              nonCodeAnswers.push(mappedAnswer);
            }
          });
        }
      }

      return {
        success: true,
        message: 'Assignment details retrieved successfully',
        data: {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          type: assignment.type,
          course_id: assignment.course_id,
          course_name: courseTitle,
          start_time: assignment.start_time,
          duration_minutes: assignment.duration_minutes,
          deadline: assignment.deadline,
          ai_allowed: assignment.ai_allowed,
          status: assignment.status,
          time_status: timeStatus,
          session_id: sessionId,
          session_status: sessionStatus,
          time_used_seconds: timeUsedSeconds,
          resources: (resources || []).map((r: any) => ({
            id: r.id,
            assignment_id: r.assignment_id,
            resource_type: r.resource_type,
            url: r.url,
            description: r.description,
            created_at: r.created_at,
          })),
          questions: {
            code_programs: codePrograms,
            non_code: nonCode,
          },
          user_answers: {
            code_programs: codeAnswers,
            non_code: nonCodeAnswers,
          },
          created_at: assignment.created_at,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch assignment details', 500);
    }
  }

  /**
   * Get detailed assignment view for student using session ID (for taking exam)
   * Validates session ownership, deadline, and session status
   */
  static async getStudentAssignmentDetailsBySession(sessionId: string, userId: string): Promise<StudentAssignmentDetailsResponse> {
    try {
      // Get student record
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      // Get session with assignment info
      let { data: session, error: sessionError } = await supabase
        .from('student_assignment_sessions')
        .select(`
          id,
          student_id,
          assignment_id,
          status,
          time_used_seconds,
          started_at,
          last_resumed_at,
          assignments!student_assignment_sessions_assignment_id_fkey(
            id,
            title,
            description,
            type,
            course_id,
            start_time,
            duration_minutes,
            deadline,
            ai_allowed,
            status,
            created_at,
            courses!assignments_course_id_fkey(title)
          )
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        throw new AppError('Session not found', 404);
      }

      // Verify session belongs to student
      if (session.student_id !== student.id) {
        throw new AppError('You can only access your own sessions', 403);
      }

      // Verify session is not submitted or expired
      if (session.status === 'submitted') {
        throw new AppError('Cannot access assignment details for a submitted session', 403);
      }
      if (session.status === 'expired') {
        throw new AppError('Session has expired', 403);
      }

      const currentTime = new Date();
      
      // Simple logic: If inactive, use current time_used_seconds (already committed)
      // Don't auto-resume on page load - only when they actually work (heartbeat, save answer, etc.)
      if (session.last_resumed_at) {
        const lastResumedAt = new Date(session.last_resumed_at);
        const inactivitySeconds = Math.floor((currentTime.getTime() - lastResumedAt.getTime()) / 1000);
        const INACTIVITY_THRESHOLD = 120; // 2 minutes
        
        if (inactivitySeconds > INACTIVITY_THRESHOLD) {
          // Been inactive - use current time_used_seconds (already committed)
          // Auto-pause: set last_resumed_at to null
          const currentTimeUsed = Number(session.time_used_seconds || 0);
          
          const { data: updatedSession, error: updateError } = await supabase
            .from('student_assignment_sessions')
            .update({
              time_used_seconds: currentTimeUsed,
              last_resumed_at: null, // Pause
            })
            .eq('id', sessionId)
            .eq('last_resumed_at', session.last_resumed_at)
            .select(`
              *,
              assignments!student_assignment_sessions_assignment_id_fkey(
                id,
                title,
                description,
                type,
                course_id,
                start_time,
                duration_minutes,
                deadline,
                ai_allowed,
                status,
                created_at,
                courses!assignments_course_id_fkey(title)
              )
            `)
            .single();

          if (updateError || !updatedSession) {
            // Race condition - fetch fresh with assignment
            const { data: freshSession, error: freshError } = await supabase
              .from('student_assignment_sessions')
              .select(`
                *,
                assignments!student_assignment_sessions_assignment_id_fkey(
                  id,
                  title,
                  description,
                  type,
                  course_id,
                  start_time,
                  duration_minutes,
                  deadline,
                  ai_allowed,
                  status,
                  created_at,
                  courses!assignments_course_id_fkey(title)
                )
              `)
              .eq('id', sessionId)
              .single();
            if (freshError || !freshSession) {
              throw new AppError('Failed to update session due to race condition', 409);
            }
            session = freshSession;
          } else {
            session = updatedSession;
          }
        } else {
          // Still active - update time normally
          const StudentSessionService = (await import('./student-session.js')).StudentSessionService;
          const usedSeconds = (StudentSessionService as any).computeEffectiveUsedSeconds(session, currentTime);
          
          const { data: updatedSession, error: updateError } = await supabase
            .from('student_assignment_sessions')
            .update({
              time_used_seconds: usedSeconds,
              last_resumed_at: currentTime.toISOString(),
            })
            .eq('id', sessionId)
            .eq('last_resumed_at', session.last_resumed_at)
            .select(`
              *,
              assignments!student_assignment_sessions_assignment_id_fkey(
                id,
                title,
                description,
                type,
                course_id,
                start_time,
                duration_minutes,
                deadline,
                ai_allowed,
                status,
                created_at,
                courses!assignments_course_id_fkey(title)
              )
            `)
            .single();

          if (updateError || !updatedSession) {
            // Race condition - fetch fresh with assignment
            const { data: freshSession, error: freshError } = await supabase
              .from('student_assignment_sessions')
              .select(`
                *,
                assignments!student_assignment_sessions_assignment_id_fkey(
                  id,
                  title,
                  description,
                  type,
                  course_id,
                  start_time,
                  duration_minutes,
                  deadline,
                  ai_allowed,
                  status,
                  created_at,
                  courses!assignments_course_id_fkey(title)
                )
              `)
              .eq('id', sessionId)
              .single();
            if (freshError || !freshSession) {
              throw new AppError('Failed to update session due to race condition', 409);
            }
            session = freshSession;
          } else {
            session = updatedSession;
          }
        }
      }
      // If already paused (last_resumed_at is null), do nothing - time_used_seconds is already correct

      // Ensure session is still valid after potential updates
      if (!session) {
        throw new AppError('Session not found after update', 404);
      }

      // Get assignment data
      const assignment = (session as any).assignments;
      if (!assignment) {
        throw new AppError('Assignment not found for this session', 404);
      }

      const assignmentId = assignment.id;

      // Verify assignment is published/graded
      if (assignment.status !== 'published' && assignment.status !== 'graded') {
        throw new AppError('Assignment is not published yet', 403);
      }

      // Check if deadline has passed
      const now = currentTime;
      if (assignment.deadline) {
        const deadlineDate = new Date(assignment.deadline);
        if (deadlineDate < now) {
          throw new AppError('Assignment deadline has passed', 403);
        }
      } else {
        // No deadline: check if assignment is graded (which means it's ended)
        if (assignment.status === 'graded') {
          throw new AppError('Assignment has been graded and is no longer available', 403);
        }
      }

      // Get course title
      const courseData = assignment.courses;
      const courseTitle = Array.isArray(courseData)
        ? (courseData[0]?.title || 'Unknown Course')
        : (courseData?.title || 'Unknown Course');

      // Calculate time_status
      let timeStatus: 'not_started' | 'started' | 'ended' = 'started';
      if (assignment.start_time) {
        const startTime = new Date(assignment.start_time);
        if (startTime > now) {
          timeStatus = 'not_started';
        } else {
          if (assignment.deadline) {
            const deadlineDate = new Date(assignment.deadline);
            timeStatus = deadlineDate < now ? 'ended' : 'started';
          } else {
            timeStatus = assignment.status === 'graded' ? 'ended' : 'started';
          }
        }
      } else {
        if (assignment.deadline) {
          const deadlineDate = new Date(assignment.deadline);
          timeStatus = deadlineDate < now ? 'ended' : 'started';
        } else {
          timeStatus = assignment.status === 'graded' ? 'ended' : 'started';
        }
      }

      // Fetch resources
      const { data: resources, error: resourcesError } = await supabase
        .from('assignment_resources')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });

      if (resourcesError) {
        throw new AppError(`Failed to fetch resources: ${resourcesError.message}`, 400);
      }

      // Fetch questions and group them
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('order_index', { ascending: true });

      if (questionsError) {
        throw new AppError(`Failed to fetch questions: ${questionsError.message}`, 400);
      }

      // Fetch student answers for this session
      const { data: studentAnswers, error: answersError } = await supabase
        .from('student_answers')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (answersError) {
        throw new AppError(`Failed to fetch student answers: ${answersError.message}`, 400);
      }

      // Create a map of question_id -> question type for grouping answers
      const questionTypeMap = new Map<string, 'CODE' | 'NON_CODE'>();
      (questions || []).forEach((q: any) => {
        let apiType: 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE' = 'MCQ';
        if (q.type === 'Fill_in') apiType = 'FILLIN';
        else if (q.type === 'Essay') apiType = 'ESSAY';
        else if (q.type === 'Code') apiType = 'CODE';
        else if (q.type === 'MCQ') apiType = 'MCQ';
        
        questionTypeMap.set(q.id, apiType === 'CODE' ? 'CODE' : 'NON_CODE');
      });

      // Group answers into code_programs and non_code
      const codeAnswers: any[] = [];
      const nonCodeAnswers: any[] = [];
      (studentAnswers || []).forEach((a: any) => {
        const answerType = questionTypeMap.get(a.question_id);
        const mappedAnswer = {
          id: a.id,
          session_id: a.session_id,
          question_id: a.question_id,
          answer_text: a.answer_text,
          selected_option: a.selected_option,
          code_submission: a.code_submission,
          language: a.language,
          created_at: a.created_at,
        };
        
        if (answerType === 'CODE') {
          codeAnswers.push(mappedAnswer);
        } else {
          nonCodeAnswers.push(mappedAnswer);
        }
      });

      // Group questions into code_programs and non_code
      const codePrograms: any[] = [];
      const nonCode: any[] = [];

      (questions || []).forEach((q: any) => {
        let apiType: 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE' = 'MCQ';
        if (q.type === 'Fill_in') apiType = 'FILLIN';
        else if (q.type === 'Essay') apiType = 'ESSAY';
        else if (q.type === 'Code') apiType = 'CODE';
        else if (q.type === 'MCQ') apiType = 'MCQ';

        const mappedQuestion = {
          id: q.id,
          assignment_id: q.assignment_id,
          type: apiType,
          prompt_markdown: q.prompt_markdown,
          content_json: q.content_json,
          explanation: q.explanation,
          answers: q.answers,
          points: q.points,
          order_index: q.order_index,
          created_at: q.created_at,
        };

        if (apiType === 'CODE') {
          codePrograms.push(mappedQuestion);
        } else {
          nonCode.push(mappedQuestion);
        }
      });

      return {
        success: true,
        message: 'Assignment details retrieved successfully',
        data: {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          type: assignment.type,
          course_id: assignment.course_id,
          course_name: courseTitle,
          start_time: assignment.start_time,
          duration_minutes: assignment.duration_minutes,
          deadline: assignment.deadline,
          ai_allowed: assignment.ai_allowed,
          status: assignment.status,
          time_status: timeStatus,
          session_id: session.id,
          session_status: session.status as 'in_progress' | 'submitted' | 'expired',
          time_used_seconds: session.time_used_seconds,
          resources: (resources || []).map((r: any) => ({
            id: r.id,
            assignment_id: r.assignment_id,
            resource_type: r.resource_type,
            url: r.url,
            description: r.description,
            created_at: r.created_at,
          })),
          questions: {
            code_programs: codePrograms,
            non_code: nonCode,
          },
          user_answers: {
            code_programs: codeAnswers,
            non_code: nonCodeAnswers,
          },
          created_at: assignment.created_at,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch assignment details', 500);
    }
  }
}
