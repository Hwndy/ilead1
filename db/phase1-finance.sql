-- Phase 1: finance reliability
-- Run this in the Supabase SQL editor of the connected project.

-- 1. Fee structures can be retired instead of deleted -------------------------
ALTER TABLE public.fee_structures
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;

-- 2. Payroll periods allow the Approved step ----------------------------------
DO $$
DECLARE c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.payroll_periods'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.payroll_periods DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE public.payroll_periods
  ADD CONSTRAINT payroll_periods_status_check
  CHECK (status IN ('draft', 'processing', 'approved', 'paid', 'closed'));

-- 3. Offline payments keep a record of who entered them -----------------------
ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS recorded_by uuid;

-- 4. Finance delete access code lives in settings, not in browser code --------
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('finance_delete_code', '"iVintage2026"'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
