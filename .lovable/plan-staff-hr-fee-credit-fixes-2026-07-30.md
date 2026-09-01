# Staff HR + Fee Credit Fixes

## 1. Duplicate staff IDs (confirmed)
All 51 staff rows currently carry the same ID `ALB/STF/0001`. The sync ran `next_employee_id()` 51 times in a loop *before* inserting anything, and that function derives the next number from rows already in the table  so it returned `0001` every time.

Fix:
- Replace `next_employee_id()` with a real Postgres sequence-backed generator (no dependency on existing rows), keeping the `ALB/STF/0000` format.
- One-off backfill migration: re-issue unique IDs to every existing staff row (ordered by join date/creation) and add a unique index on `employee_id` so this can never repeat.
- Change the sync/add flow to let the database assign the ID (default/trigger) instead of pre-computing it client-side.

## 2. Staff Directory  full functionality
In `StaffManagement.tsx`:
- Edit staff dialog (department, designation, employment type, join date, salary, bank details, emergency contact, qualifications) with save.
- Activate / deactivate (status) and role badge display.
- Working search + department/status filters, sortable table, staff count summary cards.
- View profile drawer showing full record + link to Staff ID card generator.
- Export directory to CSV.

## 3. Staff Attendance  full functionality
In `StaffAttendance.tsx`:
- Mark present/absent/late/leave per staff for a chosen date, with check-in/check-out times and notes, saved via upsert on (staff_id, date).
- Bulk actions: "Mark all present", clear day.
- Correct monthly stats (present/absent/leave averages, working days excluding weekends).
- Per-staff monthly history view and CSV export.
- Auto-pull scans recorded by the ID-card scan station so scanned staff appear as present.

## 4. Fee payment button fails (confirmed)
Clicking "Pay ₦60,000" shows *"Failed to send a request to the Edge Function"*. Cause: `initialize-fee-payment` imports `npm:@supabase/supabase-js@2/cors`, which is not a real module, so the function fails to boot before it can respond. The same bad import exists in `create-parent-account` and `register-staff`.

Fix: replace with an inline CORS headers constant in all three functions.

## 5. Acceptance fee not deducted from tuition (confirmed)
The acceptance payment is written to `fee_payments` with `fee_structure_id = NULL` and a note "Acceptance fee credited towards school fees". The parent screen only subtracts payments matched to a fee structure, so tuition still shows the full ₦60,000 while "Total Paid" shows ₦10.

Fix:
- `verify-acceptance-payment`: attach the credit to the student's mandatory tuition fee structure for their class/year when one exists.
- Backfill existing acceptance credits (3 rows) to the matching tuition structure.
- `ParentFees.tsx`: treat any unallocated completed credit as a credit against the outstanding balance, so the Pay button always requests the true remaining amount.
- `initialize-fee-payment` already caps the amount at the structure total; keep it consistent with the reduced balance.

## Technical notes
- DB migration: sequence + `next_employee_id()` rewrite, employee_id backfill, unique index, acceptance-credit backfill.
- No multi-tenancy / school_id anywhere (already removed).
