# Enrollment credentials + password change cleanup

## 1. Enrollment email always carries the student password

Today the welcome email only prints a temporary password when a brand-new login is created. If the login already existed from an earlier failed attempt, the code sets the password to `null` and the email silently says "issued separately by the admissions office"  which is what you saw.

Change: when the student has not yet signed in (their profile is still flagged "must change password"), always issue a fresh temporary password and reset it on the account, so the email always contains working credentials. Only when the student has already set their own password do we omit it and instead point to the password-reset link.

## 2. No parent account in the enrollment flow

Remove parent handling from acceptance-payment enrollment entirely:

- Stop creating a parent auth account from the application email.
- Stop generating/sending a parent temporary password.
- Stop auto-creating the parent record and the parent-child link.
- Remove the whole "Parent portal" block from the enrollment email.

The email will contain only: portal address, student login ID, admission number, temporary password, class, orientation/first day, and the required actions checklist.

A short closing line will tell the family that a parent can create their own account at the portal and link the child using the admission number and date of birth (the existing self-link flow already supports this). 

## 3. Student password change

Fix the first-login change so it completes cleanly:

- After the new password is saved and the flag is cleared, re-read the profile to confirm the flag is actually off (an update that touches zero rows currently looks like success and sends the student back into the change-password loop).
- For a first-login change, keep the session and go straight to the dashboard instead of signing out and forcing a second login. The email-link recovery path keeps its current sign-out behaviour.
- Show the password rules up front and surface the real error if the update is rejected.

## Technical notes

- `supabase/functions/verify-acceptance-payment/index.ts`: drop the parent block (lines ~344-435) and the parent fields in the notification payload / response; add a temp-password reset via `auth.admin.updateUserById` when reusing an existing login whose profile still has `must_change_password = true`.
- `supabase/functions/send-admission-notification/index.ts`: rewrite the `enrolled` template  remove the parent-portal card and `parent_temporary_password`, keep the student card, add the parent self-registration line.
- `src/pages/ResetPasswordPage.tsx`: confirm the flag cleared by re-select, branch first-login vs recovery on sign-out/redirect.
- No database migration required.