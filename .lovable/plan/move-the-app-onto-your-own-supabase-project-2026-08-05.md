# Move the app onto your own Supabase project

Goal: point this project at a separate Supabase database you own, with every feature still working  portal login, admissions, exams, fees/Paystack, report cards, hostel, library, HR/payroll, CMS website, PWA push.

## What has to move

The app depends on four things in the backend, not just the tables:

1. **Schema**  90+ tables plus enums, views, triggers, `SECURITY DEFINER` functions (`has_role`, `get_user_school_id`, `create_teacher_class_assignments`, etc.), RLS policies and Data-API grants. All of it already exists as 118 migration files in `supabase/migrations`.
2. **Storage buckets**  `admission-documents`, `assignments`, and the media/CMS buckets, with their policies.
3. **Edge functions**  28 functions (Paystack init/verify + webhook, offer letters, OTP, bulk email/SMS, report cards, staff/student/parent account creation, push, fee reminders) plus their `verify_jwt` settings in `supabase/config.toml`.
4. **Secrets**  new values you'll supply for `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `SENDER_EMAIL`, `REPLY_TO_EMAIL`, `FRONTEND_URL`, `STAFF_REGISTRATION_CODE`, and the push/VAPID keys.

Auth users do **not** carry over (you chose reference data only), so the new database starts with zero accounts  a first admin has to be created.

## Steps

**1. You create the Supabase project and connect it**
Create the project in your Supabase dashboard, then connect it to this Lovable project via the Supabase integration (Settings → Integrations). Once connected, I can run migrations and deploy functions straight into it.

**2. Rebuild the schema**
Replay the existing migration history into the new database, then verify: every `public` table has GRANTs for `authenticated`/`service_role` (and `anon` only where a public-read policy exists), RLS is enabled everywhere, and the security-definer role functions exist. Run the security linter at the end.

**3. Recreate storage buckets and their policies**
`admission-documents` (private), `assignments`, and the public media bucket used by CMS/gallery/photo uploads.

**4. Repoint the frontend**
Update `src/integrations/supabase/client.ts` (URL + publishable key), `supabase/config.toml` (`project_id`), `.env` / `VITE_FRONTEND_URL`, and the few remaining hardcoded `irrxmoqbgygyyzozifdl` strings in `src/contexts/AuthContext.tsx` (localStorage key), `scripts/generate-sitemap.ts` and the docs files. Regenerate `src/integrations/supabase/types.ts` from the new schema.

**5. Deploy the 28 edge functions and set secrets**
Deploy with the same `verify_jwt` config, then I'll request the new secret values through the secure form. Paystack webhook URL changes with the project ref  you'll need to update it in the Paystack dashboard.

**6. Seed reference data**
Classes, subjects, `school_info` / `website_settings` / `website_pages` / `website_sections` (iVintage branding, contacts, CMS copy), notification templates, fee structures, grading/result-automation settings, revenue & expense categories. No students, staff, parents, exams, results or payment records.

**7. Bootstrap and verify**
Create the first admin account (auth user + `profiles` + `user_roles`), then walk the app end-to-end: login → admin dashboard → create class/subject → enrol a test student → admissions form → exam create/take → fee payment (Paystack test mode) → report card PDF → website pages.

## Technical notes

- Migration replay is the safest route because it reproduces triggers and policies exactly; a plain schema dump tends to drop `SECURITY DEFINER` ownership and grants.
- Auth settings must be re-set on the new project: site URL, redirect URLs (`/reset-password`), email templates, and leaked-password protection.
- Reference data is copied as SQL `INSERT`s generated from the current database, with IDs preserved so CMS section references stay intact.
- The old database stays untouched, so we can roll back by reverting the client config.

## What I need from you

- The new project's URL + publishable (anon) key, via the Supabase integration connection.
- Confirmation of which storage/CMS media files should be re-uploaded (image URLs currently point at the old project's storage; those need re-hosting or replacing).
