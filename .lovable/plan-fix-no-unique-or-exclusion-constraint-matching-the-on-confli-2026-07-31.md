# Fix "no unique or exclusion constraint matching the ON CONFLICT specification" when saving scores

## What's happening

The Enter Scores screen saves to `gradebook_entries` with an upsert keyed on
`student_id, subject_id, class_id, session_id, term`. The database has no unique
index on that combination (only the primary key on `id` plus two non-unique
indexes), so Postgres rejects the request outright  no scores are saved.

Verified: `gradebook_entries` currently holds 2 rows, no null `session_id`, and
zero duplicate rows for that key combination  so a unique index can be added safely.

## The fix

1. Database migration: add a unique index on
   `(student_id, subject_id, class_id, session_id, term)` for `gradebook_entries`.
   With existing data clean, this applies without conflicts.
2. Leave the save code as-is; the existing `onConflict` string then matches and
   re-saving a term overwrites the previous entry instead of duplicating it.

## Related errors checked while investigating

- Broadsheet reads from the `v_student_term_scores` view keyed on the same
  fields, so deduplicated rows keep totals and positions correct.
- Save currently only reports the error via a toast; after the index exists a
  repeated save is an update, which is the intended behaviour for score edits.

## Technical detail

```sql
CREATE UNIQUE INDEX gradebook_entries_unique_term_score
  ON public.gradebook_entries (student_id, subject_id, class_id, session_id, term);
```

No table, RLS, or grant changes are needed  the table already exists with policies in place.
