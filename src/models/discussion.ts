// Discussion models and interfaces
export interface DiscussionThread {
  id: string;
  video_id: string;
  video_timestamp_seconds: number | null;
  student_id: string;
  lecturer_id: string;
  code_snippet: string | null;
  question_text: string;
  student_unread: boolean;
  lecturer_unread: boolean;
  status: 'open' | 'resolved';
  created_at: string;
  updated_at: string;
}

export interface DiscussionMessage {
  id: string;
  thread_id: string;
  author_user_id: string;
  content: string;
  created_at: string;
  author_name?: string;  // Full name (first_name + last_name)
  author_role?: 'student' | 'lecturer' | 'admin';  // User role
}

export interface CreateThreadRequest {
  video_id: string;
  video_timestamp_seconds?: number;
  lecturer_id: string;
  code_snippet?: string;
  question_text: string;
}

export interface CreateMessageRequest {
  content: string;
}

export interface UpdateThreadStatusRequest {
  status: 'open' | 'resolved';
}

export interface ThreadWithMessages extends DiscussionThread {
  messages: DiscussionMessage[];
}

export interface ThreadResponse {
  success: boolean;
  message: string;
  data: DiscussionThread | ThreadWithMessages;
}

export interface ThreadsListResponse {
  success: boolean;
  message: string;
  data: DiscussionThread[];
}

export interface MessageResponse {
  success: boolean;
  message: string;
  data: DiscussionMessage;
}

