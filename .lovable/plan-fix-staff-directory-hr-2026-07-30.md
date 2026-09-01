# Fix Staff Directory (HR)

## What's wrong (verified)

Two separate causes:

1. **The page never loads data.** In `StaffManagement.tsx` the mount effect is empty  neither the staff fetch nor the available-staff fetch is ever called, so the list stays blank regardless of data.
2. **There are no staff records yet.** The `staff_details` table has 0 rows, while 22 users hold the teacher role and profiles exist for them. Even with the fetch fixed, the directory would still show nothing.

## The fix

**1. Load data on open**
- Call the staff fetch and the available-users fetch when the page mounts, and refresh after add/edit/delete.
- Show a proper loading state, and an empty state that explains what to do next instead of a blank table.

**2. Backfill staff records**
- Add a "Sync staff from user accounts" action that creates a `staff_details` row for every user with the teacher or admin role that doesn't have one yet, using their profile name and email, with employee ID issued via the existing `next_employee_id()` function and status defaulted to active.
- Existing records are left untouched; the action is safe to re-run.

**3. Directory usability**
- Keep search, department and status filters working against the loaded list.
- Show role, employee ID, department, designation and status per staff member, with links to view/edit.

## Technical notes

- File: `src/components/admin/StaffManagement.tsx` (restore mount effect, wire refresh callbacks, add sync action).
- Backfill runs client-side as an insert into `staff_details` for missing `user_id`s  no schema change needed; `staff_details` already has admin insert policies and `next_employee_id()` already exists.
- No migration is required unless the sync surfaces a NOT NULL column without a default; in that case a small migration adds the default.
