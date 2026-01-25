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
  // If no activity for more than 2 minutes, consider session inactive and auto-pause

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

    // Fetch fresh session data to ensure we have the latest time_used_seconds (from auto-pause)
    const { data: freshSession, error: freshError } = await supabase
      .from('student_assignment_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (freshError || !freshSession) {
      throw new AppError('Failed to fetch session data', 500);
    }

    // Update last_resumed_at only (preserve time_used_seconds that was committed during auto-pause)
    const { data: updatedSession, error } = await supabase
      .from('student_assignment_sessions')
      .update({
        last_resumed_at: now.toISOString(),
        // Don't touch time_used_seconds - it was already committed during auto-pause
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
   * Submit assignment session
   * Finalizes the session, stops time tracking, and marks as submitted
   */
  static async submitSession(sessionId: string, userId: string): Promise<SessionResponse> {
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
        throw new AppError('You can only submit your own sessions', 403);
      }

      // Check if expired
      if (session.status === 'expired') {
        throw new AppError('Cannot submit an expired session', 403);
      }

      const now = new Date();

      // If already submitted, just update submitted_at timestamp
      if (session.status === 'submitted') {
        const { data: updatedSession, error: updateError } = await supabase
          .from('student_assignment_sessions')
          .update({
            submitted_at: now.toISOString(),
          })
          .eq('id', sessionId)
          .select()
          .single();

        if (updateError || !updatedSession) {
          throw new AppError(`Failed to update submission time: ${updateError?.message || 'Unknown error'}`, 400);
        }

        return {
          success: true,
          message: 'Submission time updated successfully',
          data: updatedSession,
        };
      }

      // Get assignment to check deadline
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('deadline, status')
        .eq('id', session.assignment_id)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      // Check if assignment deadline has passed
      if (assignment.deadline) {
        const deadlineDate = new Date(assignment.deadline);
        if (deadlineDate < now) {
          throw new AppError('Assignment deadline has passed. Cannot submit.', 403);
        }
      }

      // Check if assignment is graded (ended)
      if (assignment.status === 'graded') {
        throw new AppError('Assignment has been graded and is no longer available for submission', 403);
      }

      // Finalize time_used_seconds and submit
      const finalTimeUsed = this.computeEffectiveUsedSeconds(session, now);
      
      const { data: submittedSession, error: updateError } = await supabase
        .from('student_assignment_sessions')
        .update({
          status: 'submitted',
          submitted_at: now.toISOString(),
          time_used_seconds: finalTimeUsed,
          last_resumed_at: null, // Stop timer
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError || !submittedSession) {
        throw new AppError(`Failed to submit session: ${updateError?.message || 'Unknown error'}`, 400);
      }

      return {
        success: true,
        message: 'Assignment submitted successfully',
        data: submittedSession,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to submit session', 500);
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

  /**
   * Heartbeat - Update session activity timestamp and time used
   * Called periodically by frontend to track active time
   */
  static async heartbeat(sessionId: string, userId: string): Promise<SessionResponse> {
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

      // Get session
      let { data: session, error: sessionError } = await supabase
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

      // If session is already expired, return success with expired status
      if (session.status === 'expired') {
        return {
          success: true,
          message: 'Session has expired',
          data: session,
        };
      }

      if (session.status !== 'in_progress') {
        throw new AppError('Can only send heartbeat for in-progress sessions', 403);
      }

      // Check if session is paused (no last_resumed_at)
      // If heartbeat is called, it means student is actively working, so auto-resume
      if (!session.last_resumed_at) {
        const now = new Date();
        
        // Fetch fresh session data to ensure we have the latest time_used_seconds (from auto-pause)
        const { data: freshSession, error: freshError } = await supabase
          .from('student_assignment_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        
        if (freshError || !freshSession) {
          throw new AppError('Session not found', 404);
        }
        
        // Auto-resume: student is sending heartbeat, so they're actively working
        // Only update last_resumed_at (preserve time_used_seconds that was committed during auto-pause)
        const { data: resumedSession, error: resumeError } = await supabase
          .from('student_assignment_sessions')
          .update({
            last_resumed_at: now.toISOString(),
            // Don't touch time_used_seconds - it was already committed during auto-pause
          })
          .eq('id', sessionId)
          .select()
          .single();
        
        if (resumeError || !resumedSession) {
          throw new AppError('Failed to resume session', 500);
        }
        
        // Continue with normal heartbeat logic using the resumed session
        session = resumedSession;
      }

      const now = new Date();
      
      // Simple logic: If inactive, use current time_used_seconds (already committed)
      // If active, calculate normally from last_resumed_at
      let usedSeconds: number;
      
      if (!session.last_resumed_at) {
        // Session is paused - time_used_seconds is already the committed value
        usedSeconds = Number(session.time_used_seconds || 0);
        
        // Auto-resume since heartbeat indicates active work
        const { data: resumedSession, error: resumeError } = await supabase
          .from('student_assignment_sessions')
          .update({
            last_resumed_at: now.toISOString(),
          })
          .eq('id', sessionId)
          .select()
          .single();
        
        if (resumeError || !resumedSession) {
          throw new AppError('Failed to resume session', 500);
        }
        
        session = resumedSession;
      } else {
        // Session is active - check if it's been inactive
        const lastResumedAt = new Date(session.last_resumed_at);
        const inactivitySeconds = Math.floor((now.getTime() - lastResumedAt.getTime()) / 1000);
        const INACTIVITY_THRESHOLD = 120; // 2 minutes
        
        if (inactivitySeconds > INACTIVITY_THRESHOLD) {
          // Been inactive - use current time_used_seconds (already committed from last activity)
          // Auto-pause and then resume
          const currentTimeUsed = Number(session.time_used_seconds || 0);
          
          const { data: pausedSession, error: pauseError } = await supabase
            .from('student_assignment_sessions')
            .update({
              time_used_seconds: currentTimeUsed,
              last_resumed_at: null, // Pause
            })
            .eq('id', sessionId)
            .eq('last_resumed_at', session.last_resumed_at)
            .select()
            .single();
          
          if (pauseError || !pausedSession) {
            // Race condition - fetch fresh
            const { data: freshSession } = await supabase
              .from('student_assignment_sessions')
              .select('*')
              .eq('id', sessionId)
              .single();
            if (freshSession) {
              session = freshSession;
              usedSeconds = Number(session.time_used_seconds || 0);
            } else {
              throw new AppError('Failed to pause session', 409);
            }
          } else {
            session = pausedSession;
            usedSeconds = currentTimeUsed;
          }
          
          // Auto-resume
          const { data: resumedSession, error: resumeError } = await supabase
            .from('student_assignment_sessions')
            .update({
              last_resumed_at: now.toISOString(),
            })
            .eq('id', sessionId)
            .select()
            .single();
          
          if (resumeError || !resumedSession) {
            throw new AppError('Failed to resume session', 500);
          }
          
          session = resumedSession;
        } else {
          // Still active - calculate normally
          usedSeconds = this.computeEffectiveUsedSeconds(session, now);
        }
      }

      // Get assignment to check duration limit and deadline
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('duration_minutes, deadline')
        .eq('id', session.assignment_id)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      // Check if assignment deadline has passed
      if (assignment.deadline) {
        const deadlineDate = new Date(assignment.deadline);
        if (deadlineDate < now) {
          // Deadline has passed - expire session and return success response
          const { data: expiredSession, error: expireError } = await supabase
            .from('student_assignment_sessions')
            .update({
              status: 'expired',
              last_resumed_at: null,
              time_used_seconds: usedSeconds,
            })
            .eq('id', sessionId)
            .select()
            .single();

          if (expireError || !expiredSession) {
            throw new AppError('Failed to expire session', 500);
          }

          return {
            success: true,
            message: 'Session has expired - assignment deadline has passed',
            data: expiredSession,
          };
        }
      }

      // Check duration limit
      if (assignment.duration_minutes !== null && assignment.duration_minutes !== undefined) {
        const limitSeconds = assignment.duration_minutes * 60;
        const graceSeconds = this.DURATION_GRACE_SECONDS;
        
        if (usedSeconds > limitSeconds + graceSeconds) {
          // Expire session and return success response with expired status
          const { data: expiredSession, error: expireError } = await supabase
            .from('student_assignment_sessions')
            .update({
              status: 'expired',
              last_resumed_at: null,
              time_used_seconds: usedSeconds,
            })
            .eq('id', sessionId)
            .select()
            .single();

          if (expireError || !expiredSession) {
            throw new AppError('Failed to expire session', 500);
          }

          return {
            success: true,
            message: 'Session has expired - time limit exceeded',
            data: expiredSession,
          };
        }
      }

      // Update time_used_seconds and reset last_resumed_at to now
      // This "commits" the elapsed time since last_resumed_at into time_used_seconds
      // and starts a new active period from now
      const { data: updatedSession, error: updateError } = await supabase
        .from('student_assignment_sessions')
        .update({
          time_used_seconds: usedSeconds,
          last_resumed_at: now.toISOString(), // Reset to now to start fresh period
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError) {
        throw new AppError(`Failed to update session: ${updateError.message}`, 400);
      }

      return {
        success: true,
        message: 'Heartbeat updated successfully',
        data: updatedSession,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update heartbeat', 500);
    }
  }
}
