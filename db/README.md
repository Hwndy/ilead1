# Running this app on your own Supabase project

The app is now pointed at **`trtuqzdsutmindcjbkvj`** (`https://trtuqzdsutmindcjbkvj.supabase.co`).
Override with `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) to switch again.

## What has already been done

1. `db/setup.sql`  full schema rebuilt from the 118 migrations (96 tables, functions,
   triggers, 259 RLS policies, reference data).
2. `db/setup-part2.sql`  tables that existed live but had no migration file
   (`timetable_templates`, `periods`, `rooms`, `class_timetables`, `assessment_types`,
   `assessments`, `grades`, `grade_comments`, `rate_limits`), their RLS policies,
   the `assignments` storage bucket, and Data-API grants.
3. `db/seed-ivintage.sql`  iVintage College branding, contact details and CMS settings.
4. Storage buckets: `question-media`, `exam-attachments`, `admission-documents` (public),
   `assignments`.
5. First admin account created (`suleayo04@gmail.com`) with a forced password change on
   first login.

Schema parity was verified: all 1100 columns expected by `src/integrations/supabase/types.ts`
exist, and every RPC the app calls is present.

To re-run from scratch on another project:

```bash
psql "$DB_URL" -f db/setup.sql
psql "$DB_URL" -f db/setup-part2.sql
psql "$DB_URL" -f db/seed-ivintage.sql
```

## Remaining step: edge functions

The 28 functions in `supabase/functions/` must be deployed to the new project with the
Supabase CLI (they are not deployed automatically to an external project):

```bash
supabase login
supabase link --project-ref trtuqzdsutmindcjbkvj
supabase functions deploy          # deploys all functions, honours supabase/config.toml
```

Then add the function secrets in the Supabase dashboard
(Project Settings → Edge Functions → Secrets):

`PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `SENDER_EMAIL`, `REPLY_TO_EMAIL`,
`FRONTEND_URL`, `STAFF_REGISTRATION_CODE`, plus any push/SMS keys in use
(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, SMS provider keys).

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by
Supabase automatically.

## Auth settings

In Authentication → URL Configuration set:

- Site URL: `https://ivintage.vercel.app`
- Redirect URLs: `https://ivintage.vercel.app/**`, `http://localhost:8080/**`
