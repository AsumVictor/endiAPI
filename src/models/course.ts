// Course models and interfaces
export interface Course {
  id: string; // uuid PK
  title: string;
  description: string;
  thumbnail_url: string | null;
  lecturer_id: string; // FK to lecturers.id
  created_at: string;
}

export interface CourseEnrollment {
  id: string; // uuid PK
  course_id: string; // FK to courses.id
  student_id: string; // FK to students.id
  enrolled_at: string;
}

// Request/Response interfaces
export interface CreateCourseRequest {
  title: string;
  description: string;
  thumbnail_url?: string;
}

export interface UpdateCourseRequest {
  title?: string;
  description?: string;
  thumbnail_url?: string;
}

export interface CourseResponse {
  success: boolean;
  message: string;
  data?: Course | Course[] | CourseEnrollment[];
  error?: string;
}

export interface EnrollmentResponse {
  success: boolean;
  message: string;
  data?: CourseEnrollment;
  error?: string;
}

// Extended course with enrollment count
export interface CourseWithStats extends Course {
  enrollment_count: number;
  lecturer_name: string;
  lecturer_avatar?: string;
  is_enrolled: boolean;
  enrollment_date?: string;
}

// Student course with enrollment info
export interface StudentCourse extends Course {
  enrolled_at: string;
  lecturer_name: string;
}

// Browse courses request
export interface BrowseCoursesRequest {
  type: 'all_courses' | 'enrolled' | 'not_enrolled' | 'completed';
  page?: number;
  limit?: number;
  sort?: 'popular' | 'newest' | 'oldest' | 'title';
}

// Browse courses response
export interface BrowseCoursesResponse {
  success: boolean;
  message: string;
  data?: {
    courses: CourseWithStats[];
    pagination: {
      current_page: number;
      total_pages: number;
      total_items: number;
      items_per_page: number;
      has_next: boolean;
      has_prev: boolean;
    };
  };
  error?: string;
}

// Detailed course response with comprehensive information
export interface CourseDetails {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  created_at: string;
  
  // Lecturer information
  lecturer: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  
  // Course statistics
  total_videos: number;
  total_enrollments: number;
  is_enrolled: boolean; // Whether the requesting user is enrolled in this course
  
  // Videos information
  videos: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    level: 'beginner' | 'intermediate' | 'advanced';
    ispublic: boolean;
    created_at: string;
    is_watched: boolean; // Whether the requesting user has watched this video
    completed_at?: string; // When the user completed the video (if watched)
  }[];
}

// Course details response
export interface CourseDetailsResponse {
  success: boolean;
  message: string;
  data?: CourseDetails;
  error?: string;
}
