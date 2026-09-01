
-- ============================================================
-- ACADEMIC FLOW OVERHAUL  Phase 1: Sessions/Terms spine,
-- assessment categories, question taxonomy, unified results view
-- ============================================================

-- 1) admission_sessions: mark a current session per school
ALTER TABLE public.admission_sessions
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS admission_sessions_one_current_per_school
  ON public.admission_sessions(school_id)
  WHERE is_current = true;

-- 2) Term + session linkage on exams
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.admission_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS term text CHECK (term IN ('first','second','third')),
  ADD COLUMN IF NOT EXISTS assessment_category text
    CHECK (assessment_category IN ('test1','test2','exam','ca','mock','other'));

CREATE INDEX IF NOT EXISTS exams_session_term_idx ON public.exams(session_id, term);
CREATE INDEX IF NOT EXISTS exams_subject_class_idx ON public.exams(subject_id, class_id);

-- 3) Term + session linkage on gradebook_entries (already has term/academic_year text)
ALTER TABLE public.gradebook_entries
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.admission_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gradebook_entries_session_term_idx
  ON public.gradebook_entries(session_id, term);

-- Backfill session_id from academic_year text where possible
UPDATE public.gradebook_entries ge
SET session_id = s.id
FROM public.admission_sessions s
WHERE ge.session_id IS NULL
  AND ge.school_id = s.school_id
  AND ge.academic_year IS NOT NULL
  AND (s.academic_year = ge.academic_year OR s.session_name = ge.academic_year);

-- 4) Question taxonomy: topic + tags + direct subject_id
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS questions_subject_class_idx ON public.questions(subject_id, class_id);
CREATE INDEX IF NOT EXISTS questions_topic_idx ON public.questions(topic);
CREATE INDEX IF NOT EXISTS questions_tags_gin ON public.questions USING GIN (tags);

-- Backfill questions.subject_id from question_banks
UPDATE public.questions q
SET subject_id = qb.subject_id
FROM public.question_banks qb
WHERE q.subject_id IS NULL
  AND q.question_bank_id = qb.id
  AND qb.subject_id IS NOT NULL;

-- 5) Helper: get current session for a school
CREATE OR REPLACE FUNCTION public.get_current_session(p_school_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.admission_sessions
  WHERE school_id = p_school_id AND is_current = true
  LIMIT 1
$$;

-- 6) Fix existing SECURITY DEFINER functions missing search_path (safe hardening)
CREATE OR REPLACE FUNCTION public.grade_question_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  question_record RECORD;
  is_answer_correct BOOLEAN := false;
  points_to_award INTEGER := 0;
BEGIN
  SELECT q.*, eq.points INTO question_record
  FROM public.questions q
  JOIN public.exam_questions eq ON eq.question_id = q.id
  JOIN public.exam_sessions es ON es.exam_id = eq.exam_id
  WHERE q.id = NEW.question_id AND es.id = NEW.session_id;

  IF question_record.question_type IN ('mcq', 'true_false') THEN
    SELECT is_correct INTO is_answer_correct
    FROM public.question_options
    WHERE id = NEW.selected_option_id;
    IF is_answer_correct THEN
      points_to_award := question_record.points;
    END IF;
  ELSIF question_record.question_type = 'fill_blank' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.question_options qo
      WHERE qo.question_id = NEW.question_id
      AND qo.is_correct = true
      AND LOWER(TRIM(qo.option_text)) = LOWER(TRIM(NEW.text_answer))
    ) INTO is_answer_correct;
    IF is_answer_correct THEN
      points_to_award := question_record.points;
    END IF;
  END IF;

  NEW.is_correct := is_answer_correct;
  NEW.points_earned := points_to_award;
  RETURN NEW;
END;
$function$;

-- 7) Unified results view
-- Combines manual gradebook_entries (test1/test2/exam_score) with online
-- exam_sessions (mapped via exams.assessment_category).
CREATE OR REPLACE VIEW public.v_student_term_scores AS
WITH online_scores AS (
  SELECT
    es.student_id,
    e.school_id,
    e.session_id,
    e.term,
    e.class_id,
    e.subject_id,
    e.assessment_category,
    es.percentage,
    es.total_score,
    es.max_score
  FROM public.exam_sessions es
  JOIN public.exams e ON e.id = es.exam_id
  WHERE es.status = 'completed'
    AND e.assessment_category IN ('test1','test2','exam')
    AND e.session_id IS NOT NULL
    AND e.term IS NOT NULL
),
online_pivot AS (
  SELECT
    student_id, school_id, session_id, term, class_id, subject_id,
    MAX(CASE WHEN assessment_category = 'test1'
        THEN ROUND((percentage * 20.0 / 100.0)::numeric, 2) END) AS o_test1,
    MAX(CASE WHEN assessment_category = 'test2'
        THEN ROUND((percentage * 20.0 / 100.0)::numeric, 2) END) AS o_test2,
    MAX(CASE WHEN assessment_category = 'exam'
        THEN ROUND((percentage * 60.0 / 100.0)::numeric, 2) END) AS o_exam
  FROM online_scores
  GROUP BY student_id, school_id, session_id, term, class_id, subject_id
),
manual AS (
  SELECT
    student_id, school_id, session_id, term, class_id, subject_id,
    MAX(test1_score) AS m_test1,
    MAX(test2_score) AS m_test2,
    MAX(exam_score)  AS m_exam
  FROM public.gradebook_entries
  WHERE session_id IS NOT NULL AND term IS NOT NULL
  GROUP BY student_id, school_id, session_id, term, class_id, subject_id
),
combined AS (
  SELECT
    COALESCE(m.student_id, o.student_id)   AS student_id,
    COALESCE(m.school_id, o.school_id)     AS school_id,
    COALESCE(m.session_id, o.session_id)   AS session_id,
    COALESCE(m.term, o.term)               AS term,
    COALESCE(m.class_id, o.class_id)       AS class_id,
    COALESCE(m.subject_id, o.subject_id)   AS subject_id,
    COALESCE(m.m_test1, o.o_test1, 0)::numeric AS test1,
    COALESCE(m.m_test2, o.o_test2, 0)::numeric AS test2,
    COALESCE(m.m_exam,  o.o_exam,  0)::numeric AS exam_score
  FROM manual m
  FULL OUTER JOIN online_pivot o
    ON m.student_id = o.student_id
   AND m.session_id = o.session_id
   AND m.term       = o.term
   AND m.subject_id = o.subject_id
)
SELECT
  c.*,
  (c.test1 + c.test2 + c.exam_score)::numeric AS total,
  RANK() OVER (
    PARTITION BY c.school_id, c.session_id, c.term, c.class_id, c.subject_id
    ORDER BY (c.test1 + c.test2 + c.exam_score) DESC
  ) AS subject_position
FROM combined c;

GRANT SELECT ON public.v_student_term_scores TO authenticated;
GRANT ALL    ON public.v_student_term_scores TO service_role;
