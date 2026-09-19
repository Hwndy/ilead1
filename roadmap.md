# iVintage platform roadmap (September change log port)

## Full color branding overhaul
- [x] Apply Academic Navy Premium tokens and Sora/Manrope typography
- [x] Restyle shared controls, public website chrome, and page openings
- [x] Apply structured navy portal framing across admin, teacher, student, and parent areas
- [x] Restore white and soft-gray public website surfaces with navy text and lime accents
- [x] Validate representative public website and sign-in screens at desktop and mobile widths
- [x] Revert the public website to its pre-overhaul look (site-scoped theme), portals unchanged
- [ ] Validate authenticated portal screens when a signed-in preview session is available

## Public website responsiveness (Sept 19)
- [x] Audit homepage at phone, tablet, laptop, desktop, and wide-screen widths
- [x] Rebuild the homepage opening and shared public-site responsive rules
- [x] Verify every public route and interactive public flow across viewport sizes

## Phase 1 — Finance reliability and money coming in
- [x] Shared class resolution helper used by all finance screens
- [x] Record cash/transfer/POS/cheque payment dialog (incl. "Other / not listed")
- [x] Shared branded receipt view for preview, print and PDF
- [x] Retire/restore fee structures with payment history, usage counts
- [x] Payroll "Approved" status + refresh
- [x] Loading/error states on balances and overview

## Phase 2 — Archived students and automatic updates
- [x] Exclude archived students from active lists everywhere
- [x] Realtime/auto refresh on key operational screens
- [x] Service worker: network-first shell, auto-apply new version

## Phase 3 — Campus / class / arm structure
- [x] campuses, arms, campus_class_offerings, student_enrollments, student_movement_log
- [x] SchoolStructure, StudentsHub, ClassRoster screens
- [x] Two-way sync with legacy class_assignments

## Phase 4 — Rules-based billing
- [x] fee_categories, fees, fee_rules, student_invoices, invoice_items, credits, adjustments
- [x] FeeRules, BillingRun, InvoicesList screens

## Phase 5 — Admissions and enrolment reliability
- [x] NIN capture + compulsory documents
- [x] Document verification states with rejection reasons
- [x] Shared enroll_applicant routine, idempotent (SQL, used by admin + payment paths)
- [x] Offline acceptance payment (RPC + admin dialog)

## Phase 6 — Staff, users, admin home
- [x] create-staff-user edge function + "New staff account" dialog in Staff Management
- [x] Paginated users CSV export (server + in-app fallback)
- [x] Admin overview dashboard (money, pupils, admissions, latest activity)

## Blocked / needs the user
- Authenticated portal visual verification requires a signed-in preview session.
- GitHub project sync cannot be attached to the existing `Hwndy/ilead1` repository by the agent; Lovable's Git settings can reconnect only by creating a new repository.

## Full-app audit (Sept 18)
- [x] Bare tab addresses (students, classes, subjects, exams, etc.) resolve to correct sections via alias map
- [x] Email Logs fixed (db/phase11-fixes.sql applied — JWT-email policy)
- [x] Login 406 fixed (maybeSingle on app_settings lookup)
- [x] Crawled all 55 admin sections — all render, no page errors, no failed requests
- [x] Typecheck and build clean
