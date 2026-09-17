# Wire the new features into every existing page

The six phases added new screens, but several of them still live only in the admin fees and structure areas. This plan connects them end to end so pupils, parents, teachers and the office all see the same information.

## What I checked

- Invoices and invoice items are read by one admin screen only (`InvoicesPanel`). Nothing else in the app reads them.
- Campuses, arms and enrolments are used only by the School Structure screen and the Fee Rules screen. Student records, class lists, ID cards and rosters still use the old class assignment alone.
- The applicant's NIN is collected on the application form but never shown again anywhere.
- Parents' fee page still totals from the old fee structures, not from invoices.
- The branded receipt view is used by the cash dialog and the balance drawer, but the admin Receipts screen builds its own layout.

## 1. Finance, end to end

- Parent and pupil fee pages show the termly invoice: each line item, optional extras, what has been paid, credits applied and the balance left.
- The amount a parent owes comes from invoices first, falling back to the old fee structure only where no invoice exists yet, so nobody sees two different figures.
- Paying online starts from an invoice, so the payment lands against the right term and lines.
- Recording a payment in the office can be attached to an invoice, and the invoice's paid total updates immediately.
- The admin Receipts screen uses the same branded receipt as the cash dialog and the parent download, so every receipt looks identical.
- Student balances, the balance drawer and the fee overview all count invoices, payments and credits the same way.

## 2. Campus and arm, everywhere

- A pupil's campus and arm appear on the student record, the class lists, the student search, ID cards, the class roster and the users export.
- Class lists, attendance, results entry and fee screens can be filtered by campus and by arm.
- Moving a pupil between arms or campuses from the structure screen is reflected on every one of those screens without re-entry.
- The admin home figures can be read for one campus at a time.

## 3. Admissions through to enrolment

- NIN and the document verification state (verified, rejected with reason, still waiting) show on the application review screen and the decision board, so nobody offers a place on unchecked documents.
- When an applicant is enrolled, their NIN, documents and passport photo carry onto the pupil's record instead of being left behind in admissions.
- The pupil's record shows where they came from: application number, session, offer and acceptance payment.

## 4. Staff and users

- Staff accounts created with the new button appear immediately in User Management with the right role, and in the staff lists and teacher pickers.
- The users export includes campus, arm and class.

## 5. Admin home

- Every tile and list row on the admin home opens the exact screen and filter it refers to.

## Technical notes

- New shared helpers: an invoice/balance resolver (`src/lib/student-billing.ts`) used by parent, student and admin finance screens, and a placement resolver (`src/lib/student-placement.ts`) returning campus, arm and class in one call, both batched to avoid per-row queries.
- Reads only against existing tables from the phase 3–5 migrations (`campuses`, `arms`, `student_enrollments`, `student_invoices`, `invoice_items`, `fee_credits`); no new tables.
- `FeeReceiptGenerator` refactored to render `FeeReceiptView`.
- Payment initialisation edge functions accept an optional invoice id; verification writes it back to `fee_payments`.
- Placement fields added to the export-users function output.
