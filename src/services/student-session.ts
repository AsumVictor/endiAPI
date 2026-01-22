// Student Assignment Session service
import { supabase } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import type {
  CreateSessionRequest,
  UpdateSessionRequest,
  SessionResponse
} from '../models/assignment.js';

export class StudentSessionService {
  private static readonly DURATION_GRACE_SECONDS = 45;

  private static computeEffectiveUsedSeconds(session: any, now: Date): number {
    const base = Number(session.time_used_seconds || 0);
    const lastResumedAt = session.last_resumed_at ? new Date(session.last_resumed_at) : null;
    if (!lastResumedAt) return base;
    const deltaSeconds = Math.max(0, Math.floor((now.getTime() - lastResumedAt.getTime()) / 1000));
    return base + deltaSeconds;
  }

  private static async enforceDurationOrExpire(session: any, assignment: any, now: Date): Promise<void> {
    if (assignment.duration_minutes === null || assignment.duration_minutes === undefined) {
      return;
    }

    const limitSeconds = assignment.duration_minutes * 60 + this.DURATION_GRACE_SECONDS;
    const usedSeconds = this.computeEffectiveUsedSeconds(session, now);
    if (usedSeconds <= limitSeconds) return;

    // Expire the session
    await supabase
      .from('student_assignment_sessions')
      .update({
        status: 'expired',
        last_resumed_at: null,
        time_used_seconds: usedSeconds,
      })
      .eq('id', session.id);

    throw new AppError('Session duration has been exceeded', 403);
  }

  /**
   * Create a new session (start an assignment)
   */
  static async createSession(data: CreateSessionRequest, userId: string): Promise<SessionResponse> {
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

      // Verify assignment exists and check timing
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('id, status, start_time, duration_minutes, deadline')
        .eq('id', data.assignment_id)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      if (assignment.status !== 'published') {
        throw new AppError('Assignment is not published yet', 403);
      }

      // Check if assignment has started
      const now = new Date();
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

      // Check if session already exists (unique constraint)
      const { data: existingSession } = await supabase
        .from('student_assignment_sessions')
        .select('id')
        .eq('student_id', student.id)
        .eq('assignment_id', data.assignment_id)
        .single();

      if (existingSession) {
        throw new AppError('Session already exists for this assignment', 409);
      }

      const startedAt = new Date().toISOString();
      const sessionData = {
        id: crypto.randomUUID(),
        student_id: student.id,
        assignment_id: data.assignment_id,
        started_at: startedAt,
        last_resumed_at: startedAt,
        time_used_seconds: 0,
        submitted_at: null,
        status: 'in_progress' as const,
        score: null,
        created_at: new Date().toISOString(),
      };

      const { data: session, error } = await supabase
        .from('student_assignment_sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to create session: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Session created successfully',
        data: session,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create session', 500);
    }
  }

  /**
   * Pause session (stop the timer)
   */
  static async pauseSession(sessionId: string, userId: string): Promise<SessionResponse> {
    // Get student record
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
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new AppError('Session not found', 404);
    }

    if (session.student_id !== student.id) {
      throw new AppError('You can only pause your own sessions', 403);
    }

    if (session.status !== 'in_progress') {
      throw new AppError('Only in-progress sessions can be paused', 403);
    }

    const now = new Date();
    const usedSeconds = this.computeEffectiveUsedSeconds(session, now);

    const { data: updatedSession, error } = await supabase
      .from('student_assignment_sessions')
      .update({
        time_used_seconds: usedSeconds,
        last_resumed_at: null,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to pause session: ${error.message}`, 400);
    }

    return { success: true, message: 'Session paused successfully', data: updatedSession };
  }

  /**
   * Resume session (start the timer again)
   */
  static async resumeSession(sessionId: string, userId: string): Promise<SessionResponse> {
    // Get student record
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
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new AppError('Session not found', 404);
    }

    if (session.student_id !== student.id) {
      throw new AppError('You can only resume your own sessions', 403);
    }

    if (session.status !== 'in_progress') {
      throw new AppError('Only in-progress sessions can be resumed', 403);
    }

    // Load assignment for timing + duration enforcement
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, status, start_time, duration_minutes, deadline')
      .eq('id', session.assignment_id)
      .single();

    if (assignmentError || !assignment) {
      throw new AppError('Assignment not found', 404);
    }
    if (assignment.status !== 'published') {
      throw new AppError('Assignment is not published yet', 403);
    }

    const now = new Date();
    if (assignment.start_time) {
      const startTime = new Date(assignment.start_time);
      if (startTime > now) {
        throw new AppError('Assignment has not started yet', 403);
      }
    }
    if (assignment.deadline) {
      const deadline = new Date(assignment.deadline);
      if (now > deadline) {
        throw new AppError('Assignment deadline has passed', 403);
      }
    }

    // Enforce duration before resuming
    await this.enforceDurationOrExpire(session, assignment, now);

    // If already running, no-op
    if (session.last_resumed_at) {
      return { success: true, message: 'Session resumed successfully', data: session };
    }

    const { data: updatedSession, error } = await supabase
      .from('student_assignment_sessions')
      .update({
        last_resumed_at: now.toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to resume session: ${error.message}`, 400);
    }

