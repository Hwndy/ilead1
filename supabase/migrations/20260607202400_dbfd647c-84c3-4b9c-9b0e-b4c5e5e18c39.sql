
-- ============================================================
-- 1. Backfill orphan school_id values (defensive  current data shows 0)
-- ============================================================
UPDATE public.admission_applications a
SET school_id = c.school_id
FROM public.classes c
WHERE a.school_id IS NULL AND a.applying_for_class_id = c.id;

UPDATE public.admission_applications
SET school_id = (SELECT id FROM public.schools ORDER BY created_at LIMIT 1)
WHERE school_id IS NULL;

UPDATE public.admission_documents d
SET school_id = a.school_id
FROM public.admission_applications a
WHERE d.school_id IS NULL AND d.application_id = a.id;

UPDATE public.admission_payments p
SET school_id = a.school_id
FROM public.admission_applications a
WHERE p.school_id IS NULL AND p.application_id = a.id;

UPDATE public.admission_offers o
SET school_id = a.school_id
FROM public.admission_applications a
WHERE o.school_id IS NULL AND o.application_id = a.id;

UPDATE public.admission_interviews i
SET school_id = a.school_id
FROM public.admission_applications a
WHERE i.school_id IS NULL AND i.application_id = a.id;

UPDATE public.admission_workflow_logs w
SET school_id = a.school_id
FROM public.admission_applications a
WHERE w.school_id IS NULL AND w.application_id = a.id;

-- ============================================================
-- 2. Enforce NOT NULL school_id on the whole admission stack
-- ============================================================
ALTER TABLE public.admission_applications  ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.admission_documents     ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.admission_payments      ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.admission_offers        ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.admission_interviews    ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.admission_workflow_logs ALTER COLUMN school_id SET NOT NULL;

-- ============================================================
-- 3. Auto-populate school_id triggers for child tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_populate_school_id_admission_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.school_id IS NULL AND NEW.application_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id
    FROM public.admission_applications
    WHERE id = NEW.application_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admission_documents_school_id ON public.admission_documents;
CREATE TRIGGER trg_admission_documents_school_id
  BEFORE INSERT ON public.admission_documents
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

DROP TRIGGER IF EXISTS trg_admission_payments_school_id ON public.admission_payments;
CREATE TRIGGER trg_admission_payments_school_id
  BEFORE INSERT ON public.admission_payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

DROP TRIGGER IF EXISTS trg_admission_offers_school_id ON public.admission_offers;
CREATE TRIGGER trg_admission_offers_school_id
  BEFORE INSERT ON public.admission_offers
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

DROP TRIGGER IF EXISTS trg_admission_interviews_school_id ON public.admission_interviews;
CREATE TRIGGER trg_admission_interviews_school_id
  BEFORE INSERT ON public.admission_interviews
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

DROP TRIGGER IF EXISTS trg_admission_workflow_logs_school_id ON public.admission_workflow_logs;
CREATE TRIGGER trg_admission_workflow_logs_school_id
  BEFORE INSERT ON public.admission_workflow_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_populate_school_id_admission_child();

-- ============================================================
-- 4. Clean up duplicate / leaky RLS policies
-- ============================================================
-- admission_documents
DROP POLICY IF EXISTS "Admins can manage admission documents" ON public.admission_documents;
DROP POLICY IF EXISTS "Admins can manage documents"          ON public.admission_documents;
DROP POLICY IF EXISTS "Public can upload documents during application" ON public.admission_documents;
DROP POLICY IF EXISTS "Public can upload documents"          ON public.admission_documents;

CREATE POLICY "Admins manage docs in their school"
  ON public.admission_documents
  FOR ALL
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin())
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

CREATE POLICY "Public can upload docs during application"
  ON public.admission_documents
  FOR INSERT
  WITH CHECK (true);

-- admission_payments
DROP POLICY IF EXISTS "Admins can manage payments" ON public.admission_payments;
CREATE POLICY "Admins manage payments in their school"
  ON public.admission_payments
  FOR ALL
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin())
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

-- admission_offers
DROP POLICY IF EXISTS "Admins can manage offers" ON public.admission_offers;
CREATE POLICY "Admins manage offers in their school"
  ON public.admission_offers
  FOR ALL
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin())
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

-- admission_interviews
DROP POLICY IF EXISTS "Admins can manage interviews" ON public.admission_interviews;
CREATE POLICY "Admins manage interviews in their school"
  ON public.admission_interviews
  FOR ALL
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin())
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

-- admission_workflow_logs (tighten admin scope too)
DROP POLICY IF EXISTS "Admins can view workflow logs"  ON public.admission_workflow_logs;
DROP POLICY IF EXISTS "Admins can create workflow logs" ON public.admission_workflow_logs;
CREATE POLICY "Admins view workflow logs in their school"
  ON public.admission_workflow_logs
  FOR SELECT
  USING (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());
CREATE POLICY "Admins create workflow logs in their school"
  ON public.admission_workflow_logs
  FOR INSERT
  WITH CHECK (((school_id = get_user_school_id()) AND is_admin()) OR is_super_admin());

