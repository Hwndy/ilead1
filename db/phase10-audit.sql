-- ============================================================
-- Phase 10 — platform audit trail
-- Safe to run more than once.
-- ============================================================

-- 1. Helper so the app and edge functions can record actions that
--    have no table write of their own (sign-in, emails sent, exports...).
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_table_name text DEFAULT NULL,
  p_row_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_id uuid;
BEGIN
  BEGIN
    SELECT email::text INTO v_email FROM auth.users WHERE id = v_actor;
  EXCEPTION WHEN OTHERS THEN v_email := NULL;
  END;

  INSERT INTO public.audit_logs (actor_id, actor_email, action, table_name, row_id, metadata)
  VALUES (v_actor, v_email, p_action, p_table_name, p_row_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated, anon, service_role;

-- 2. Wider trigger coverage on the tables administrators care about.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'exams',
    'exam_results',
    'gradebook_entries',
    'profiles',
    'staff_details',
    'classes',
    'subjects',
    'fee_payments',
    'fee_invoices',
    'admission_applications',
    'website_settings',
    'news_articles'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
           FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_writes()', t);
    END IF;
  END LOOP;
END;
$$;

-- 3. Indexes for the audit screen filters.
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_email ON public.audit_logs (actor_email);

-- 4. Make sure the Data API can read/insert.
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
