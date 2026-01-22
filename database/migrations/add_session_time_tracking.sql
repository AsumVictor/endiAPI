-- Migration: Add time tracking fields to student_assignment_sessions
-- Date: 2026-01-15
-- Adds:
-- - last_resumed_at: when the timer last started/resumed
-- - time_used_seconds: accumulated active time (seconds)

ALTER TABLE public.student_assignment_sessions
ADD COLUMN IF NOT EXISTS last_resumed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.student_assignment_sessions
ADD COLUMN IF NOT EXISTS time_used_seconds INTEGER NOT NULL DEFAULT 0;

