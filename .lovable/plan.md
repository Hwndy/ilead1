# What's left — admin side and website side

Verified against your live database (`trtuqzdsutmindcjbkvj`) and the code, here is the honest state and the remaining work.

## Blocking (nothing else works properly until this is done)

**1. Edge functions are not deployed.** A call to `/functions/v1/track-application` returns 404, so none of the 28 functions exist on the new project. That means these features are currently dead:
admissions payments (Paystack init/verify/webhook), offer letters, OTP, application tracking, bulk email/SMS, fee payments and reminders, report-card emails, push notifications, admin-created student/parent/staff accounts, password updates by admin, user export, absentee alerts.

Deploying needs the Supabase CLI with your access token (commands are in `db/README.md`), plus the function secrets (`PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `SENDER_EMAIL`, `REPLY_TO_EMAIL`, `FRONTEND_URL`, `STAFF_REGISTRATION_CODE`, VAPID keys) set in the Supabase dashboard. If you give me a Supabase access token I can run the deploy from here.

**2. No public storage bucket for media.** Only `question-media`, `exam-attachments`, `admission-documents`, `assignments` exist. CMS image uploads (gallery, news covers, principal photo, student passports) need a public `media` bucket with policies.

## Admin side — empty tables that need setup or seeding

| Area | State | Needed |
|---|---|---|
| Students / parents / staff | 0 rows (3 profiles = admins) | Enrol or bulk-import; create staff records |
| Fee structures | 0 | Define per-class fees before any payment/invoice works |
| Admission sessions | 0 | Open a session, or the public apply form has nothing to attach to |
| Notification templates | 0 | Seed the default email/SMS templates the bulk tools expect |
| Academic calendar | 0 | Term dates (drives key dates on the website too) |
| Result automation settings | 0 | Term/session defaults for report cards |
| Grading scale | 1 row | Confirm it matches the A–F scale you use |
| Hostel, library, transport, assets, payroll | 0 | Seed only if those modules will be used |
| Teacher/class/subject assignments | 0 | Required before teachers can enter scores |

Also worth a pass: confirm timetable periods/rooms, and run one end-to-end smoke test (enrol a student → assign teacher → enter scores → generate report card → raise a fee → pay in Paystack test mode).

## Website side

- **News: 0 articles, Gallery: 0 images, Job openings: 0** — those pages currently render empty states. Needs real content, which needs the media bucket first.
- **`website_pages` / `website_sections` are empty** — the CMS page builder has nothing in it; pages run purely on `website_settings` defaults. Either seed page rows or accept settings-only editing.
- **Imagery is still AI-generated stock** (`/campus.png`, `/img1-3.png`, hero slides). Replace with real photos from the school.
- **Facilities / School Life / Careers pages** still carry generic copy — the old WordPress snapshots only covered home, pillars, admissions, testimonials and contact. Needs real text for the three campuses (Day School, Boarding House, Tahfeedh School).
- **Social links empty** (`facebook_url`, `instagram_url`, etc. blank) — footer icons point nowhere.
- **Stats are placeholders** (600+ students, 60+ teachers, 98% success rate) — confirm or correct.
- **Principal photo/name** — `principal_name` set generically; needs the real principal and a photo.
- **SEO**: sitemap regeneration and canonical paths should be re-checked after content lands; `og:image` for social sharing.
- **Admissions online payment** won't function until the Paystack functions are deployed and keys set.

## Suggested order

1. Deploy edge functions + set secrets (unblocks admissions, email, payments, push).
2. Create the public `media` bucket and its policies.
3. Seed admin essentials: admission session, fee structures, notification templates, academic calendar, result settings.
4. Enrol real staff/students and set teacher assignments.
5. Load real website content: photos, news, gallery, facilities/school-life copy, social links, correct stats.
6. Full end-to-end smoke test across admin, teacher, parent, student and public site.

## Technical notes

- Function deploy: `supabase link --project-ref trtuqzdsutmindcjbkvj && supabase functions deploy` (honours `supabase/config.toml` verify_jwt flags).
- Media bucket: `storage.buckets` insert + public-read policy and authenticated-write policy, mirroring the pattern in `db/setup-part2.sql`.
- Seeds go into `db/seed-ivintage.sql` so a rebuild reproduces them.
- No schema changes required for any of the above; column parity with `src/integrations/supabase/types.ts` was already verified.
