-- Migration: Add streak_count and last_login to students table
-- Date: 2024

-- Add streak_count column (default 0)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0 NOT NULL;

-- Add last_login column (nullable date)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS last_login DATE;

-- Add comment to streak_count
COMMENT ON COLUMN students.streak_count IS 'Daily login streak count';

-- Add comment to last_login
COMMENT ON COLUMN students.last_login IS 'Last login date (YYYY-MM-DD format)';

-- Create index on last_login for better query performance
CREATE INDEX IF NOT EXISTS idx_students_last_login ON students(last_login);

