-- Migration: Create videos table from scratch
-- Date: 2024
-- Description: Creates the videos table and video_progress table with updated schema

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
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
  "ispublic" BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video progress tracking table
CREATE TABLE IF NOT EXISTS video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(video_id, student_id)
);

-- Create indexes for videos table
CREATE INDEX IF NOT EXISTS idx_videos_course_id ON videos(course_id);
CREATE INDEX IF NOT EXISTS idx_videos_level ON videos(level);
CREATE INDEX IF NOT EXISTS idx_videos_ispublic ON videos("ispublic");
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);

-- Create indexes for video_progress table
CREATE INDEX IF NOT EXISTS idx_video_progress_video_id ON video_progress(video_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_student_id ON video_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_completed ON video_progress(completed);
CREATE INDEX IF NOT EXISTS idx_video_progress_completed_at ON video_progress(completed_at);

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
COMMENT ON COLUMN videos."ispublic" IS 'Whether the video is publicly visible';
COMMENT ON COLUMN video_progress.video_id IS 'Foreign key reference to videos table';
COMMENT ON COLUMN video_progress.student_id IS 'Foreign key reference to students table';
COMMENT ON COLUMN video_progress.completed IS 'Whether the student has completed the video';
COMMENT ON COLUMN video_progress.completed_at IS 'Timestamp when the student completed the video';

