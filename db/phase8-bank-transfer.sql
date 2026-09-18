-- Phase 8: bank transfer only (card payments removed)
-- Seeds the school bank account shown to parents and applicants.
-- Safe to re-run.

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES
  ('bank_name', to_jsonb('LOTUS BANK'::text)),
  ('bank_account_name', to_jsonb('IVINTAGE COLLEGE LTD'::text)),
  ('bank_account_number', to_jsonb('1012157409'::text))
ON CONFLICT (setting_key) DO NOTHING;
