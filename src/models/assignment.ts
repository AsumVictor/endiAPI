// Assignment models and interfaces
export interface Assignment {
  id: string; // uuid PK
  course_id: string; // FK to courses.id
  lecturer_id: string; // FK to lecturers.id
  title: string;
  description: string | null;
  start_time: string | null; // timestamptz
  duration_minutes: number | null;
  deadline: string | null; // timestamptz (nullable)
  ai_allowed: boolean;
  status: 'draft' | 'processing' | 'ready_for_review' | 'published' | 'graded';
  total_types: number;
  generated_types: number;
  created_at: string;
  updated_at: string;
}

export interface AssignmentResource {
  id: string; // uuid PK
  assignment_id: string; // FK to assignments.id
  resource_type: 'pdf' | 'file' | 'link';
  url: string;
  description: string | null;
  created_at: string;
}

// Request/Response interfaces
export interface CreateAssignmentRequest {
  title: string;
  description?: string;
  start_time?: string; // ISO timestamp
  duration?: number | null; // minutes, nullable
  deadline?: string | null; // ISO timestamp, nullable
  course_id: string;
  is_ai_allowed?: boolean;
  question_types?: Record<string, number>; // {type: percentage} - not in schema, will log
  code_programs?: Array<{ prompt: string; language: string }>; // not in schema, will log
  prompt?: string; // not in schema, will log
  files?: Array<{ name: string; url: string }>; // array of file objects - not in schema, will log
  resources?: Array<{ type: 'pdf' | 'file' | 'link'; url: string; description?: string }>; // maps to assignment_resources
  total_questions?: number; // not in schema, will log
}

export interface AssignmentResponse {
  success: boolean;
  message: string;
  data?: Assignment | Assignment[] | AssignmentResource[];
  error?: string;
}

export type AssignmentTimeStatus = 'not_started' | 'started' | 'ended';

export interface StudentAssignmentView {
  assignment_id: string;
  title: string;
  course_title: string;
  time_status: AssignmentTimeStatus;
  start_time: string | null;
  duration_minutes: number | null;
  session_id: string | null;
}

// Question models
export interface Question {
  id: string; // uuid PK
  assignment_id: string; // FK to assignments.id
  type: 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE';
  prompt_markdown: string;
  content_json: Record<string, any> | null;
  explanation?: string | null;
  answers?: string | string[] | null;
  points: number;
  order_index: number;
  created_at: string;
}

export interface CreateQuestionRequest {
  assignment_id: string;
  type: 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE';
  prompt_markdown: string;
  content_json?: Record<string, any> | null;
  points?: number;
  order_index: number;
}

export interface UpdateQuestionRequest {
  type?: 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE';
  prompt_markdown?: string;
  content_json?: Record<string, any> | null;
  points?: number;
  order_index?: number;
}

export interface QuestionResponse {
  success: boolean;
  message: string;
  data?: Question | Question[];
  error?: string;
}

// Student Assignment Session models
export interface StudentAssignmentSession {
  id: string; // uuid PK
  student_id: string; // FK to students.id
  assignment_id: string; // FK to assignments.id
  started_at: string;
  last_resumed_at: string | null;
  time_used_seconds: number;
  submitted_at: string | null;
  status: 'in_progress' | 'submitted' | 'expired';
  score: number | null;
  created_at: string;
}

export interface CreateSessionRequest {
  assignment_id: string;
}

export interface UpdateSessionRequest {
  submitted_at?: string | null;
  status?: 'in_progress' | 'submitted' | 'expired';
  score?: number | null;
}

export interface SessionResponse {
  success: boolean;
  message: string;
  data?: StudentAssignmentSession | StudentAssignmentSession[];
  error?: string;
}

// Student Answer models
export interface StudentAnswer {
  id: string; // uuid PK
  session_id: string; // FK to student_assignment_sessions.id
  question_id: string; // FK to questions.id
  answer_text: string | null;
  selected_option: string | null;
  code_submission: string | null;
  language: string | null;
  created_at: string;
}

export interface CreateAnswerRequest {
  session_id: string;
  question_id: string;
  answer_text?: string | null;
  selected_option?: string | null;
  code_submission?: string | null;
  language?: string | null;
}

export interface UpdateAnswerRequest {
  answer_text?: string | null;
  selected_option?: string | null;
  code_submission?: string | null;
  language?: string | null;
}

export interface AnswerResponse {
  success: boolean;
  message: string;
  data?: StudentAnswer | StudentAnswer[];
  error?: string;
}
