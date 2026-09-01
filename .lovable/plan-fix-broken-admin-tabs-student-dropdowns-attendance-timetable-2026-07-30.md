# Fix broken admin tabs (student dropdowns, attendance, timetable, payments) + Payroll

## How the Payroll page works today
Payroll (HR > Payroll) is currently only a **period tracker**:
- You pick a month and click Create  this makes one payroll period row with status `draft`.
- The list shows each month with a status badge and one action button that walks the status forward: draft -> processing -> paid -> closed.
- That is all it does. There is a `payroll_items` table (per-staff gross salary, allowances, deductions, net pay, status, notes) but **no screen writes to it, and it holds 0 rows**. So no salaries, no staff lines, no totals, no payslips.

## What is actually broken (verified)
1. **Student dropdowns are empty everywhere in Fees.** Queries embed `profiles!students_user_id_fkey`, but that foreign key points to `auth.users`, not `profiles`. The embed is invalid, so the whole request fails and returns nothing. This affects: Installment Plans (student dropdown), Payments tab (5 payments exist in the database but the tab shows "No payments"), Student Balances, Reminders, Receipt Generator.
2. **Library "Issue Book" student dropdown empty.** It filters `profiles` by a `role` column that no longer exists (roles moved to `user_roles`), so the query errors and the list stays empty.
3. **Attendance Reports fails** with `operator does not exist: record ->> unknown`  the `get_attendance_summary` function sorts a row type with `->>` instead of converting it to JSON first.
4. **Timetable entry save fails** with the `day_of_week` check violation  the grid uses 0-based day indexes (Monday = 0) while the table requires 1-7.

## Fixes
**Data access (frontend)**
- Replace every invalid `profiles!students_user_id_fkey` embed with a plain students query plus a separate `profiles` lookup joined in code (the pattern already used elsewhere). Files: `fees/InstallmentPlans.tsx`, `fees/PaymentsList.tsx`, `fees/StudentBalances.tsx`, `fees/RemindersPanel.tsx`, `FeeReceiptGenerator.tsx`.
- `LibraryManager.tsx`: drop the `role` filter; build the student list from the `students` table joined to profile names.

**Database**
- Rewrite `get_attendance_summary` to aggregate with `to_jsonb(t)` and order by the column, fixing the report.

**Timetable**
- Map grid columns to 1-7 (Monday = 1) for reads, writes and conflict checks so entries save.

**Payroll (make it functional)**
- Open a period into a detail view listing staff with editable gross salary, allowances and deductions; net pay computed automatically.
- "Load staff" action to seed lines for all active staff, inline editing, and per-period totals (gross, deductions, net, headcount).
- Marking a period paid stamps `paid_at` on its items; closed periods become read-only.
- Print a payslip per staff line and export a CSV of the whole period.

## Technical notes
- One migration: replace `get_attendance_summary` (same signature, security definer, `search_path = public`).
- No schema changes needed for payroll  `payroll_items` already exists; its RLS/grants are checked before wiring the UI.