    return { success: true, message: 'Session resumed successfully', data: updatedSession };
  }

  /**
   * Get session by ID
   */
  static async getSessionById(sessionId: string, userId: string, isLecturer: boolean = false): Promise<SessionResponse> {
    try {
      const { data: session, error } = await supabase
        .from('student_assignment_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        throw new AppError('Session not found', 404);
      }

      if (!isLecturer) {
        // Verify student owns the session
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (!student || session.student_id !== student.id) {
          throw new AppError('Unauthorized access to session', 403);
        }
      } else {
        // Verify lecturer owns the assignment
        const { data: lecturer } = await supabase
          .from('lecturers')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (lecturer) {
          const { data: assignment } = await supabase
            .from('assignments')
            .select('lecturer_id')
            .eq('id', session.assignment_id)
            .single();

          if (!assignment || assignment.lecturer_id !== lecturer.id) {
            throw new AppError('Unauthorized access to session', 403);
          }
        }
      }

      return {
        success: true,
        message: 'Session retrieved successfully',
        data: session,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve session', 500);
    }
  }

  /**
   * Get all sessions for a student
   */
  static async getSessionsByStudent(userId: string): Promise<SessionResponse> {
    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      const { data: sessions, error } = await supabase
        .from('student_assignment_sessions')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new AppError(`Failed to retrieve sessions: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Sessions retrieved successfully',
        data: sessions || [],
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve sessions', 500);
    }
  }

  /**
   * Get all sessions for an assignment (lecturer only)
   */
  static async getSessionsByAssignment(assignmentId: string, userId: string): Promise<SessionResponse> {
    try {
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
        throw new AppError('You can only view sessions for your own assignments', 403);
      }

      const { data: sessions, error } = await supabase
        .from('student_assignment_sessions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new AppError(`Failed to retrieve sessions: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Sessions retrieved successfully',
        data: sessions || [],
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve sessions', 500);
    }
  }

  /**
   * Update session
   */
  static async updateSession(sessionId: string, data: UpdateSessionRequest, userId: string): Promise<SessionResponse> {
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
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        throw new AppError('Session not found', 404);
      }

      if (session.student_id !== student.id) {
        throw new AppError('You can only update your own sessions', 403);
      }

      const updateData: any = {};
      const now = new Date();
      // If submitting, finalize time_used_seconds and stop timer
      const isSubmitting = data.status === 'submitted' || data.submitted_at !== undefined;
      if (isSubmitting) {
        updateData.submitted_at = data.submitted_at ?? now.toISOString();
        updateData.status = 'submitted';
        updateData.time_used_seconds = this.computeEffectiveUsedSeconds(session, now);
        updateData.last_resumed_at = null;
      } else {
        if (data.submitted_at !== undefined) updateData.submitted_at = data.submitted_at;
        if (data.status !== undefined) updateData.status = data.status;
      }
      if (data.score !== undefined) updateData.score = data.score;

      const { data: updatedSession, error } = await supabase
        .from('student_assignment_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to update session: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Session updated successfully',
        data: updatedSession,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update session', 500);
    }
  }

  /**
   * Delete session (students can delete their own sessions)
   */
  static async deleteSession(sessionId: string, userId: string): Promise<SessionResponse> {
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
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        throw new AppError('Session not found', 404);
      }

      if (session.student_id !== student.id) {
        throw new AppError('You can only delete your own sessions', 403);
      }

      const { error } = await supabase
        .from('student_assignment_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        throw new AppError(`Failed to delete session: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Session deleted successfully',
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete session', 500);
    }
  }
}
