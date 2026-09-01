# Hostel / Boarding Management

Add a complete boarding module to the admin dashboard, and capture boarding interest on the public admission form.

## 1. Admission form: boarding interest

- New required choice on the application form (Academic step): **Day student / Boarding student**.
- Value is saved with the application, shown in the review step, and displayed in Admission Management, the Decision Board and the offer/enrolment views so admins know who needs a bed.
- No allocation at offer stage  boarding interest is only a flag.

## 2. Hostel module (admin)

New "Hostel" entry under Operations in the sidebar, opening a tabbed hub:

**Hostels & Rooms**
- Create hostels (name, gender: male/female/mixed, address/notes).
- Rooms per hostel with room number, type (dormitory, 2-bed, 4-bed…), bed capacity.
- Live occupancy bar per hostel and per room (allocated vs capacity).

**Allocations**
- Allocate an enrolled student to a room/bed; validates capacity and gender match.
- Transfer to another room and check-out, keeping history with dates and reason.
- Filters by hostel and class, plus a list of enrolled students who requested boarding but have no bed yet.
- CSV export of a hostel roster.

**Hostel fees**
- A hostel fee is created as a normal fee structure item (per class or all classes) so it appears in the parent portal and flows through the existing Paystack payment and receipt logic.
- The allocation screen shows whether the student's hostel fee is paid or outstanding.

**Wardens & inspections**
- Assign staff as warden / assistant warden per hostel.
- Room inspection records: date, inspector, cleanliness and discipline score, notes, follow-up flag.

**Exeat / leave passes**
- Request a pass for a boarder: type (exeat, medical, weekend), out and in datetime, destination, guardian contact, reason.
- Approve or reject by admin or warden; mark the student returned; overdue passes highlighted.

**Hostel attendance (roll call)**
- Nightly/morning roll call per hostel: present / absent / on exeat (auto-filled from approved passes).
- Daily absentee summary and per-student history.

**Visitors**
- Reuse the existing visitor log, filtered to hostel visits (student visited, hostel, in/out time).

## 3. Parent & student portals

- Boarders and their parents see a read-only "Hostel" card: hostel, room, bed, warden contact, and their exeat pass history and status.

## Technical notes

New tables (all with RLS, grants and standard timestamps):
`hostels`, `hostel_rooms`, `hostel_allocations`, `hostel_wardens`, `hostel_inspections`, `hostel_exeat_passes`, `hostel_attendance`.

- Access rules: admins full control; staff assigned as warden manage their hostel's inspections, passes and roll call; students/parents read only their own allocation and passes.
- Capacity, gender and one-active-allocation-per-student checks enforced by a validation trigger on `hostel_allocations`.
- `admission_applications` gains `boarding_interest` (boolean); `students` gains `is_boarder`, set at enrolment from the application flag.
- Occupancy counts served by a view/RPC so lists stay fast.
- Frontend: `src/components/admin/hostel/HostelHub.tsx` plus tab components, following the existing FinanceHub/FeesHub pattern; wired into `src/components/ui/admin-sidebar.tsx` and `AdminDashboard.tsx`.