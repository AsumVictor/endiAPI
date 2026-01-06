// Notification models and types
// Base notification interface with discriminated union pattern

/**
 * Notification types - extend this union type as you add new notification types
 */
export type NotificationType = 
  | 'thread/discussion' 
  | 'user/created'
  | 'user/deleted'
  | 'course/created'
  | 'video/uploaded';

/**
 * Thread/Discussion notification payload
 */
export interface ThreadDiscussionPayload {
  action: 'thread_created' | 'message_added' | 'thread_read' | 'thread_resolved';
  threadId: string;
  videoId?: string;
  videoTitle?: string;
  questionPreview?: string;
  messagePreview?: string;
  authorName?: string;
  timestamp: string;
}

/**
 * User creation notification payload
 */
export interface UserCreatedPayload {
  userId: string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  userName?: string;
  timestamp: string;
}

/**
 * User deletion notification payload
 */
export interface UserDeletedPayload {
  userId: string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  timestamp: string;
}

/**
 * Course creation notification payload
 */
export interface CourseCreatedPayload {
  courseId: string;
  courseTitle: string;
  lecturerId: string;
  lecturerName?: string;
  timestamp: string;
}

/**
 * Video upload notification payload
 */
export interface VideoUploadedPayload {
  videoId: string;
  videoTitle: string;
  courseId: string;
  courseTitle?: string;
  lecturerId: string;
  timestamp: string;
}

/**
 * Union of all notification payload types
 */
export type NotificationPayload = 
  | { type: 'thread/discussion'; payload: ThreadDiscussionPayload }
  | { type: 'user/created'; payload: UserCreatedPayload }
  | { type: 'user/deleted'; payload: UserDeletedPayload }
  | { type: 'course/created'; payload: CourseCreatedPayload }
  | { type: 'video/uploaded'; payload: VideoUploadedPayload };

/**
 * Base notification interface
 */
export interface Notification {
  id: string;
  type: NotificationType;
  payload: 
    | ThreadDiscussionPayload 
    | UserCreatedPayload 
    | UserDeletedPayload 
    | CourseCreatedPayload 
    | VideoUploadedPayload;
  timestamp: string;
  read?: boolean;
}

/**
 * Notification metadata for tracking
 */
export interface NotificationMetadata {
  userId: string; // Recipient user ID
  priority?: 'low' | 'normal' | 'high';
  category?: string;
}

