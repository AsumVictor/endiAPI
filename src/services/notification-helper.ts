// Helper functions for creating different notification types
import type { NotificationPayload } from '../models/notification.ts';

/**
 * Create a thread/discussion notification payload
 */
export function createThreadDiscussionNotification(
  action: 'thread_created' | 'message_added' | 'thread_read' | 'thread_resolved',
  threadId: string,
  options?: {
    videoId?: string;
    videoTitle?: string;
    questionPreview?: string;
    messagePreview?: string;
    authorName?: string;
  }
): NotificationPayload {
  const payload: any = {
    action,
    threadId,
    timestamp: new Date().toISOString(),
  };

  // Only include optional properties if they are defined
  if (options?.videoId !== undefined) {
    payload.videoId = options.videoId;
  }
  if (options?.videoTitle !== undefined) {
    payload.videoTitle = options.videoTitle;
  }
  if (options?.questionPreview !== undefined) {
    payload.questionPreview = options.questionPreview;
  }
  if (options?.messagePreview !== undefined) {
    payload.messagePreview = options.messagePreview;
  }
  if (options?.authorName !== undefined) {
    payload.authorName = options.authorName;
  }

  return {
    type: 'thread/discussion',
    payload,
  };
}

/**
 * Create a user created notification payload
 */
export function createUserCreatedNotification(
  userId: string,
  email: string,
  role: 'student' | 'lecturer' | 'admin',
  userName?: string
): NotificationPayload {
  const payload: any = {
    userId,
    email,
    role,
    timestamp: new Date().toISOString(),
  };

  // Only include optional properties if they are defined
  if (userName !== undefined) {
    payload.userName = userName;
  }

  return {
    type: 'user/created',
    payload,
  };
}

/**
 * Create a user deleted notification payload
 */
export function createUserDeletedNotification(
  userId: string,
  email: string,
  role: 'student' | 'lecturer' | 'admin'
): NotificationPayload {
  return {
    type: 'user/deleted',
    payload: {
      userId,
      email,
      role,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a course created notification payload
 */
export function createCourseCreatedNotification(
  courseId: string,
  courseTitle: string,
  lecturerId: string,
  lecturerName?: string
): NotificationPayload {
  const payload: any = {
    courseId,
    courseTitle,
    lecturerId,
    timestamp: new Date().toISOString(),
  };

  // Only include optional properties if they are defined
  if (lecturerName !== undefined) {
    payload.lecturerName = lecturerName;
  }

  return {
    type: 'course/created',
    payload,
  };
}

/**
 * Create a video uploaded notification payload
 */
export function createVideoUploadedNotification(
  videoId: string,
  videoTitle: string,
  courseId: string,
  lecturerId: string,
  courseTitle?: string
): NotificationPayload {
  const payload: any = {
    videoId,
    videoTitle,
    courseId,
    lecturerId,
    timestamp: new Date().toISOString(),
  };

  // Only include optional properties if they are defined
  if (courseTitle !== undefined) {
    payload.courseTitle = courseTitle;
  }

  return {
    type: 'video/uploaded',
    payload,
  };
}