-- ============================================================
-- 5. Secure RPC: submit_admission_application (public-callable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_admission_application(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_class_id  uuid;
  v_session_id uuid;
  v_new_id    uuid;
  v_app_no    text;
BEGIN
  v_class_id   := NULLIF(payload->>'applying_for_class_id','')::uuid;
  v_session_id := NULLIF(payload->>'session_id','')::uuid;

  -- Resolve school_id: class -> session -> first active session -> error
  IF v_class_id IS NOT NULL THEN
    SELECT school_id INTO v_school_id FROM public.classes WHERE id = v_class_id;
  END IF;

  IF v_school_id IS NULL AND v_session_id IS NOT NULL THEN
    SELECT school_id INTO v_school_id FROM public.admission_sessions WHERE id = v_session_id;
  END IF;

  IF v_school_id IS NULL THEN
    SELECT school_id INTO v_school_id
    FROM public.admission_sessions
    WHERE status = 'active'
    ORDER BY start_date DESC
    LIMIT 1;
  END IF;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Unable to determine school for application. Please contact the school.';
  END IF;

  INSERT INTO public.admission_applications (
    application_number, school_id, status,
    first_name, middle_name, last_name,
    date_of_birth, gender, blood_group,
    state_of_origin, lga, nationality, religion,
    email, phone, address,
    previous_school, previous_class, applying_for_class_id,
    parent_guardian_info, medical_conditions, allergies, special_needs
  ) VALUES (
    '', v_school_id, 'submitted',
    payload->>'first_name', payload->>'middle_name', payload->>'last_name',
    (payload->>'date_of_birth')::date,
    payload->>'gender', payload->>'blood_group',
    payload->>'state_of_origin', payload->>'lga',
    COALESCE(payload->>'nationality','Nigerian'),
    payload->>'religion',
    payload->>'email', payload->>'phone',
    COALESCE(payload->'address', '{}'::jsonb),
    payload->>'previous_school', payload->>'previous_class',
    v_class_id,
    COALESCE(payload->'parent_guardian_info', '{}'::jsonb),
    payload->>'medical_conditions', payload->>'allergies', payload->>'special_needs'
  )
  RETURNING id, application_number INTO v_new_id, v_app_no;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'application_number', v_app_no,
    'school_id', v_school_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_admission_application(jsonb) TO anon, authenticated;

-- ============================================================
-- 6. Secure RPC: get_application_tracking (public-callable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_application_tracking(p_app_no text, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'application_number', a.application_number,
    'first_name', a.first_name,
    'last_name', a.last_name,
    'email', a.email,
    'status', a.status,
    'application_date', a.application_date,
    'applying_for_class_id', a.applying_for_class_id,
    'class_name', c.name,
    'school_id', a.school_id,
    'school_name', s.name,
    'offer', (
      SELECT jsonb_build_object(
        'id', o.id, 'status', o.status,
        'offer_date', o.offer_date, 'response_deadline', o.response_deadline
      )
      FROM public.admission_offers o
      WHERE o.application_id = a.id
      ORDER BY o.created_at DESC LIMIT 1
    ),
    'payment', (
      SELECT jsonb_build_object(
        'id', p.id, 'status', p.status, 'amount', p.amount
      )
      FROM public.admission_payments p
      WHERE p.application_id = a.id
      ORDER BY p.created_at DESC LIMIT 1
    )
  ) INTO v_app
  FROM public.admission_applications a
  LEFT JOIN public.classes c ON c.id = a.applying_for_class_id
  LEFT JOIN public.schools s ON s.id = a.school_id
  WHERE lower(a.application_number) = lower(p_app_no)
    AND lower(a.email)              = lower(p_email);

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_app;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_tracking(text, text) TO anon, authenticated;

-- ============================================================
-- 7. Secure RPC: transition_admission_status (admin-only state machine)
-- ============================================================
CREATE OR REPLACE FUNCTION public.transition_admission_status(
  p_application_id uuid,
  p_new_status     admission_status,
  p_notes          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current admission_status;
  v_school  uuid;
  v_allowed boolean := false;
BEGIN
  SELECT status, school_id INTO v_current, v_school
  FROM public.admission_applications
  WHERE id = p_application_id;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF NOT (is_super_admin() OR (is_admin() AND v_school = get_user_school_id())) THEN
    RAISE EXCEPTION 'Not authorized to update this application';
  END IF;

  -- State machine
  v_allowed := CASE
    WHEN p_new_status = 'withdrawn' THEN true
    WHEN v_current = 'submitted'             AND p_new_status IN ('under_review','rejected') THEN true
    WHEN v_current = 'under_review'          AND p_new_status IN ('interview_scheduled','accepted','rejected') THEN true
    WHEN v_current = 'interview_scheduled'   AND p_new_status IN ('accepted','rejected') THEN true
    WHEN v_current = 'accepted'              AND p_new_status = 'payment_pending' THEN true
    WHEN v_current = 'payment_pending'       AND p_new_status = 'enrolled' THEN true
    WHEN v_current = p_new_status            THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', v_current, p_new_status;
  END IF;

  UPDATE public.admission_applications
  SET status = p_new_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = COALESCE(p_notes, review_notes),
      updated_at = now()
  WHERE id = p_application_id;

  -- workflow log (trigger log_admission_status_change should also fire)
  INSERT INTO public.admission_workflow_logs (application_id, from_status, to_status, changed_by, notes, school_id)
  VALUES (p_application_id, v_current::text, p_new_status::text, auth.uid(), p_notes, v_school)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'from', v_current, 'to', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_admission_status(uuid, admission_status, text) TO authenticated;
