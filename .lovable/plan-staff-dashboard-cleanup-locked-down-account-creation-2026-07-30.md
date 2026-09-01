# Staff dashboard cleanup + locked-down account creation

## What's wrong today (verified)

- **Teachers cannot read student names.** The `profiles` table only allows a user to read their own row (or an admin to read any). Teachers are excluded. Every staff screen that builds a roster from `profiles` therefore comes back empty  this is why "Enter Scores" shows "Select a class, subject, term and session to begin" even after all four filters are chosen, and why broadsheet names would render as dashes.
- **Score entry drops students without a profile row.** The roster is built from `profiles` first and then filtered against `students`, so any student missing a profile row silently disappears instead of showing with their admission number.
- **Broadsheet has no data to show.** Only 2 rows exist in `gradebook_entries` for the whole school, so the broadsheet is empty by data, not only by permissions. It also has no subject columns fallback, no export, and no "no results yet" explanation.
- **Gradebook tab** duplicates Results Management: it is a second, older way to record per-assessment scores that does not feed the report card pipeline (`v_student_term_scores` reads the Test 1 / Test 2 / Exam columns written by Results Management).
- **Public "Create Account"** currently offers Student, Teacher and Parent in one dropdown with no authorization check, and the role chosen in the browser is what the account is created with.

## What will change

### 1. Remove the Gradebook tab
Drop the Gradebook tab and `GradebookSystem` from the teacher dashboard. The `gradebook_entries` table stays  it is the storage behind Results Management and report cards; only the duplicate UI goes.

### 2. Staff can see their students
- Add a read policy so staff (teacher or admin) can read `profiles`. Student, parent and self access rules are unchanged.
- Rebuild the roster query in score entry so it starts from `students` + `class_assignments` and attaches names from `profiles`, falling back to the admission number when a name is missing. No student can silently vanish.

### 3. New "Students" tab in the staff dashboard
A class-grouped, read-only roster for teachers: pick a class (limited to the classes assigned to that teacher, all classes for admins), see each student's photo initial, name, admission number and status, with search and CSV export. Clicking a student opens a summary drawer with their term scores and attendance rate.

### 4. Results Management made fully functional
- **Enter Scores**: class and subject lists limited to the teacher's own assignments; roster loads reliably; row totals, grade preview and a running "x of y entered" counter; per-row validation (Test 1 and Test 2 max 20, Exam max 60); save shows exactly what was written; existing scores reload when filters change.
- **Broadsheet**: shows every student in the class even with no scores yet, subject columns across, per-student total / average / position, class average per subject, an explicit "no scores recorded for this class, term and session" empty state, plus CSV export and a clean print layout.

### 5. Public account creation is teacher-only and code-protected
- The public **Create Account** form becomes a staff form: role fixed to Teacher (no role dropdown), plus an **Authorization code** field.
- The code is verified on the server. A new edge function creates the teacher account only when the code matches; the browser can no longer decide what role it gets. Class and subject assignments are written by the same function.
- Student self-registration is removed from the public form (students are created through admissions and by staff), and the `allow_student_registration` setting stops driving this screen.
- The code is stored as a project secret and can be rotated in Admin -> Settings.

### 6. Parent sign-up is locked to Parent
The "Create a parent account" entry points (login page and Portals page) open a parent-only form: role fixed to Parent / Guardian, no role dropdown, no authorization code, phone required, followed by the existing "link your child by admission number" step.

### Security note
Right now the role for a new account comes from the browser, so a crafted request could self-assign a privileged role. Moving teacher creation behind the server-side code check closes that path, and the signup trigger will refuse any role other than student or parent coming from the client.

## Technical detail

- Migration: `profiles` SELECT policy `staff_can_view_profiles` using `is_teacher()`; harden `handle_new_user` to clamp client-supplied roles to `student`/`parent`.
- New secret `STAFF_REGISTRATION_CODE` + edge function `register-staff` (service role): validates code, creates the user confirmed, inserts `user_roles` teacher, `teacher_class_assignments` and `subject_assignments`.
- `RegisterForm.tsx` gains a `mode: 'staff' | 'parent'` shape; role select removed in both modes. `AuthPage.tsx` and `PortalsPage.tsx` pass the mode.
- Teacher dashboard: remove `gradebook` tab/import, add `students` tab rendering a new `src/components/teacher/TeacherStudentsList.tsx`.
- `ManualScoresEntry.tsx` and `Broadsheet.tsx` reworked as described; both accept an optional `teacherScoped` prop so the admin copies keep full access.
