// Discussion service
import { supabase } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { webSocketService } from './websocket.js';
import { createThreadDiscussionNotification } from './notification-helper.js';
import type {
  CreateThreadRequest,
  CreateMessageRequest,
  UpdateThreadStatusRequest,
  ThreadResponse,
  ThreadsListResponse,
  MessageResponse,
  ThreadWithMessages,
} from '../models/discussion.js';

export class DiscussionService {
  /**
   * Create a new discussion thread (student asks a question)
   */
  static async createThread(data: CreateThreadRequest, userId: string): Promise<ThreadResponse> {
    try {
      // Get student record for the user
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found. Only students can create discussion threads.', 403);
      }

      // Verify the video exists and get course information
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('course_id')
        .eq('id', data.video_id)
        .single();

      if (videoError || !video) {
        throw new AppError('Video not found', 404);
      }

      // Verify lecturer exists
      const { error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('id', data.lecturer_id)
        .single();

      if (lecturerError) {
        throw new AppError('Lecturer not found', 404);
      }

      // Verify lecturer is the course owner and get lecturer user_id for notification
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('lecturer_id, lecturers!courses_lecturer_id_fkey(user_id)')
        .eq('id', video.course_id)
        .single();

      if (courseError || !course) {
        throw new AppError('Course not found', 404);
      }

      if (course.lecturer_id !== data.lecturer_id) {
        throw new AppError('Lecturer does not own the course for this video', 403);
      }

      const lecturerUserId = (course as any).lecturers?.user_id;

      // Create thread
      const threadData = {
        id: crypto.randomUUID(),
        video_id: data.video_id,
        video_timestamp_seconds: data.video_timestamp_seconds || null,
        student_id: student.id,
        lecturer_id: data.lecturer_id,
        code_snippet: data.code_snippet || null,
        question_text: data.question_text,
        student_unread: false,
        lecturer_unread: true, // Lecturer hasn't seen it yet
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: thread, error: threadError } = await supabase
        .from('discussion_threads')
        .insert([threadData])
        .select()
        .single();

      if (threadError) {
        throw new AppError(`Failed to create thread: ${threadError.message}`, 400);
      }

      // Create first message with the question text
      const messageData = {
        id: crypto.randomUUID(),
        thread_id: thread.id,
        author_user_id: userId,
        content: data.question_text,
        created_at: new Date().toISOString(),
      };

      const { error: messageError } = await supabase
        .from('discussion_messages')
        .insert([messageData]);

      if (messageError) {
        // If message creation fails, delete the thread
        await supabase.from('discussion_threads').delete().eq('id', thread.id);
        throw new AppError(`Failed to create initial message: ${messageError.message}`, 400);
      }

      logger.info('Discussion thread created', {
        threadId: thread.id,
        videoId: data.video_id,
        studentId: student.id,
        lecturerId: data.lecturer_id,
      });

      // Send WebSocket notification to lecturer
      if (lecturerUserId) {
        // Get video title for better notification context
        const { data: video } = await supabase
          .from('videos')
          .select('title')
          .eq('id', data.video_id)
          .single();

        // Get student name for notification
        const { data: studentProfile } = await supabase
          .from('students')
          .select('first_name, last_name')
          .eq('id', student.id)
          .single();

        const studentName = studentProfile 
          ? `${studentProfile.first_name} ${studentProfile.last_name}` 
          : 'A student';

        const notification = createThreadDiscussionNotification(
          'thread_created',
          thread.id,
          {
            videoId: data.video_id,
            videoTitle: video?.title,
            questionPreview: data.question_text.substring(0, 150),
            authorName: studentName,
          }
        );

        webSocketService.notifyUser(lecturerUserId, notification, {
          userId: lecturerUserId,
          priority: 'normal',
          category: 'discussion',
        });
      }

      return {
        success: true,
        message: 'Thread created successfully',
        data: thread,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error creating discussion thread', { error, data });
      throw new AppError('Failed to create discussion thread', 500);
    }
  }

  /**
   * Add a message to a thread
   */
  static async addMessage(
    threadId: string,
    data: CreateMessageRequest,
    userId: string
  ): Promise<MessageResponse> {
    try {
      // Get thread and verify user is a participant
      const { data: thread, error: threadError } = await supabase
        .from('discussion_threads')
        .select(`
          *,
          students!discussion_threads_student_id_fkey(user_id),
          lecturers!discussion_threads_lecturer_id_fkey(user_id)
        `)
        .eq('id', threadId)
        .single();

      if (threadError || !thread) {
        throw new AppError('Thread not found', 404);
      }

      const studentUserId = (thread as any).students?.user_id;
      const lecturerUserId = (thread as any).lecturers?.user_id;

      // Verify user is a participant
      if (userId !== studentUserId && userId !== lecturerUserId) {
        throw new AppError('You are not authorized to add messages to this thread', 403);
      }

      // Create message
      const messageData = {
        id: crypto.randomUUID(),
        thread_id: threadId,
        author_user_id: userId,
        content: data.content,
        created_at: new Date().toISOString(),
      };

      const { data: message, error: messageError } = await supabase
        .from('discussion_messages')
        .insert([messageData])
        .select()
        .single();

      if (messageError) {
        throw new AppError(`Failed to create message: ${messageError.message}`, 400);
      }

      // Update thread unread flags and updated_at
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Determine recipient user ID for notification
      let recipientUserId: string | null = null;

      // If lecturer replied, set student_unread = true, lecturer_unread = false, notify student
      if (userId === lecturerUserId) {
        updateData.student_unread = true;
        updateData.lecturer_unread = false;
        recipientUserId = studentUserId;
      } else {
        // If student replied, set lecturer_unread = true, student_unread = false, notify lecturer
        updateData.lecturer_unread = true;
        updateData.student_unread = false;
        recipientUserId = lecturerUserId;
      }

      const { error: updateError } = await supabase
        .from('discussion_threads')
        .update(updateData)
        .eq('id', threadId);

      if (updateError) {
        logger.warn('Failed to update thread unread flags', { threadId, error: updateError });
        // Don't fail the request if unread flag update fails
      }

      logger.info('Message added to thread', {
        threadId,
        messageId: message.id,
        authorUserId: userId,
      });

      // Send WebSocket notification to the other participant
      if (recipientUserId) {
        // Get video and author info for better notification context
        const { data: video } = await supabase
          .from('videos')
          .select('title')
          .eq('id', thread.video_id)
          .single();

        // Get author name
        const { data: author } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', userId)
          .single();

        let authorName = 'Someone';
        if (author) {
          if (author.role === 'student') {
            const { data: studentProfile } = await supabase
              .from('students')
              .select('first_name, last_name')
              .eq('user_id', userId)
              .single();
            if (studentProfile) {
              authorName = `${studentProfile.first_name} ${studentProfile.last_name}`;
            }
          } else if (author.role === 'lecturer') {
            const { data: lecturerProfile } = await supabase
              .from('lecturers')
              .select('first_name, last_name')
              .eq('user_id', userId)
              .single();
            if (lecturerProfile) {
              authorName = `${lecturerProfile.first_name} ${lecturerProfile.last_name}`;
            }
          }
        }

        const notification = createThreadDiscussionNotification(
          'message_added',
          threadId,
          {
            videoId: thread.video_id,
            videoTitle: video?.title,
            messagePreview: data.content.substring(0, 150),
            authorName: authorName,
          }
        );

        webSocketService.notifyUser(recipientUserId, notification, {
          userId: recipientUserId,
          priority: 'normal',
          category: 'discussion',
        });
      }

      return {
        success: true,
        message: 'Message added successfully',
        data: message,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error adding message to thread', { threadId, error });
      throw new AppError('Failed to add message to thread', 500);
    }
  }

  /**
   * Get thread with all messages
   */
  static async getThreadById(threadId: string, userId: string): Promise<ThreadResponse> {
    try {
      // Get thread and verify user is a participant
      const { data: thread, error: threadError } = await supabase
        .from('discussion_threads')
        .select(`
          *,
          students!discussion_threads_student_id_fkey(user_id),
          lecturers!discussion_threads_lecturer_id_fkey(user_id)
        `)
        .eq('id', threadId)
        .single();

      if (threadError || !thread) {
        throw new AppError('Thread not found', 404);
      }

      const studentUserId = (thread as any).students?.user_id;
      const lecturerUserId = (thread as any).lecturers?.user_id;

      // Verify user is a participant
      if (userId !== studentUserId && userId !== lecturerUserId) {
        throw new AppError('You are not authorized to view this thread', 403);
      }

      // Get all messages for this thread
      const { data: messages, error: messagesError } = await supabase
        .from('discussion_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        throw new AppError(`Failed to fetch messages: ${messagesError.message}`, 400);
      }

      // Enrich messages with author information
      const enrichedMessages = await Promise.all(
        (messages || []).map(async (message) => {
          // Get user info
          const { data: user } = await supabase
            .from('users')
            .select('id, role')
            .eq('id', message.author_user_id)
            .single();

          if (!user) {
            return {
              ...message,
              author_name: 'Unknown User',
              author_role: undefined,
            };
          }

          let authorName = 'Unknown User';
          const authorRole = user.role as 'student' | 'lecturer' | 'admin';

          // Get profile based on role
          if (user.role === 'student') {
            const { data: studentProfile } = await supabase
              .from('students')
              .select('first_name, last_name')
              .eq('user_id', message.author_user_id)
              .single();

            if (studentProfile) {
              authorName = `${studentProfile.first_name} ${studentProfile.last_name}`;
            }
          } else if (user.role === 'lecturer') {
            const { data: lecturerProfile } = await supabase
              .from('lecturers')
              .select('first_name, last_name')
              .eq('user_id', message.author_user_id)
              .single();

            if (lecturerProfile) {
              authorName = `${lecturerProfile.first_name} ${lecturerProfile.last_name}`;
            }
          }

          return {
            ...message,
            author_name: authorName,
            author_role: authorRole,
          };
        })
      );

      // Remove nested student/lecturer data from thread
      const { students, lecturers, ...threadData } = thread as any;

      const threadWithMessages: ThreadWithMessages = {
        ...threadData,
        messages: enrichedMessages,
      };

      return {
        success: true,
        message: 'Thread retrieved successfully',
        data: threadWithMessages,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching thread', { threadId, error });
      throw new AppError('Failed to fetch thread', 500);
    }
  }

  /**
   * Get unread threads for current user
   */
  static async getUnreadThreads(userId: string): Promise<ThreadsListResponse> {
    try {
      // Get user role and profile
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new AppError('User not found', 404);
      }

      let query = supabase
        .from('discussion_threads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (user.role === 'student') {
        // Get student's unread threads
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (!student) {
          throw new AppError('Student profile not found', 404);
        }

        query = query.eq('student_id', student.id).eq('student_unread', true);
      } else if (user.role === 'lecturer') {
        // Get lecturer's unread threads
        const { data: lecturer } = await supabase
          .from('lecturers')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (!lecturer) {
          throw new AppError('Lecturer profile not found', 404);
        }

        query = query.eq('lecturer_id', lecturer.id).eq('lecturer_unread', true);
      } else {
        throw new AppError('Invalid user role', 403);
      }

      const { data: threads, error: threadsError } = await query;

      if (threadsError) {
        throw new AppError(`Failed to fetch unread threads: ${threadsError.message}`, 400);
      }

      return {
        success: true,
        message: 'Unread threads retrieved successfully',
        data: threads || [],
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching unread threads', { userId, error });
      throw new AppError('Failed to fetch unread threads', 500);
    }
  }

  /**
   * Mark thread as read for current user
   */
  static async markThreadAsRead(threadId: string, userId: string): Promise<ThreadResponse> {
    try {
      // Get thread and verify user is a participant
      const { data: thread, error: threadError } = await supabase
        .from('discussion_threads')
        .select(`
          *,
          students!discussion_threads_student_id_fkey(user_id),
          lecturers!discussion_threads_lecturer_id_fkey(user_id)
        `)
        .eq('id', threadId)
        .single();

      if (threadError || !thread) {
        throw new AppError('Thread not found', 404);
      }

      const studentUserId = (thread as any).students?.user_id;
      const lecturerUserId = (thread as any).lecturers?.user_id;

      // Verify user is a participant
      if (userId !== studentUserId && userId !== lecturerUserId) {
        throw new AppError('You are not authorized to mark this thread as read', 403);
      }

      // Update unread flag based on user role
      const updateData: any = {};
      if (userId === studentUserId) {
        updateData.student_unread = false;
      } else {
        updateData.lecturer_unread = false;
      }

      const { data: updatedThread, error: updateError } = await supabase
        .from('discussion_threads')
        .update(updateData)
        .eq('id', threadId)
        .select()
        .single();

      if (updateError) {
        throw new AppError(`Failed to mark thread as read: ${updateError.message}`, 400);
      }

      // Remove nested data
      const { students, lecturers, ...threadData } = updatedThread as any;

      logger.info('Thread marked as read', {
        threadId,
        userId,
      });

      return {
        success: true,
        message: 'Thread marked as read',
        data: threadData,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error marking thread as read', { threadId, userId, error });
      throw new AppError('Failed to mark thread as read', 500);
    }
  }

  /**
   * List all threads (optionally filtered by course/video)
   */
  static async listThreads(
    userId: string,
    filters?: { video_id?: string; course_id?: string; status?: 'open' | 'resolved' }
  ): Promise<ThreadsListResponse> {
    try {
      // Get user role and profile
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new AppError('User not found', 404);
      }

      let query = supabase
        .from('discussion_threads')
        .select('*')
        .order('updated_at', { ascending: false });

      // Filter by user's participation
      if (user.role === 'student') {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (!student) {
          throw new AppError('Student profile not found', 404);
        }

        query = query.eq('student_id', student.id);
      } else if (user.role === 'lecturer') {
        const { data: lecturer } = await supabase
          .from('lecturers')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (!lecturer) {
          throw new AppError('Lecturer profile not found', 404);
        }

        query = query.eq('lecturer_id', lecturer.id);
      } else {
        throw new AppError('Invalid user role', 403);
      }

      // Apply filters
      if (filters?.video_id) {
        query = query.eq('video_id', filters.video_id);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      // If filtering by course_id, we need to join with videos
      if (filters?.course_id) {
        const { data: videos, error: videosError } = await supabase
          .from('videos')
          .select('id')
          .eq('course_id', filters.course_id);

        if (videosError) {
          throw new AppError(`Failed to fetch videos: ${videosError.message}`, 400);
        }

        const videoIds = videos?.map((v) => v.id) || [];
        if (videoIds.length > 0) {
          query = query.in('video_id', videoIds);
        } else {
          // No videos in course, return empty result
          return {
            success: true,
            message: 'Threads retrieved successfully',
            data: [],
          };
        }
      }

      const { data: threads, error: threadsError } = await query;

      if (threadsError) {
        throw new AppError(`Failed to fetch threads: ${threadsError.message}`, 400);
      }

      return {
        success: true,
        message: 'Threads retrieved successfully',
        data: threads || [],
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching threads', { userId, filters, error });
      throw new AppError('Failed to fetch threads', 500);
    }
  }

  /**
   * Update thread status (open or resolved)
   */
  static async updateThreadStatus(
    threadId: string,
    data: UpdateThreadStatusRequest,
    userId: string
  ): Promise<ThreadResponse> {
    try {
      // Get thread and verify user is a participant
      const { data: thread, error: threadError } = await supabase
        .from('discussion_threads')
        .select(`
          *,
          students!discussion_threads_student_id_fkey(user_id),
          lecturers!discussion_threads_lecturer_id_fkey(user_id)
        `)
        .eq('id', threadId)
        .single();

      if (threadError || !thread) {
        throw new AppError('Thread not found', 404);
      }

      const studentUserId = (thread as any).students?.user_id;
      const lecturerUserId = (thread as any).lecturers?.user_id;

      // Verify user is a participant
      if (userId !== studentUserId && userId !== lecturerUserId) {
        throw new AppError('You are not authorized to update this thread status', 403);
      }

      // Validate status value
      if (data.status !== 'open' && data.status !== 'resolved') {
        throw new AppError('Status must be either "open" or "resolved"', 400);
      }

      // Update thread status
      const { data: updatedThread, error: updateError } = await supabase
        .from('discussion_threads')
        .update({
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', threadId)
        .select()
        .single();

      if (updateError) {
        throw new AppError(`Failed to update thread status: ${updateError.message}`, 400);
      }

      // Remove nested data
      const { students, lecturers, ...threadData } = updatedThread as any;

      logger.info('Thread status updated', {
        threadId,
        newStatus: data.status,
        userId,
      });

      // Send WebSocket notification to the other participant
      const recipientUserId = userId === studentUserId ? lecturerUserId : studentUserId;
      if (recipientUserId) {
        // Get video info for notification
        const { data: video } = await supabase
          .from('videos')
          .select('title')
          .eq('id', thread.video_id)
          .single();

        // Get current user name
        const { data: currentUser } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', userId)
          .single();

        let userName = 'Someone';
        if (currentUser) {
          if (currentUser.role === 'student') {
            const { data: studentProfile } = await supabase
              .from('students')
              .select('first_name, last_name')
              .eq('user_id', userId)
              .single();
            if (studentProfile) {
              userName = `${studentProfile.first_name} ${studentProfile.last_name}`;
            }
          } else if (currentUser.role === 'lecturer') {
            const { data: lecturerProfile } = await supabase
              .from('lecturers')
              .select('first_name, last_name')
              .eq('user_id', userId)
              .single();
            if (lecturerProfile) {
              userName = `${lecturerProfile.first_name} ${lecturerProfile.last_name}`;
            }
          }
        }

        const notification = createThreadDiscussionNotification(
          data.status === 'resolved' ? 'thread_resolved' : 'thread_created',
          threadId,
          {
            videoId: thread.video_id,
            videoTitle: video?.title,
            questionPreview: thread.question_text?.substring(0, 150),
            authorName: userName,
          }
        );

        webSocketService.notifyUser(recipientUserId, notification, {
          userId: recipientUserId,
          priority: 'normal',
          category: 'discussion',
        });
      }

      return {
        success: true,
        message: `Thread ${data.status === 'resolved' ? 'resolved' : 'reopened'} successfully`,
        data: threadData,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating thread status', { threadId, error });
      throw new AppError('Failed to update thread status', 500);
    }
  }
}

