-- Phase 12: Student sign-in with admission number only.
-- Run once on the live database.

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS portal_login_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.student_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  admission_number text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.student_login_attempts TO service_role;
ALTER TABLE public.student_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_student_login_attempts_ip ON public.student_login_attempts (ip, created_at DESC);

-- Students no longer use passwords, so never force a password change for them.
UPDATE public.profiles p SET must_change_password = false
WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'student');
