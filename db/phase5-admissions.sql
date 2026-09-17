-- ============================================================
-- Phase 5 — Admissions and enrolment reliability
-- Safe to run more than once.
-- ============================================================

-- 1. NIN + document completeness on the application ----------
ALTER TABLE public.admission_applications
  ADD COLUMN IF NOT EXISTS nin text,
  ADD COLUMN IF NOT EXISTS documents_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS documents_reviewed_at timestamptz;

ALTER TABLE public.admission_applications
  DROP CONSTRAINT IF EXISTS admission_applications_nin_format;
ALTER TABLE public.admission_applications
  ADD CONSTRAINT admission_applications_nin_format
  CHECK (nin IS NULL OR nin ~ '^[0-9]{11}$');

ALTER TABLE public.admission_applications
  DROP CONSTRAINT IF EXISTS admission_applications_documents_status_check;
ALTER TABLE public.admission_applications
  ADD CONSTRAINT admission_applications_documents_status_check
  CHECK (documents_status IN ('pending','verified','rejected','incomplete'));

-- 2. Document verification states ----------------------------
ALTER TABLE public.admission_documents
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.admission_documents
  DROP CONSTRAINT IF EXISTS admission_documents_verification_status_check;
ALTER TABLE public.admission_documents
  ADD CONSTRAINT admission_documents_verification_status_check
  CHECK (verification_status IN ('pending','verified','rejected'));

UPDATE public.admission_documents
   SET verification_status = 'verified'
 WHERE verified IS TRUE AND verification_status = 'pending';

-- 3. Which documents are compulsory --------------------------
CREATE TABLE IF NOT EXISTS public.admission_document_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL UNIQUE,
  label text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admission_document_requirements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_document_requirements TO authenticated;
GRANT ALL ON public.admission_document_requirements TO service_role;

ALTER TABLE public.admission_document_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read document requirements" ON public.admission_document_requirements;
CREATE POLICY "Anyone can read document requirements"
  ON public.admission_document_requirements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage document requirements" ON public.admission_document_requirements;
CREATE POLICY "Admins manage document requirements"
  ON public.admission_document_requirements FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.admission_document_requirements (document_type, label, is_required, sort_order)
VALUES
  ('birth_certificate',        'Birth certificate / age declaration', true,  1),
  ('previous_school_report',   'Previous school report or result',    true,  2),
  ('passport_photo',           'Recent passport photograph',          true,  3),
  ('medical_certificate',      'Medical report',                      false, 4)
ON CONFLICT (document_type) DO NOTHING;

-- 4. Offline payment bookkeeping -----------------------------
ALTER TABLE public.admission_payments
  ADD COLUMN IF NOT EXISTS recorded_by uuid,
  ADD COLUMN IF NOT EXISTS recorded_offline boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

