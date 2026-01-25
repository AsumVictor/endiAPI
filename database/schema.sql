-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.assignment_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type = ANY (ARRAY['pdf'::text, 'file'::text, 'link'::text])),
  url text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assignment_resources_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_resources_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id)
);
CREATE TABLE public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  lecturer_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'EXERCISE'::text CHECK (type = ANY (ARRAY['CAPSTONE'::text, 'EXERCISE'::text, 'MID_SEM'::text, 'FINAL_EXAM'::text])),
  title text NOT NULL,
  description text,
  start_time timestamp with time zone,
  duration_minutes integer,
  deadline timestamp with time zone,
  ai_allowed boolean DEFAULT false,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'processing'::text, 'ready_for_review'::text, 'published'::text, 'graded'::text])),
  total_types integer NOT NULL,
  generated_types integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT assignments_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.lecturers(id)
);
CREATE TABLE public.course_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid,
  student_id uuid,
  enrolled_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  thumbnail_url text,
  lecturer_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.lecturers(id)
);
CREATE TABLE public.discussion_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT discussion_messages_pkey PRIMARY KEY (id),
  CONSTRAINT discussion_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.discussion_threads(id),
  CONSTRAINT discussion_messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.discussion_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL,
  video_timestamp_seconds integer,
  student_id uuid NOT NULL,
  lecturer_id uuid NOT NULL,
  code_snippet text,
  question_text text NOT NULL,
  student_unread boolean DEFAULT false,
  lecturer_unread boolean DEFAULT true,
  status text DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT discussion_threads_pkey PRIMARY KEY (id),
  CONSTRAINT discussion_threads_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id),
  CONSTRAINT discussion_threads_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT discussion_threads_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.lecturers(id)
);
CREATE TABLE public.lecturers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  bio text,
  avatar_url text,
  classes_teaching ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lecturers_pkey PRIMARY KEY (id),
  CONSTRAINT lecturers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['MCQ'::text, 'Fill_in'::text, 'Essay'::text, 'Code'::text])),
  prompt_markdown text NOT NULL,
  content_json jsonb,
  points integer DEFAULT 1,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  answers jsonb,
  explanation text,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id)
);
CREATE TABLE public.student_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer_text text,
  selected_option text,
  code_submission text,
  language text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_answers_pkey PRIMARY KEY (id),
  CONSTRAINT student_answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.student_assignment_sessions(id),
  CONSTRAINT student_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.student_assignment_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  last_resumed_at timestamp with time zone,
  time_used_seconds integer NOT NULL DEFAULT 0,
  submitted_at timestamp with time zone,
  status text NOT NULL DEFAULT 'in_progress'::text CHECK (status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'expired'::text])),
  score numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_assignment_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT student_assignment_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_assignment_sessions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  class_year integer,
  major character varying,
  bio text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  streak_count integer NOT NULL DEFAULT 0,
  last_login date,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email character varying NOT NULL UNIQUE,
  role character varying DEFAULT 'student'::character varying CHECK (role::text = ANY (ARRAY['student'::character varying, 'lecturer'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
    );
CREATE TABLE public.video_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL,
  student_id uuid NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  CONSTRAINT video_progress_pkey PRIMARY KEY (id),
  CONSTRAINT video_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.videos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  thumbnail_url text,
  camera_video_url text NOT NULL,
  snapshot_url text,
  event_url text,
  level text NOT NULL CHECK (level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text])),
  ispublic boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  transcript_url text,
  CONSTRAINT videos_pkey PRIMARY KEY (id),
  CONSTRAINT videos_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);