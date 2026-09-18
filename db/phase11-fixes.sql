-- Phase 11: audit fixes
-- Email logs: the old self-view policy read auth.users, which authenticated
-- users may not select from (42501 permission denied for table users).
-- Use the JWT email claim instead.

DROP POLICY IF EXISTS "Users can view their email logs" ON public.email_logs;

CREATE POLICY "Users can view their email logs" ON public.email_logs
  FOR SELECT
  TO authenticated
  USING (recipient_email = (auth.jwt() ->> 'email'));

GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
