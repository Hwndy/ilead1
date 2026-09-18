# Fix staff account creation + build a real System / Audit area

## 1. Why new staff turn into students (verified)

The admin "Add User" form creates the account in the browser with a normal public sign-up and asks for the role in that request. The database deliberately ignores any role sent from a browser and always grants **student** — a security rule added earlier to stop people self-assigning privileged roles. So teacher and admin accounts come out as students.

The same code has a second problem: a browser sign-up replaces the current session, so creating a user can silently sign the administrator out or leave them logged in as the new person.

### The fix
Route teacher and administrator creation through the existing server-side staff creation service (already deployed), which checks that the caller is an administrator and grants the correct role server-side. Parent creation already goes through its own server service; student creation moves to the server student service too, so no account is ever created from the browser.

After the account is created, class and subject assignments are written exactly as they are today, and the form reports the temporary password so the administrator can pass it on.

Also: when the role is teacher or administrator, the form will show a clear "server will create this account" state and readable errors (email already in use, not authorised, service unavailable) instead of a raw failure.

## 2. System section becomes the platform audit area

Today "System" only has Email Logs, Live Monitor and All Results, and the audit screens do not read the real audit trail at all — they assemble a fake timeline out of exam sessions, exams and questions. The real `audit_logs` table (already in the database, already filled by triggers on roles, payments, admissions and student records) is never shown.

### New System layout
- **Audit Log** (new default) — the real `audit_logs` table: who did it, what action, which record, when, plus before/after detail in a side panel. Filters by date range, action type, table and person; free-text search; CSV export; paging for large volumes.
- **Live Monitor** — reworked, see below.
- **Email Logs** — unchanged.
- **All Results** — unchanged.

### Audit coverage end to end
Extend audit recording so the log covers the actions administrators actually care about, not just the four tables currently wired:
- Database triggers added for exams, exam results, invoices/fee items, profiles, staff records, classes and website content.
- A small shared helper used by the app and the server services to record actions that have no table write of their own: sign-in, sign-out, failed sign-in, password reset, password change, user created/disabled, report cards sent, bulk email/SMS sent, offer letter sent, data export.
- Every entry stores the actor's name and email so the log is readable even after a user is deleted.

### Live Monitor made real
- Remove the hard-coded fake "suspicious activity" list.
- Show genuinely live data: active exam sessions with student name, exam, progress, time left and last activity; sessions that have gone quiet; counts of active students right now.
- Suspicious activity comes from the real signals already recorded during exams (tab switches / focus loss, repeated submissions, session restarts) rather than invented rows; when there are none, the panel says so plainly.
- Live updates over the existing realtime subscription with a visible "last updated" time and a manual refresh; auto-refresh can be turned off.
- Actions on a session (view detail, end session) confirmed before running and written to the audit log.

## 3. Technical detail

- `UserManagement.tsx`: remove `supabase.rpc('create_user_with_profile')` + `supabase.auth.signUp`; call `create-staff-user` for teacher/admin and `create-student` for student; keep `create-parent-account` for parents. Keep the existing subject/class assignment writes (`subject_assignments`, `create_teacher_class_assignments` RPC) keyed off the returned `user_id`.
- New SQL file `db/phase10-audit.sql`: additional `audit_sensitive_writes` triggers; `public.log_audit_event(action, table_name, row_id, metadata)` SECURITY DEFINER helper with execute granted to `authenticated`; index on `action`.
- New `src/lib/audit.ts` wrapper around `log_audit_event`, called from `AuthContext` (sign-in/out), password flows and admin actions; server functions call it with the service role.
- New `src/components/admin/system/AuditLog.tsx` reading `audit_logs` with filters/paging/CSV; `EnhancedAuditLogs.tsx` and `AuditLogs.tsx` retired.
- `EnhancedLiveMonitor.tsx`: drop mock data, read `exam_sessions` + the existing exam activity/violation records, add last-updated indicator and confirmations.
- `admin-sidebar.tsx` System children: Audit Log, Live Monitor, Email Logs, All Results; `AdminDashboard.tsx` system switch updated with Audit Log as default.

## 4. Needs your action

`db/phase10-audit.sql` has to run on your database. Either run it in your database SQL editor or paste a fresh access token and I will apply it. Until it runs, the Audit Log still shows everything the existing triggers record — the extra coverage just isn't there yet.
