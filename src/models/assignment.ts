// Assignment models and interfaces
export interface Assignment {
  id: string; // uuid PK
  course_id: string; // FK to courses.id
  lecturer_id: string; // FK to lecturers.id
  type: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
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
  type?: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
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

export interface UpdateAssignmentRequest {
  // Allow updating any assignment field (except immutable ones like id, created_at, lecturer_id, course_id)
  [key: string]: any;
  // Explicitly typed fields for better TypeScript support
  title?: string;
  description?: string;
  start_time?: string | null;
  duration_minutes?: number | null;
  deadline?: string | null;
  status?: 'draft' | 'processing' | 'ready_for_review' | 'published' | 'graded';
  ai_allowed?: boolean;
  type?: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
  // Note: duration can be passed as 'duration' (will map to duration_minutes)
  duration?: number | null;
  // Note: is_ai_allowed can be passed (will map to ai_allowed)
  is_ai_allowed?: boolean;
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

export interface StudentAssignmentListItem {
  id: string;
  title: string;
  type: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
  course_name: string;
  course_id: string;
  deadline: string | null;
  status: 'published' | 'graded';
  time_status: 'not_started' | 'started' | 'ended';
  start_time: string | null;
  duration_minutes: number | null;
  has_session: boolean;
  session_status?: 'in_progress' | 'submitted' | 'expired';
  created_at: string;
}

export interface StudentAssignmentsListResponse {
  success: boolean;
  message: string;
  data: {
    assignments: StudentAssignmentListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  };
}

export interface StudentAssignmentDetails {
  id: string;
  title: string;
  description: string | null;
  type: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
  course_id: string;
  course_name: string;
  start_time: string | null;
  duration_minutes: number | null;
  deadline: string | null;
  ai_allowed: boolean;
  status: 'published' | 'graded';
  time_status: 'not_started' | 'started' | 'ended';
  session_id: string | null;
  session_status?: 'in_progress' | 'submitted' | 'expired';
  time_used_seconds?: number;
  resources: AssignmentResource[];
  questions: {
    code_programs: Question[];
    non_code: Question[];
  };
  user_answers?: {
    code_programs: StudentAnswer[]; // Answers for CODE type questions
    non_code: StudentAnswer[];      // Answers for MCQ, FILLIN, ESSAY type questions
  };
  created_at: string;
}

export interface StudentAssignmentDetailsResponse {
  success: boolean;
  message: string;
  data: StudentAssignmentDetails;
}

export interface LecturerAssignmentListItem {
  id: string;
  title: string;
  type: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
  course_name: string;
  course_id: string;
  deadline: string | null;
  status: 'draft' | 'processing' | 'ready_for_review' | 'published' | 'graded';
  time_status: 'ongoing' | 'ended';
  created_at: string;
  updated_at: string;
}

export interface LecturerAssignmentsListResponse {
  success: boolean;
  message: string;
  data: {
    assignments: LecturerAssignmentListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  };
}

export interface AssignmentDetailsStatistics {
  total_enrolled_students: number;
  total_submissions: number; // sessions with status='submitted'
  total_in_progress: number; // sessions with status='in_progress'
  total_expired: number; // sessions with status='expired'
  total_sessions: number; // all sessions
  submission_rate: number; // percentage of enrolled students who submitted
  total_questions: number;
  average_score: number | null; // average of submitted sessions with scores
  questions_by_type: {
    MCQ: number;
    FILLIN: number;
    ESSAY: number;
    CODE: number;
  };
}

export interface AssignmentDetails {
  // Basic assignment info
  id: string;
  title: string;
  description: string | null;
  type: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
  status: 'draft' | 'processing' | 'ready_for_review' | 'published' | 'graded';
  ai_allowed: boolean;
  
  // Course info
  course_id: string;
  course_name: string;
  course_description: string | null;
  
  // Time information
  start_time: string | null;
  duration_minutes: number | null;
  deadline: string | null;
  time_status: 'ongoing' | 'ended';
  
  // Question generation
  total_types: number;
  generated_types: number;
  
  // Resources
  resources: AssignmentResource[];
  
  // Statistics
  statistics: AssignmentDetailsStatistics;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface AssignmentDetailsResponse {
  success: boolean;
  message: string;
  data: AssignmentDetails;
}

// Submission with student info for lecturer view
export interface SubmissionWithStudent {
  id: string; // session id
  student_id: string;
  student_name: string; // first_name + last_name
  student_email: string;
  started_at: string;
  submitted_at: string | null;
  status: 'in_progress' | 'submitted' | 'expired';
  score: number | null;
  time_used_seconds: number;
  created_at: string;
}

export interface SubmissionsListResponse {
  success: boolean;
  message: string;
  data: SubmissionWithStudent[];
}

export interface QuestionsListResponse {
  success: boolean;
  message: string;
  data: {
    code_programs: Question[]; // CODE type questions
    non_code: Question[];      // MCQ, FILLIN, ESSAY type questions
  };
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
  code_submission: Record<string, any> | null; // JSON object, not text
  language: string | null;
  created_at: string;
}

export interface CreateAnswerRequest {
  session_id: string;
  question_id: string;
  answer_text?: string | null;
  selected_option?: string | null;
  code_submission?: Record<string, any> | null; // JSON object, not text
  language?: string | null;
}

export interface UpdateAnswerRequest {
  answer_text?: string | null;
  selected_option?: string | null;
  code_submission?: Record<string, any> | null; // JSON object, not text
  language?: string | null;
}

export interface AnswerResponse {
  success: boolean;
  message: string;
  data?: StudentAnswer | StudentAnswer[];
  error?: string;
}
