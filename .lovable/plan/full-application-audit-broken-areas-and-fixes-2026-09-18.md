# Full application audit — broken areas and fixes

I opened every one of the 60 admin sections plus all public pages while signed in as an administrator, and watched for errors on each. The public website, login, and almost all admin sections work. Four real problems came up.

## What is broken

1. **Bulk Notifications is permanently blank.** The screen never asks the database for its data, so it spins forever and shows nothing.
2. **Announcements fails to load past announcements.** The screen asks for an "expiry date" field that the database stores under a different name, so the list request is rejected. Saving a new announcement with an expiry date fails for the same reason.
3. **Email Logs shows nothing and reports "permission denied".** One of the database access rules for email logs reads the private accounts table, which normal signed-in users may not read, so the whole request is refused.
4. **A mistyped or outdated web address inside the dashboard shows an empty page** with no explanation, instead of guiding the person back.

Not broken (checked and fine): dashboard overview, admissions, students, classes, campuses & arms, subjects, timetable, exams, question bank, results, report cards, all results tools, users, parents, HR and payroll, attendance and scan station, ID cards, finance, library, transport, hostel, assets, website editor (all 10 screens), settings, audit log, live monitor.

## Fixes

- **Bulk Notifications**: load templates, queue and classes when the screen opens, and show a clear message if loading fails.
- **Announcements**: use the correct expiry field name when reading, saving and displaying announcements.
- **Email Logs**: replace the faulty access rule with one that matches the signed-in person's own email without reading the private accounts table. This is a database change delivered as `db/phase11-fixes.sql`; it needs to run on your database (I can apply it if you paste a fresh access token, or you can run it yourself).
- **Unknown dashboard address**: show a short "section not found" message with a link back to the dashboard instead of an empty page.

Nothing else is touched — no styling, routing, permissions or data changes elsewhere.

## Technical detail

- `src/components/admin/BulkNotificationSender.tsx`: the mount `useEffect` body is empty; call `fetchData()`.
- `src/components/admin/AnnouncementsComposer.tsx`: column is `expire_date` in `db/setup.sql`, code uses `expiry_date` in the select list, insert payload, interface and render (400 on `/rest/v1/announcements`).
- `db/phase11-fixes.sql`: drop `"Users can view their email logs"` on `public.email_logs` (subselect on `auth.users`, causes `42501 permission denied for table users`) and recreate it as `recipient_email = auth.jwt() ->> 'email'`.
- `src/pages/AdminDashboard.tsx`: final `return null` becomes a fallback card.
- Verify with `npx tsgo --noEmit -p tsconfig.app.json`, the build log, and a re-run of the 60-section admin crawl.
