# Fix: acceptance payment verified by Paystack but enrollment fails

## What happened

Your payment went through at Paystack, but the enrollment step that runs right after it crashed, so the page showed "could not verify payment".

Confirmed from the function logs and the database:

- The student admission number is generated as `ALB/<year>/<count of all students + 1>`. There are 363 students, so it produced `ALB/2026/0364`  which already exists (numbering has drifted from the row count). The insert failed with a duplicate-key error and the whole request returned an error.
- The student login `abdulhakeem.sulaimon@students.albari.com.ng` was already created by an earlier attempt, so the retry loop also logged "user already registered".
- Application `APP2026-000029` is still `accepted` with no `student_id`, i.e. the applicant paid but is not enrolled.

## What to build

1. **Collision-proof admission numbers.** Stop deriving the number from a row count. Add a database function that allocates the next free number for the year by looking at the highest existing `ALB/<year>/NNNN` and incrementing, retrying on unique-violation until it succeeds. The edge function calls this instead of counting rows.

2. **Make enrollment idempotent per applicant.** Before creating anything, look up an existing student by the application's login user. If a student row, role, profile or class assignment already exists, reuse it instead of inserting. Persist `login_email` and `student_id` on the application as soon as they are known, so a repeated verify call short-circuits into the "already enrolled" branch.

3. **Never fail the receipt because of a post-payment step.** Payment confirmation and enrollment are separated: once Paystack reports success and the payment row is marked completed, the function returns success. If enrollment then fails, it returns the receipt plus an `enrollment_pending` flag and logs the error, rather than a 500.

4. **Callback page handling.** `PaymentCallbackPage` shows the successful receipt whenever payment is confirmed. When `enrollment_pending` is set, it shows a short note that the school is finalising the student record and login details will be emailed shortly, instead of the red failure screen.

5. **Repair the stuck applicant.** Re-run enrollment for `APP2026-000029` (reusing the already-created auth login, issuing a fresh admission number, crediting the acceptance fee to school fees, and emailing credentials) so the payment already made results in an enrolled student.

6. **Admin retry control.** In the admissions view, add a "Complete enrolment" action for applications that are `accepted` with a completed acceptance payment but no `student_id`, which re-invokes the same enrollment path. This makes future one-off failures recoverable without code changes.

## Technical notes

- New SQL function `public.next_admission_number()` (SECURITY DEFINER, `search_path = public`) returning `text`, granted to `service_role`.
- `supabase/functions/verify-acceptance-payment/index.ts`: split into `confirmPayment()` and `enrollApplicant()`; wrap the enrollment call in try/catch; use the RPC for the admission number; reuse the existing auth user when the derived login already exists, keeping the previously emailed password (no reset).
- `src/pages/website/PaymentCallbackPage.tsx`: read `enrollment_pending` from the response and render the informational variant.
- Acceptance-fee credit into `fee_payments` stays guarded by the existing `transaction_id` check so it cannot double-credit.
