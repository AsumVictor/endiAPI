-- Migration: Add assignment type to assignments
-- Date: 2026-01-22
-- Adds:
-- - type: CAPSTONE | EXERCISE | MID_SEM | FINAL_EXAM
-- Notes:
-- - default is EXERCISE for backward compatibility

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'EXERCISE';

-- Add/update check constraint for assignment type
-- The default constraint name for the inline CHECK is typically: assignments_type_check
ALTER TABLE public.assignments
DROP CONSTRAINT IF EXISTS assignments_type_check;

ALTER TABLE public.assignments
ADD CONSTRAINT assignments_type_check
CHECK (type = ANY (ARRAY['CAPSTONE', 'EXERCISE', 'MID_SEM', 'FINAL_EXAM']));

