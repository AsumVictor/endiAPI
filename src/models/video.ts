// Video models and interfaces
export interface Video {
  id: string; // uuid PK
  course_id: string; // FK to courses.id
  title: string;
  description: string;
  thumbnail_url: string | null;
  camera_video_url: string;
  snapshot_url: string | null;
  event_url: string | null;
  transcript_url: string | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  ispublic: boolean;
  created_at: string;
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
  snapshot_url?: string;
  event_url?: string;
  transcript_url?: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  ispublic?: boolean;
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  camera_video_url?: string;
  thumbnail_url?: string;
  snapshot_url?: string;
  event_url?: string;
  transcript_url?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
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
