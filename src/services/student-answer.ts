// Student Answer service
import { supabase } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import type {
  CreateAnswerRequest,
  UpdateAnswerRequest,
  AnswerResponse,
} from '../models/assignment.js';

export class StudentAnswerService {
  /**
   * Helper function to check if assignment timing allows operations
   */
  private static async checkAssignmentTiming(assignmentId: string): Promise<void> {
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('start_time, duration_minutes, deadline, status')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      throw new AppError('Assignment not found', 404);
    }

    const now = new Date();

    // If graded, no further changes allowed
    if (assignment.status === 'graded') {
      throw new AppError('Assignment has ended', 403);
    }

    if (assignment.start_time) {
      const startTime = new Date(assignment.start_time);
      if (startTime > now) {
        throw new AppError('Assignment has not started yet', 403);
      }
    }

    // Ended only when deadline has passed (if deadline is set)
    if (assignment.deadline) {
      const deadline = new Date(assignment.deadline);
      if (now > deadline) {
        throw new AppError('Assignment deadline has passed', 403);
      }
    }
  }

  /**
   * Create a new answer
   */
  static async createAnswer(data: CreateAnswerRequest, userId: string): Promise<AnswerResponse> {
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

      // Verify session exists and belongs to student
      const { data: session, error: sessionError } = await supabase
        .from('student_assignment_sessions')
        .select('id, student_id, status, assignment_id, last_resumed_at, time_used_seconds')
        .eq('id', data.session_id)
        .single();

      if (sessionError || !session) {
        throw new AppError('Session not found', 404);
      }

      if (session.student_id !== student.id) {
        throw new AppError('You can only create answers for your own sessions', 403);
      }

      if (session.status === 'submitted') {
        throw new AppError('Cannot add answers to a submitted session', 403);
      }
      if (session.status === 'expired') {
        throw new AppError('Session has expired', 403);
      }

      if (!session.last_resumed_at) {
        throw new AppError('Session is paused. Resume to continue.', 403);
      }

      // Check assignment timing
      await this.checkAssignmentTiming(session.assignment_id);

      // Enforce duration_minutes with 45s grace (active time)
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('duration_minutes')
        .eq('id', session.assignment_id)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      if (assignment.duration_minutes !== null && assignment.duration_minutes !== undefined) {
        const now = new Date();
        const lastResumedAt = new Date(session.last_resumed_at);
        const deltaSeconds = Math.max(0, Math.floor((now.getTime() - lastResumedAt.getTime()) / 1000));
        const usedSeconds = Number(session.time_used_seconds || 0) + deltaSeconds;
        const limitSeconds = assignment.duration_minutes * 60 + 45;
        if (usedSeconds > limitSeconds) {
          await supabase
            .from('student_assignment_sessions')
            .update({ status: 'expired', last_resumed_at: null, time_used_seconds: usedSeconds })
            .eq('id', session.id);
          throw new AppError('Session duration has been exceeded', 403);
        }
      }

      // Verify question exists
      const { error: questionError } = await supabase
        .from('questions')
        .select('id')
        .eq('id', data.question_id)
        .single();

      if (questionError) {
        throw new AppError('Question not found', 404);
      }

      // Check if answer already exists (unique constraint)
      const { data: existingAnswer } = await supabase
        .from('student_answers')
        .select('id')
        .eq('session_id', data.session_id)
        .eq('question_id', data.question_id)
        .single();

      if (existingAnswer) {
        throw new AppError('Answer already exists for this question', 409);
      }

      const answerData = {
        id: crypto.randomUUID(),
        session_id: data.session_id,
        question_id: data.question_id,
        answer_text: data.answer_text || null,
        selected_option: data.selected_option || null,
        code_submission: data.code_submission || null,
        language: data.language || null,
        created_at: new Date().toISOString(),
      };

      const { data: answer, error } = await supabase
        .from('student_answers')
        .insert([answerData])
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to create answer: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Answer created successfully',
        data: answer,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create answer', 500);
    }
  }

  /**
   * Get answer by ID
   */
  static async getAnswerById(answerId: string, userId: string, isLecturer: boolean = false): Promise<AnswerResponse> {
    try {
      const { data: answer, error } = await supabase
        .from('student_answers')
        .select('*')
        .eq('id', answerId)
        .single();

      if (error || !answer) {
        throw new AppError('Answer not found', 404);
      }

      if (!isLecturer) {
        // Verify student owns the session
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (student) {
          const { data: session } = await supabase
            .from('student_assignment_sessions')
            .select('student_id')
            .eq('id', answer.session_id)
            .single();

          if (!session || session.student_id !== student.id) {
            throw new AppError('Unauthorized access to answer', 403);
          }
        }
      } else {
        // Verify lecturer owns the assignment
        const { data: lecturer } = await supabase
          .from('lecturers')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (lecturer) {
          const { data: session } = await supabase
            .from('student_assignment_sessions')
            .select('assignment_id')
            .eq('id', answer.session_id)
            .single();

          if (session) {
            const { data: assignment } = await supabase
              .from('assignments')
              .select('lecturer_id')
              .eq('id', session.assignment_id)
              .single();

            if (!assignment || assignment.lecturer_id !== lecturer.id) {
              throw new AppError('Unauthorized access to answer', 403);
            }
          }
        }
      }

      return {
        success: true,
        message: 'Answer retrieved successfully',
        data: answer,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve answer', 500);
    }
  }

  /**
   * Get all answers for a session
   */
  static async getAnswersBySession(sessionId: string, userId: string, isLecturer: boolean = false): Promise<AnswerResponse> {
    try {
      if (!isLecturer) {
        // Verify student owns the session
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (studentError || !student) {
          throw new AppError('Student profile not found', 404);
        }

        const { data: session, error: sessionError } = await supabase
          .from('student_assignment_sessions')
          .select('student_id')
          .eq('id', sessionId)
          .single();

        if (sessionError || !session) {
          throw new AppError('Session not found', 404);
        }

        if (session.student_id !== student.id) {
          throw new AppError('Unauthorized access to answers', 403);
        }
      } else {
        // Verify lecturer owns the assignment
        const { data: lecturer, error: lecturerError } = await supabase
          .from('lecturers')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (lecturerError || !lecturer) {
          throw new AppError('Lecturer profile not found', 404);
        }

        const { data: session, error: sessionError } = await supabase
          .from('student_assignment_sessions')
          .select('assignment_id')
          .eq('id', sessionId)
          .single();

        if (sessionError || !session) {
          throw new AppError('Session not found', 404);
        }

        const { data: assignment } = await supabase
          .from('assignments')
          .select('lecturer_id')
          .eq('id', session.assignment_id)
          .single();

        if (!assignment || assignment.lecturer_id !== lecturer.id) {
          throw new AppError('Unauthorized access to answers', 403);
        }
      }

      const { data: answers, error } = await supabase
        .from('student_answers')
        .select('*')
        .eq('session_id', sessionId);

      if (error) {
        throw new AppError(`Failed to retrieve answers: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Answers retrieved successfully',
        data: answers || [],
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve answers', 500);
    }
  }

  /**
   * Update answer
   */
  static async updateAnswer(answerId: string, data: UpdateAnswerRequest, userId: string): Promise<AnswerResponse> {
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

      // Verify answer exists and belongs to student's session
      const { data: answer, error: answerError } = await supabase
        .from('student_answers')
        .select(`
          *,
          student_assignment_sessions!student_answers_session_id_fkey(student_id, status, assignment_id)
        `)
        .eq('id', answerId)
        .single();

      if (answerError || !answer) {
        throw new AppError('Answer not found', 404);
      }

      const session = (answer as any).student_assignment_sessions;
      if (session.student_id !== student.id) {
        throw new AppError('You can only update your own answers', 403);
      }

      if (session.status === 'submitted') {
        throw new AppError('Cannot update answers in a submitted session', 403);
      }
      if (session.status === 'expired') {
        throw new AppError('Session has expired', 403);
      }
      if (!session.last_resumed_at) {
        throw new AppError('Session is paused. Resume to continue.', 403);
      }

      // Check assignment timing
      await this.checkAssignmentTiming(session.assignment_id);

      // Enforce duration_minutes with 45s grace (active time)
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('duration_minutes')
        .eq('id', session.assignment_id)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      if (assignment.duration_minutes !== null && assignment.duration_minutes !== undefined) {
        const now = new Date();
        const lastResumedAt = new Date(session.last_resumed_at);
        const deltaSeconds = Math.max(0, Math.floor((now.getTime() - lastResumedAt.getTime()) / 1000));
        const usedSeconds = Number(session.time_used_seconds || 0) + deltaSeconds;
        const limitSeconds = assignment.duration_minutes * 60 + 45;
        if (usedSeconds > limitSeconds) {
          await supabase
            .from('student_assignment_sessions')
            .update({ status: 'expired', last_resumed_at: null, time_used_seconds: usedSeconds })
            .eq('id', session.id);
          throw new AppError('Session duration has been exceeded', 403);
        }
      }

      const updateData: any = {};
      if (data.answer_text !== undefined) updateData.answer_text = data.answer_text;
      if (data.selected_option !== undefined) updateData.selected_option = data.selected_option;
      if (data.code_submission !== undefined) updateData.code_submission = data.code_submission;
      if (data.language !== undefined) updateData.language = data.language;

      const { data: updatedAnswer, error } = await supabase
        .from('student_answers')
        .update(updateData)
        .eq('id', answerId)
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to update answer: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Answer updated successfully',
        data: updatedAnswer,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update answer', 500);
    }
  }

  /**
   * Delete answer
   */
  static async deleteAnswer(answerId: string, userId: string): Promise<AnswerResponse> {
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

      // Verify answer exists and belongs to student's session
      const { data: answer, error: answerError } = await supabase
        .from('student_answers')
        .select(`
          *,
          student_assignment_sessions!student_answers_session_id_fkey(student_id, status)
        `)
        .eq('id', answerId)
        .single();

      if (answerError || !answer) {
        throw new AppError('Answer not found', 404);
      }

      const session = (answer as any).student_assignment_sessions;
      if (session.student_id !== student.id) {
        throw new AppError('You can only delete your own answers', 403);
      }

      if (session.status === 'submitted') {
        throw new AppError('Cannot delete answers from a submitted session', 403);
      }

      const { error } = await supabase
        .from('student_answers')
        .delete()
        .eq('id', answerId);

      if (error) {
        throw new AppError(`Failed to delete answer: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Answer deleted successfully',
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete answer', 500);
    }
  }
}
