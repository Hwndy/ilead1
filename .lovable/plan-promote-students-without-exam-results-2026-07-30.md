# Promote students without exam results

## The situation
The Promotion panel today only works from computed session averages: it reads term scores, marks anyone below the pass mark as "Repeat", and promotes only those above it. Since last session's results were never recorded for the students you imported, everyone shows 0% and nothing can be promoted.

The fix is to make promotion work as an explicit roster move, with results as an optional aid rather than a requirement.

## What changes

**1. Two promotion modes**
- *Manual (default when no results exist)*: pick a class, tick the students to move, choose the destination class, promote. No score threshold involved.
- *Score-based (existing)*: keeps the current pass-mark behaviour, with an editable pass mark (currently hard-coded at 40 and not exposed in the UI).

The panel auto-selects Manual and shows a short notice when the selected class/session has no recorded scores.

**2. Selection controls**
- Checkbox per student, select-all / select-none, and a live count of selected students.
- Average column still shows when scores exist, otherwise displays "No results".
- Search box to find a student quickly in large classes.

**3. Safer, complete promotion action**
- Students with no class assignment row get one created instead of being silently skipped (the current update-only query misses them).
- Each move is written to `promotion_history` (from class, to class, academic year, type `promoted`, promoted_by, notes) so there's an audit trail  nothing is recorded today.
- Moves run as a single batched operation with a summary toast ("28 students promoted to JSS 2 A").
- Confirmation dialog listing count, source and destination class before anything is written.

**4. Graduation / archive**
- The Archive button becomes "Graduate & archive selected" and applies only to ticked students, also logging to `promotion_history` with type `graduated`.

**5. Repeat option**
- A "Keep in current class" action that marks unselected students as `repeated` in the history without moving them, so the session's roster decisions are fully recorded.

## Technical notes
- All work is in `src/components/admin/results/PromotionPanel.tsx`; no schema changes needed  `promotion_history` and `class_assignments` already have the required columns.
- `class_assignments.student_id` holds the student's auth `user_id`, while `promotion_history.student_id` holds the `students.id`; the panel already resolves both and will keep them straight.
- Bulk writes use `upsert`/`insert` in chunks rather than the current per-student loop.
