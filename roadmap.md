# iVintage platform roadmap (September change log port)

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
- Edge functions are not deployed to the connected Supabase project; server-side items stay inactive until deployed.
- SQL migrations in `db/` must be run in the Supabase SQL editor: phase1-finance, phase3-structure, phase4-billing, phase5-admissions.
