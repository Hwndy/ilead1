# Bring the September platform changes into iVintage, end to end

The uploaded change log describes ten days of work on the other school's platform. This project was remixed from an earlier snapshot, so most of it is missing here: there is no cash-payment entry, no shared receipt view, no fee rules or invoices, no campus/arm student structure, no admin overview dashboard, no server-side staff creation, and no shared acceptance-enrolment routine. The work is grouped into six phases, delivered in order, each usable on its own.

Confirmed decisions: all phases, two campuses (Ebutte and Akinsanya Estate), the full rules-and-invoices billing model, and NIN plus compulsory documents on the application form.

## Phase 1 — Finance reliability and money coming in

- Record a payment received at the school office: cash, bank transfer, POS or cheque, with student search, fee item, amount, date, reference and note.
- Keep it usable when a student has no class yet or no fee is configured, with an "Other / not listed" option that requires a description.
- One branded A4 receipt design shared by the on-screen preview, the printed copy and the PDF, used in finance, the parent portal and payment callbacks.
- Fee items that already have payments against them are retired rather than deleted, with restore, an active/retired label, and a usage count. History stays intact.
- Payroll periods gain the missing "Approved" step so approval stops failing, with lists refreshing by themselves.
- Student balances and fee summaries resolve a student's class reliably, with visible loading and error states instead of a blank table.

## Phase 2 — Archived students and automatic updates

- Archived students disappear from active rosters, attendance, gradebook, fee pickers, hostel, report cards, ID cards, messaging and parent linking, while remaining in Past Students.
- Key screens refresh themselves after changes made here or by another administrator.
- Published updates apply automatically: the app checks for a new version on open, on returning to the tab and on reconnect, and switches over without asking, deferring only while a form is being filled in.

## Phase 3 — Campus, class and arm structure

- Two campuses: Ebutte and Akinsanya Estate.
- Classes become academic levels; each campus offers levels for the session, with arms (A, B, C) underneath.
- Each student gets a current placement holding campus, level, arm, session, day/boarding and status, plus a movement history for transfers and class changes.
- A Students landing page with per-class counts, class roster pages, filters (campus, arm, gender, boarding, new/returning, status, admission year), search and CSV export.
- Old and new placements stay in step both ways, so teacher, attendance, gradebook, timetable and report-card screens keep working.

## Phase 4 — Rules-based billing

- Fee categories and fees, with rules that target session, term, amount, new/returning, day/boarding, one or several classes or all, compulsory or optional, one-off, annual or termly.
- A billing run that generates termly invoices, safe to re-run without duplicating charges, with amounts frozen at the moment of billing.
- Invoice list, optional-fee selection, discounts/waivers with reasons, overpayment turning into student credit, and an updated student balance view.
- Existing fee structures stay readable so current records and receipts are not disturbed.

## Phase 5 — Admissions and enrolment reliability

- NIN required on the application form (11 digits), shown in admin review, with the NIN slip added to the required documents.
- Documents must all be uploaded before submission, with type and size checks and a clear stop if an upload fails.
- Document review becomes pending / verified / rejected with a rejection reason, visible to families in the tracker.
- One shared enrolment routine behind all acceptance-payment paths (online, webhook, school office): unique admission number, school-issued student login, student record, class placement, acceptance fee credited once, application marked enrolled, welcome email with credentials.
- Payment success is recorded first and never reversed by a later enrolment problem; the family sees "payment received, finalising enrolment" and an administrator can retry.
- New dialog for recording an acceptance payment taken at the office, available from the accepted application and the payments area, showing the admission number and login details afterwards.

## Phase 6 — Staff, users and the admin home

- Staff accounts created server-side by an administrator without being logged out, creating the login, role, profile, staff record, employee ID and teaching assignments in one go, with rollback if a step fails.
- Link an existing account as staff, edit staff details and names, reset a password, and repair older teacher/admin accounts missing a staff record.
- Users CSV export reads in pages so admission numbers, employee IDs, roles and classes actually populate.
- An admin home showing session and term, active students with gender split, today's attendance, fees collected against billed, outstanding balance, admissions and pending decisions, live exams; charts for collection trend, attendance trend, students by class and the admissions funnel; a Needs Attention list; recent activity; and quick actions.

## Technical notes

- New tables (`campuses`, `arms`, `campus_class_offerings`, `student_enrollments`, `student_movement_log`, `fee_categories`, `fees`, `fee_rules`, `student_invoices`, `invoice_items`, `invoice_optional_selections`, `student_credits`, `invoice_adjustments`) are added by migration in the required order: create, grant to `authenticated`/`service_role`, enable RLS, then policies.
- Database routines: `next_admission_number`, `get_dashboard_overview`, `list_students_filtered`, `preview_student_bill`, `generate_invoices`, `get_student_fee_summary`, `apply_optional_selection`, `apply_invoice_adjustment`, `set_document_verification`, `apply_class_structure_map`. Aggregates are computed in subqueries before JSON is built.
- New edge functions: `_shared/enroll-applicant.ts`, `create-staff-user`, `record-offline-acceptance-payment`; updates to `verify-acceptance-payment`, `paystack-webhook`, `export-users`, `send-admission-notification`. Each sensitive function validates the caller's JWT and checks `has_role(..., 'admin')` server-side; the service-role key stays inside functions.
- Front end: shared `src/components/fees/FeeReceiptView.tsx`, `RecordCashPaymentDialog`, `FeeRules`, `BillingRun`, `InvoicesList`, `StudentsHub`, `ClassRoster`, `SchoolStructure`, `RecordAcceptancePaymentDialog`, `admin/overview/AdminOverview`, plus `class-roster.ts` and `receipt-pdf.ts` updates. Colours come from existing tokens.
- Realtime subscriptions live in effects and are removed on cleanup.

## Dependency to flag

The 28 existing edge functions still are not deployed to this project's database, and the new ones will need deploying too. Everything in Phases 5 and 6 that runs server-side stays inactive until that deploy happens, which needs a Supabase access token or the CLI commands in `db/README.md`.
