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
