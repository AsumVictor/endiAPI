// Video models and interfaces
export interface Video {
  id: string; // uuid PK
  course_id: string; // FK to courses.id
  title: string;
  description: string;
  thumbnail_url: string | null;
  camera_video_url: string;
  code_activity: any | null; // jsonb
  level: 'beginner' | 'intermediate' | 'advanced';
  created_at: string;
  initial_data: any | null; // jsonb
  ispublic: boolean;
}

export interface VideoProgress {
  id: string; // uuid PK
  video_id: string; // FK to videos.id
  student_id: string; // FK to students.id
  completed: boolean;
  completed_at: string | null;
}

// Request/Response interfaces
export interface CreateVideoRequest {
  title: string;
  description: string;
  camera_video_url: string;
  thumbnail_url?: string;
  code_activity?: any;
  level: 'beginner' | 'intermediate' | 'advanced';
  initial_data?: any;
  ispublic?: boolean;
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  camera_video_url?: string;
  thumbnail_url?: string;
  code_activity?: any;
  level?: 'beginner' | 'intermediate' | 'advanced';
  initial_data?: any;
  ispublic?: boolean;
}

export interface VideoResponse {
  success: boolean;
  message: string;
  data?: Video | Video[] | VideoProgress[] | CourseVideoCompletions | VideoWithProgress[];
  error?: string;
}

export interface VideoProgressResponse {
  success: boolean;
  message: string;
  data?: VideoProgress;
  error?: string;
}

// Extended video with progress info
export interface VideoWithProgress extends Video {
  is_completed: boolean;
  completed_at: string | null;
  progress_id: string | null;
}

// Video with completion statistics
export interface VideoWithStats extends Video {
  total_students: number;
  completed_count: number;
  completion_rate: number;
}

// Student video progress with video details
export interface StudentVideoProgress extends VideoProgress {
  video: Video;
}

// Course video completions overview
export interface CourseVideoCompletions {
  course_id: string;
  videos: VideoWithStats[];
  total_videos: number;
  total_completions: number;
  average_completion_rate: number;
}
