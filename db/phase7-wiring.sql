-- Phase 7: wire the new billing model into payments
-- Safe to run more than once.

-- Payments can now be attached to a termly invoice.
alter table public.fee_payments add column if not exists invoice_id uuid references public.student_invoices(id) on delete set null;
create index if not exists fee_payments_invoice_idx on public.fee_payments(invoice_id);

-- Keep an invoice's paid total in step with its payments.
create or replace function public.sync_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
  paid numeric(12,2);
  total numeric(12,2);
begin
  if target is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount_paid), 0) into paid
  from public.fee_payments
  where invoice_id = target and status = 'completed';

  select total_amount into total from public.student_invoices where id = target;

  update public.student_invoices
     set amount_paid = paid,
         status = case
           when paid <= 0 then 'open'
           when paid >= coalesce(total, 0) then 'paid'
           else 'part_paid'
         end
   where id = target and status <> 'cancelled';

  return coalesce(new, old);
end;
$$;

drop trigger if exists fee_payments_sync_invoice on public.fee_payments;
create trigger fee_payments_sync_invoice
after insert or update or delete on public.fee_payments
for each row execute function public.sync_invoice_paid();

-- Applicant identity carried onto the pupil record at enrolment.
alter table public.students add column if not exists nin text;
alter table public.students add column if not exists admission_application_id uuid;

-- Enrolment now carries the applicant's NIN and links back to the application.
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

  IF a.student_id IS NOT NULL THEN
    SELECT id INTO v_student_id FROM public.students WHERE id = a.student_id;
    IF v_student_id IS NOT NULL THEN
      UPDATE public.students
         SET nin = COALESCE(nin, a.nin),
             admission_application_id = COALESCE(admission_application_id, a.id)
       WHERE id = v_student_id;
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
    blood_group, address, emergency_contact, medical_info, is_boarder, status,
    nin, admission_application_id
  ) VALUES (
    v_admission_no, a.application_number, CURRENT_DATE, a.date_of_birth, a.gender,
    a.blood_group, COALESCE(a.address, '{}'::jsonb),
    COALESCE(a.parent_guardian_info->'emergency_contact', '{}'::jsonb),
    jsonb_build_object('medical_conditions', a.medical_conditions, 'allergies', a.allergies),
    COALESCE(a.boarding_interest, false), 'active',
    a.nin, a.id
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
