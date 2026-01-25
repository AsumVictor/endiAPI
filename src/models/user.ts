// User models and interfaces following the database schema
export interface User {
  id: string; // uuid from Supabase Auth
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface Student {
  id: string; // uuid PK, FK → users.id
  user_id: string; // FK to users.id
  first_name: string;
  last_name: string;
  class_year: number | null;
  major: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  streak_count: number; // Daily login streak count
  last_login: string | null; // Last login date (YYYY-MM-DD)
  created_at: string;
  updated_at: string;
}

export interface Lecturer {
  id: string; // uuid PK, FK → users.id
  user_id: string; // FK to users.id
  first_name: string;
  last_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  classes_teaching: string[]; // e.g. ['ML', 'Python', 'Data Structures']
  created_at: string;
  updated_at: string;
}

// Combined user profile for authentication responses
export interface UserProfile {
  user: User;
  profile: Student | Lecturer;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirm_password: string;
  role: 'student' | 'lecturer' | 'admin';
  // Student fields
  first_name?: string;
  last_name?: string;
  class_year?: number;
  major?: string;
  // Lecturer fields
  classes_teaching?: string[];
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    profile: Student | Lecturer;
    tokens?: AuthTokens;
  };
  error?: string;
}

export interface UserSession {
  user: User;
  profile: Student | Lecturer;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface StudentDashboard {
  total_courses_enrolled: number;
  completed_courses_count: number;
  completed_courses: {
    id: string;
    title: string;
  }[];
  total_videos_watched: number;
  course_progress: {
    title: string;
    summary: string;
    thumbnail_url: string | null;
    total_videos: number;
    total_watched_videos: number;
    course_id: string;
  }[];
  recent_enrolled_courses: {
    id: string;
    title: string;
    timestamp: string;
  }[];
  recent_watched_videos: {
    id: string;
    title: string;
    timestamp: string;
  }[];
  recent_completed_videos: {
    id: string;
    title: string;
    timestamp: string;
  }[];
  // Assignment metrics
  assignment_metrics: {
    total_assignments: number;
    completed_assignments: number;
    in_progress_assignments: number;
    upcoming_assignments: number;
  };
  // Recent assignment activity
  recent_assignment_activity: {
    id: string;
    title: string;
    type: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
    course_title: string;
    action: 'started' | 'submitted';
    timestamp: string;
  }[];
  // Upcoming assignments (deadline within 7 days)
  upcoming_assignments: {
    id: string;
    title: string;
    type: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
    course_title: string;
    deadline: string | null;
    days_until_deadline: number | null;
  }[];
}

export interface DashboardResponse {
  success: boolean;
  message: string;
  data?: StudentDashboard;
  error?: string;
}
