# Student login with admission number only

## What students will see
- A new page at **ivintagecollege.com/login/students** (also works at `/login/students` on the preview). It has the iVintage logo and one box: **Admission number**, plus a **Sign in** button.
- When a student types a valid number such as `IVC/2026/014`, they go straight to their student dashboard. A wrong or archived number shows "Admission number not found. Please check with the school office."
- The main `/login` page becomes the login for staff and parents only. It gets a clear link: "Student? Sign in with your admission number." If a student account tries email login there, it is refused and pointed to the student page.
- The website's Portals page and student links point to the new page.

## Important security warning (your choice: no password)
Anyone who knows or guesses a student's admission number can open that student's results, report cards, fees and messages. To reduce the risk without adding a password:
- Limit attempts: after 5 wrong numbers from one device in 10 minutes, sign-in pauses for 15 minutes.
- Every student sign-in is written to the System audit log (number, time, device), so the school can spot misuse.
- Students cannot change account email/password or see other students' data (unchanged).
- Admins can turn student sign-in off for any one student (for example, a withdrawn student).

You can add a PIN later without redoing this work.

## Custom domain
- Add `https://www.ivintagecollege.com` and `https://ivintagecollege.com` as allowed site addresses for sign-in and email links on the school's database, and set the `FRONTEND_URL` secret to `https://www.ivintagecollege.com` so emails link there.

## Technical details
- New edge function `student-login` (verify_jwt false): validates input with zod, normalises the admission number (trim, uppercase), looks up `students` (active, not archived, has `user_id`) with the service role, rate-limits by IP in a small `student_login_attempts` table (service-role only, with GRANTs + RLS), writes `audit_logs`, then uses `auth.admin.generateLink({ type: 'magiclink', email })` and returns the `hashed_token`. The browser calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` to receive the session. No password is ever involved; the student's internal email stays hidden.
- Students without a login account get one from the existing backfill logic (`backfill-student-logins`) — run it once after deploy.
- `must_change_password` is skipped for students in `ProtectedRoute` (they have no password to change).
- `AuthContext.login`: after email sign-in, if role is `student`, sign out and show the redirect message.
- New page `src/pages/StudentLoginPage.tsx`, route `/login/students` in `App.tsx`; update links in `AuthPage`, `PortalsPage`, `WebsiteLayout`.
- Add a "Allow portal sign-in" toggle on the admin student record (column `students.portal_login_enabled boolean default true`).
- Because the database is external, the SQL (new table, column) ships as a `db/phase12-student-login.sql` script you run once, plus redirect-URL settings in that project's Auth settings.
