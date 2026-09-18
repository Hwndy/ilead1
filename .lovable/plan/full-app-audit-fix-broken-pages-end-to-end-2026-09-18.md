# Full-App Audit — Fix Broken Pages End to End

## Findings (confirmed by crawl + code reads)

1. **Empty admin sections**: several dashboard links open addresses like `/admin?tab=students` or `/admin?tab=classes`, but the dashboard only understands group addresses like `?tab=academic&subtab=students`. Result: sidebar shows, main area renders blank. Affected: students, classes, subjects, timetable, exams, results, report cards, and similar sub-pages reached by their bare name.
2. **Email Logs shows nothing**: needs the permission change in `db/phase11-fixes.sql` (not yet applied to the database).
3. **A 406 error fires once at login** (visible in console) — cause unconfirmed; investigate which request returns it and silence/fix it.
4. **Already fixed this round** (verified): Bulk Notifications, Announcements with expiry, and a "Section not found" fallback for bad dashboard addresses.
5. Public website, build, and typecheck are clean; the React ref warning on public pages is pre-existing and harmless.

## Fix steps

1. **Apply `db/phase11-fixes.sql`** to the database using the provided access token (read-only verification after: email_logs grant/policy present).
2. **Tab alias map in `src/pages/AdminDashboard.tsx`**: translate bare `tab` values (`students`, `classes`, `subjects`, `timetable`, `exams`, `results`, `report-cards`, `structure`, `student-detail`, `staff`, `payroll`, etc.) into the correct `tab` + `subtab` pair before rendering, so every address — from sidebar, quick links, search, or typed URLs — resolves to real content. Keep the existing "Section not found" fallback for genuinely unknown tabs.
3. **Investigate the login 406**: identify the request (likely a profile/role fetch returning no row) and fix the query or make it non-erroring.
4. **Re-run the admin crawl** (`/tmp/browser/audit/admin2.py` across every sidebar tab/subtab) plus public crawl; confirm every section renders real content, no new console errors.
5. **Verify**: `npx tsgo --noEmit -p tsconfig.app.json` and check the build log says "build OK" before reporting done.

## Technical details

- Alias map is a pure lookup at the top of `AdminDashboard` — no sidebar, routing, or permission changes, so no other pages are touched.
- `db/phase11-fixes.sql` grants read on email logs to admins only; no other policies change.
- The provided Supabase token is used once for the SQL apply and function/log reads; it will not be stored.

## Reminder

The access token pasted in chat is visible — delete it at supabase.com/dashboard/account/tokens after this work completes.
