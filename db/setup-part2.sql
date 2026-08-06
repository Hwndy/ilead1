-- ============================================================
-- Tables that exist in the live schema but had no migration file
-- (timetable, gradebook/assessments, rate limiting) + post-setup repairs.
-- Run AFTER db/setup.sql.
-- ============================================================

-- --- Timetable --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timetable_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  academic_year text NOT NULL,
  term text NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.timetable_templates(id) ON DELETE CASCADE,
  period_number integer NOT NULL,
  period_name text,
  period_type text DEFAULT 'lesson',
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_teaching_period boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number text NOT NULL,
  room_name text,
  room_type text DEFAULT 'classroom',
  capacity integer,
  facilities jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.timetable_templates(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id uuid,
  period_id uuid REFERENCES public.periods(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_timetables_class ON public.class_timetables(class_id);
CREATE INDEX IF NOT EXISTS idx_class_timetables_teacher ON public.class_timetables(teacher_id);
CREATE INDEX IF NOT EXISTS idx_periods_template ON public.periods(template_id);

-- --- Assessments / gradebook -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  weight numeric NOT NULL DEFAULT 0,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_type_id uuid NOT NULL REFERENCES public.assessment_types(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid,
  title text NOT NULL,
  description text,
  max_score numeric NOT NULL DEFAULT 100,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  score numeric NOT NULL,
  feedback text,
  graded_by uuid,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.grade_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  term text NOT NULL,
  comment text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- --- Rate limiting (used by OTP / public endpoints) --------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL,
  attempts integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (identifier, action)
);

-- --- RLS --------------------------------------------------------------------
ALTER TABLE public.timetable_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DO $pol$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['timetable_templates','periods','rooms','class_timetables',
                           'assessment_types','assessments','grades','grade_comments'] LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS "%1$s_read" ON public.%1$I;
      CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated USING (true);
      DROP POLICY IF EXISTS "%1$s_write" ON public.%1$I;
      CREATE POLICY "%1$s_write" ON public.%1$I FOR ALL TO authenticated
        USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
        WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));
    $f$, t);
  END LOOP;
END;
$pol$;

DROP POLICY IF EXISTS "rate_limits_service_only" ON public.rate_limits;
CREATE POLICY "rate_limits_service_only" ON public.rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- --- Repairs after the migration replay -------------------------------------
DO $repair$
DECLARE s_id uuid;
BEGIN
  SELECT id INTO s_id FROM public.schools WHERE subdomain = 'default' LIMIT 1;
  IF s_id IS NULL THEN
    INSERT INTO public.schools (name, subdomain, is_active, registration_token)
    VALUES ('iVintage College', 'default', true, '4250645')
    RETURNING id INTO s_id;
  END IF;

  UPDATE public.classes SET school_id = s_id WHERE school_id IS NULL;
  UPDATE public.subjects SET school_id = s_id WHERE school_id IS NULL;
  UPDATE public.app_settings SET school_id = s_id WHERE school_id IS NULL;
  UPDATE public.school_info SET school_id = s_id WHERE school_id IS NULL;
  UPDATE public.website_settings SET school_id = s_id WHERE school_id IS NULL;
EXCEPTION WHEN undefined_column THEN
  NULL;
END;
$repair$;

ALTER TABLE public.classes ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.subjects ALTER COLUMN school_id SET NOT NULL;

-- Grants for the newly created tables
DO $grants$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE c.relkind IN ('r','v') AND n.nspname='public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END;
$grants$;
