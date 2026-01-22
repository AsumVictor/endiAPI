-- Migration: Add deadline column and graded status to assignments
-- Date: 2026-01-15
-- Notes:
-- - deadline is nullable
-- - adds 'graded' as a valid assignment status

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;

-- Update status check constraint to include 'graded'
-- The default constraint name for the inline CHECK is typically: assignments_status_check
ALTER TABLE public.assignments
DROP CONSTRAINT IF EXISTS assignments_status_check;

ALTER TABLE public.assignments
ADD CONSTRAINT assignments_status_check
CHECK (status = ANY (ARRAY['draft', 'processing', 'ready_for_review', 'published', 'graded']));

