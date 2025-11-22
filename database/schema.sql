-- Database schema for CodeEndelea LMS
-- This file contains the SQL schema for creating the necessary tables in Supabase

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Users table (from Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, -- This will be the Supabase Auth user ID
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'lecturer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    class_year INTEGER,
    major VARCHAR(255),
    bio TEXT,
    avatar_url TEXT,
    streak_count INTEGER DEFAULT 0 NOT NULL,
    last_login DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lecturers table
CREATE TABLE IF NOT EXISTS lecturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    classes_teaching TEXT[] DEFAULT '{}', -- e.g. ['ML', 'Python', 'Data Structures']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    thumbnail_url TEXT,
    lecturer_id UUID REFERENCES lecturers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Course enrollments table
CREATE TABLE IF NOT EXISTS course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(course_id, student_id) -- Prevent duplicate enrollments
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_last_login ON students(last_login);
CREATE INDEX IF NOT EXISTS idx_lecturers_user_id ON lecturers(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer_id ON courses(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_id ON course_enrollments(student_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Lecturers can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'lecturer'
        )
    );

-- RLS Policies for students table
CREATE POLICY "Students can view their own profile" ON students
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Students can insert their own profile" ON students
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update their own profile" ON students
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Lecturers can view all student profiles" ON students
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'lecturer'
        )
    );

-- RLS Policies for lecturers table
CREATE POLICY "Lecturers can view their own profile" ON lecturers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Lecturers can insert their own profile" ON lecturers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Lecturers can update their own profile" ON lecturers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "All authenticated users can view lecturer profiles" ON lecturers
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_students_updated_at 
    BEFORE UPDATE ON students 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lecturers_updated_at 
    BEFORE UPDATE ON lecturers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for courses table
CREATE POLICY "Anyone can view published courses" ON courses
    FOR SELECT USING (true);

CREATE POLICY "Lecturers can create courses" ON courses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lecturers 
            WHERE id = lecturer_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Course owners can update their courses" ON courses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM lecturers 
            WHERE id = lecturer_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Course owners can delete their courses" ON courses
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM lecturers 
            WHERE id = lecturer_id AND user_id = auth.uid()
        )
    );

-- RLS Policies for course_enrollments table
CREATE POLICY "Students can view their own enrollments" ON course_enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE id = student_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Students can enroll in courses" ON course_enrollments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM students 
            WHERE id = student_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Students can unenroll from courses" ON course_enrollments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE id = student_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Lecturers can view enrollments for their courses" ON course_enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM courses c
            JOIN lecturers l ON c.lecturer_id = l.id
            WHERE c.id = course_id AND l.user_id = auth.uid()
        )
    );

-- Comments for documentation
COMMENT ON TABLE users IS 'Main users table storing authentication and basic role information from Supabase Auth';
COMMENT ON TABLE students IS 'Student profiles with academic information';
COMMENT ON TABLE lecturers IS 'Lecturer profiles with teaching information';
COMMENT ON TABLE courses IS 'Courses created by lecturers';
COMMENT ON TABLE course_enrollments IS 'Student enrollments in courses';
COMMENT ON COLUMN users.role IS 'User role: student, lecturer, or admin';
COMMENT ON COLUMN students.class_year IS 'Year of study (e.g., 2024, 2025)';
COMMENT ON COLUMN students.major IS 'Academic major or field of study';
COMMENT ON COLUMN lecturers.classes_teaching IS 'Array of subjects/classes the lecturer teaches';
COMMENT ON COLUMN courses.lecturer_id IS 'Foreign key to lecturers table';
COMMENT ON COLUMN course_enrollments.course_id IS 'Foreign key to courses table';
COMMENT ON COLUMN course_enrollments.student_id IS 'Foreign key to students table';

-- Videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  thumbnail_url TEXT,
  camera_video_url TEXT NOT NULL,
  snapshot_url TEXT,
  event_url TEXT,
  transcript_url TEXT,
  level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  ispublic BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video progress tracking table
CREATE TABLE video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(video_id, student_id)
);

-- Create indexes for videos table
CREATE INDEX idx_videos_course_id ON videos(course_id);
CREATE INDEX idx_videos_level ON videos(level);
CREATE INDEX idx_videos_ispublic ON videos(ispublic);
CREATE INDEX idx_videos_created_at ON videos(created_at);

-- Create indexes for video_progress table
CREATE INDEX idx_video_progress_video_id ON video_progress(video_id);
CREATE INDEX idx_video_progress_student_id ON video_progress(student_id);
CREATE INDEX idx_video_progress_completed ON video_progress(completed);
CREATE INDEX idx_video_progress_completed_at ON video_progress(completed_at);

-- Enable Row Level Security for video tables
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for videos table
CREATE POLICY "Anyone can view public videos" ON videos
    FOR SELECT USING ("ispublic" = true);

CREATE POLICY "Lecturers can manage their course videos" ON videos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM courses c
            JOIN lecturers l ON c.lecturer_id = l.id
            WHERE c.id = course_id AND l.user_id = auth.uid()
        )
    );

CREATE POLICY "Enrolled students can view course videos" ON videos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM course_enrollments ce
            JOIN students s ON ce.student_id = s.id
            WHERE ce.course_id = course_id AND s.user_id = auth.uid()
        )
    );

-- RLS Policies for video_progress table
CREATE POLICY "Students can manage their own video progress" ON video_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = student_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Lecturers can view video progress for their courses" ON video_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM videos v
            JOIN courses c ON v.course_id = c.id
            JOIN lecturers l ON c.lecturer_id = l.id
            WHERE v.id = video_id AND l.user_id = auth.uid()
        )
    );

-- Comments for video tables
COMMENT ON TABLE videos IS 'Videos belonging to courses with metadata and content information';
COMMENT ON TABLE video_progress IS 'Student progress tracking for videos';
COMMENT ON COLUMN videos.course_id IS 'Foreign key reference to courses table';
COMMENT ON COLUMN videos.camera_video_url IS 'URL to the uploaded video content';
COMMENT ON COLUMN videos.snapshot_url IS 'URL to the video snapshot/image';
COMMENT ON COLUMN videos.event_url IS 'URL to the video event data';
COMMENT ON COLUMN videos.transcript_url IS 'URL to the video transcript';
COMMENT ON COLUMN videos.level IS 'Difficulty level: beginner, intermediate, or advanced';
COMMENT ON COLUMN videos.ispublic IS 'Whether the video is publicly visible';
COMMENT ON COLUMN video_progress.video_id IS 'Foreign key reference to videos table';
COMMENT ON COLUMN video_progress.student_id IS 'Foreign key reference to students table';
COMMENT ON COLUMN video_progress.completed IS 'Whether the student has completed the video';
COMMENT ON COLUMN video_progress.completed_at IS 'Timestamp when the student completed the video';