-- 5. Application submission now stores the NIN ---------------
CREATE OR REPLACE FUNCTION public.submit_admission_application(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class_id uuid; v_new_id uuid; v_app_no text; v_nin text;
BEGIN
  v_class_id := NULLIF(payload->>'applying_for_class_id','')::uuid;
  v_nin := NULLIF(regexp_replace(COALESCE(payload->>'nin',''), '\D', '', 'g'), '');

  IF v_nin IS NOT NULL AND v_nin !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'The National Identification Number must be 11 digits.';
  END IF;

  INSERT INTO public.admission_applications (
    application_number, status, first_name, middle_name, last_name,
    date_of_birth, gender, blood_group, state_of_origin, lga, nationality, religion,
    email, phone, address, previous_school, previous_class, applying_for_class_id,
    parent_guardian_info, medical_conditions, allergies, special_needs, boarding_interest, nin
  ) VALUES (
    NULL, 'submitted', payload->>'first_name', payload->>'middle_name', payload->>'last_name',
    (payload->>'date_of_birth')::date, payload->>'gender', payload->>'blood_group',
    payload->>'state_of_origin', payload->>'lga', COALESCE(payload->>'nationality','Nigerian'),
    payload->>'religion', payload->>'email', payload->>'phone',
    COALESCE(payload->'address','{}'::jsonb), payload->>'previous_school', payload->>'previous_class',
    v_class_id, COALESCE(payload->'parent_guardian_info','{}'::jsonb),
    payload->>'medical_conditions', payload->>'allergies', payload->>'special_needs',
    COALESCE((payload->>'boarding_interest')::boolean, false), v_nin
  ) RETURNING id, application_number INTO v_new_id, v_app_no;

  RETURN jsonb_build_object('id', v_new_id, 'application_number', v_app_no);
END $$;

GRANT EXECUTE ON FUNCTION public.submit_admission_application(jsonb) TO anon, authenticated;

-- 6. Admin review of a single document -----------------------
CREATE OR REPLACE FUNCTION public.review_admission_document(
  p_document_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_app uuid; v_pending int; v_rejected int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending','verified','rejected') THEN
    RAISE EXCEPTION 'Unknown document status %', p_status;
  END IF;
  IF p_status = 'rejected' AND COALESCE(btrim(p_reason),'') = '' THEN
    RAISE EXCEPTION 'A reason is required when rejecting a document.';
  END IF;

  UPDATE public.admission_documents
     SET verification_status = p_status,
         rejection_reason = CASE WHEN p_status = 'rejected' THEN btrim(p_reason) ELSE NULL END,
         verified = (p_status = 'verified'),
         verified_by = auth.uid(),
         verified_at = CASE WHEN p_status = 'pending' THEN NULL ELSE now() END
   WHERE id = p_document_id
   RETURNING application_id INTO v_app;

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT count(*) FILTER (WHERE d.verification_status = 'pending'),
         count(*) FILTER (WHERE d.verification_status = 'rejected')
    INTO v_pending, v_rejected
    FROM public.admission_documents d
   WHERE d.application_id = v_app;

  UPDATE public.admission_applications
     SET documents_status = CASE
           WHEN v_rejected > 0 THEN 'rejected'
           WHEN v_pending > 0 THEN 'pending'
           ELSE 'verified' END,
         documents_reviewed_at = now()
   WHERE id = v_app;

  RETURN jsonb_build_object('application_id', v_app, 'pending', v_pending, 'rejected', v_rejected);
END $$;

GRANT EXECUTE ON FUNCTION public.review_admission_document(uuid, text, text) TO authenticated;

-- 7. Shared, idempotent enrolment routine --------------------
CREATE OR REPLACE FUNCTION public.enroll_applicant(p_application_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.admission_applications%ROWTYPE;
  v_student_id uuid;
  v_class_id uuid;
  v_admission_no text;
  v_year text := to_char(now(), 'YYYY');
  v_seq int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.admission_applications WHERE id = p_application_id;
  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Already enrolled: return the existing student (idempotent).
  IF a.student_id IS NOT NULL THEN
    SELECT id INTO v_student_id FROM public.students WHERE id = a.student_id;
    IF v_student_id IS NOT NULL THEN
      RETURN jsonb_build_object('student_id', v_student_id, 'created', false);
    END IF;
  END IF;

  v_class_id := COALESCE(a.admitted_to_class_id, a.applying_for_class_id);

  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(admission_number, '/', 3), '\D', '', 'g'), ''))::int, 0)
    INTO v_seq
    FROM public.students
   WHERE admission_number LIKE 'IVC/' || v_year || '/%';
  v_admission_no := 'IVC/' || v_year || '/' || lpad((COALESCE(v_seq,0) + 1)::text, 4, '0');

  INSERT INTO public.students (
    admission_number, registration_number, admission_date, date_of_birth, gender,
    blood_group, address, emergency_contact, medical_info, is_boarder, status
  ) VALUES (
    v_admission_no, a.application_number, CURRENT_DATE, a.date_of_birth, a.gender,
    a.blood_group, COALESCE(a.address, '{}'::jsonb),
    COALESCE(a.parent_guardian_info->'emergency_contact', '{}'::jsonb),
    jsonb_build_object('medical_conditions', a.medical_conditions, 'allergies', a.allergies),
    COALESCE(a.boarding_interest, false), 'active'
  ) RETURNING id INTO v_student_id;

  IF v_class_id IS NOT NULL THEN
    INSERT INTO public.class_assignments (student_id, class_id)
    SELECT v_student_id, v_class_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.class_assignments
      WHERE student_id = v_student_id AND class_id = v_class_id
    );
  END IF;

  UPDATE public.admission_applications
     SET student_id = v_student_id,
         status = 'enrolled',
         admission_date = CURRENT_DATE,
         admitted_to_class_id = COALESCE(admitted_to_class_id, v_class_id),
         updated_at = now()
   WHERE id = p_application_id;

  RETURN jsonb_build_object('student_id', v_student_id, 'created', true,
                            'admission_number', v_admission_no);
END $$;

GRANT EXECUTE ON FUNCTION public.enroll_applicant(uuid) TO authenticated, service_role;

-- 8. Offline acceptance payment ------------------------------
CREATE OR REPLACE FUNCTION public.record_offline_acceptance_payment(
  p_application_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payment_id uuid; v_enrol jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Enter an amount greater than zero.';
  END IF;
  IF p_method NOT IN ('cash','bank_transfer','pos','cheque') THEN
    RAISE EXCEPTION 'Unknown payment method %', p_method;
  END IF;

  INSERT INTO public.admission_payments (
    application_id, amount, payment_type, status, payment_method,
    payment_reference, paid_at, recorded_by, recorded_offline, notes
  ) VALUES (
    p_application_id, p_amount, 'acceptance_fee', 'completed', p_method,
    COALESCE(NULLIF(btrim(p_reference), ''), 'OFFLINE-' || to_char(now(), 'YYYYMMDDHH24MISS')),
    now(), auth.uid(), true, p_notes
  ) RETURNING id INTO v_payment_id;

  UPDATE public.admission_offers
     SET status = 'accepted', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
   WHERE application_id = p_application_id AND status <> 'accepted';

  v_enrol := public.enroll_applicant(p_application_id);

  RETURN jsonb_build_object('payment_id', v_payment_id, 'enrolment', v_enrol);
END $$;

GRANT EXECUTE ON FUNCTION public.record_offline_acceptance_payment(uuid, numeric, text, text, text) TO authenticated;
