# Moving the portal to your own Supabase project

Everything the app needs on the backend is reproducible from this folder.

- `setup.sql` — full schema: 96 tables, 121 functions, all triggers, enums, views, RLS policies, storage buckets, Data API grants, plus the default classes / subjects / revenue & expense categories. Generated from the 118 files in `supabase/migrations`, with the old project's user-specific rows removed.
- `seed-ivintage.sql` — iVintage College branding, contact details and CMS settings.

## 1. Create the project

In your Supabase dashboard create a new project (choose a region close to Lagos, e.g. `eu-west-1`). Note down:

- Project URL — `https://<ref>.supabase.co`
- `anon` / publishable key
- `service_role` key (never put this in the frontend)

## 2. Build the database

Open **SQL Editor** in the new project and run, in order:

1. `db/setup.sql`
2. `db/seed-ivintage.sql`

Both are idempotent enough to re-run the seed, but `setup.sql` should only run once on an empty database.

## 3. Storage buckets

`setup.sql` creates these buckets and their policies:

| Bucket | Public | Used by |
| --- | --- | --- |
| `admission-documents` | no | admission form uploads, offer letters |
| `assignments` | no | assignment submissions |
| `question-media` | no | exam question images/audio |
| `exam-attachments` | no | exam attachments |
| media/CMS bucket | yes | website gallery, news, photo uploads |

Any images currently referenced by CMS rows that live in the old project's storage need to be re-uploaded through Admin → CMS.

## 4. Auth settings (Dashboard → Authentication)

- **URL Configuration**: Site URL = your published URL; add redirect URLs for `/reset-password` and `/`.
- **Email templates**: confirm signup + recovery.
- **Providers → Email**: enable "Prevent use of leaked passwords".
- Email confirmation: the portal creates accounts through edge functions, so keep auto-confirm **on** for admin-provisioned users.

## 5. Edge functions

The 28 functions in `supabase/functions` deploy with the Supabase CLI:

```bash
supabase login
supabase link --project-ref <your-ref>
supabase functions deploy            # deploys all functions
```

`supabase/config.toml` already carries the correct `verify_jwt` flag for each function — keep it in sync with the new `project_id`.

Then set the function secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set`):

| Secret | Notes |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | live or test secret key |
| `RESEND_API_KEY` | transactional email |
| `SENDER_EMAIL` / `REPLY_TO_EMAIL` | verified Resend domain |
| `FRONTEND_URL` | published site URL, no trailing slash |
| `STAFF_REGISTRATION_CODE` | code staff enter when registering |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | web push (if used) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

Finally, point the Paystack webhook at
`https://<your-ref>.supabase.co/functions/v1/paystack-webhook`.

## 6. Point the app at the new project

`src/integrations/supabase/client.ts` and `supabase/config.toml` hold the project URL, publishable key and project ref. Update those three values (or set `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` in `.env`) and the whole app follows.

## 7. First admin account

The new database has no users. Create one in Dashboard → Authentication → Users (with "auto confirm"), copy its UUID, then run:

```sql
INSERT INTO public.profiles (user_id, full_name, school_id)
VALUES ('<uuid>', 'Your Name', (SELECT id FROM public.schools WHERE subdomain = 'default'));

INSERT INTO public.user_roles (user_id, role)
VALUES ('<uuid>', 'admin');
```

Log in at `/login` and the admin dashboard becomes available.

## 8. Smoke test

Login → create a class and subject → enrol a test student → submit the public admission form → create and take an exam → make a test fee payment → generate a report card → browse the public website pages.
