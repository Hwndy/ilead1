# ID cards, payroll and parent-portal class fix

## 1. Student ID card  remove class and session
Drop the class/session line from the card face and re-balance the layout so the QR code sits higher and the card reads evenly (photo → name → admission number → QR). Nothing else about the design changes.

## 2. Parent portal shows "Not assigned"
Confirmed cause: the newly enrolled student (ALB/2026/0365) has a class assignment stored against their login account ID, but the function that feeds the parent portal looks the assignment up by the student record ID only, so it finds nothing.

Fix: update the parent-children function to match a class assignment on either identifier, and de-duplicate so one child appears once. This also fixes every other enrolled-through-payment student with the same mismatch.

## 3. Payroll  make it work like a real payroll system
Rebuild the payroll module around a proper period lifecycle:
- Create period for a month, with pay date and notes.
- Populate staff automatically from staff records, pulling base salary from each staff profile.
- Per-staff earnings and deductions built from reusable salary components (basic, housing, transport, tax, pension, loan) instead of three flat fields, with automatic gross → deductions → net computation.
- Bulk actions: recalculate all, apply a component to all staff, remove a line.
- Approval flow: Draft → Approved → Paid → Closed, with lines locked once paid.
- Payslip print per staff (branded, school header) and payslip batch print for the period.
- CSV export of the payroll register (bank-transfer friendly columns).
- Period summary bar: headcount, total gross, total deductions, total net.
- Posting to finance: when a period is marked paid, record the total as a salary expense so payroll shows in the profit-and-loss reports.

## 4. Staff ID cards
- Complete the card: real school name, logo, address, employee ID, designation, department, photo, QR that resolves to the staff scan endpoint (same scan flow students use), issue/expiry and validity line.
- Ensure staff without a photo or employee ID still render correctly.
- Generator page: search, filter by department/designation, multi-select, preview, single PNG download, and batch PDF print for all selected staff.
- Bulk "Generate IDs for all staff" action that issues missing employee IDs and scan tokens before printing.

## 5. Staff self-service profile editing
Add a Profile tab in the staff dashboard where a teacher can update their own photo, phone, address, emergency contact, blood group, qualification and next of kin. Name, employee ID, designation, department and salary stay admin-only. Access rules will allow staff to read and update only their own record.

## Technical notes
- DB: fix `get_parent_children` join; add payroll component/lifecycle columns and grants; staff self-update policy on `staff_details`; staff scan-token support for ID QR.
- Frontend: `StudentIDCard.tsx`, `StaffIDCard.tsx`, `StaffIDCardGenerator.tsx`, `hr/PayrollHub.tsx` (split into period list, period detail, payslip), new `StaffProfileSettings.tsx` wired into `TeacherDashboard.tsx`.
