# Restore admin access and password recovery

## Confirmed diagnosis

- The existing `suleayo04@gmail.com` account still exists, is email-confirmed, has a profile, and has the `admin` role. It will be kept.
- Its recent login reached the authentication server but was rejected as invalid credentials; the captured password also included a trailing space.
- The reset form calls the custom `send-otp` Edge Function, but that function is not deployed on the new external backend. Its live endpoint returns HTTP 404 `NOT_FOUND`, which causes the screenshot's “Failed to send a request to the Edge Function” error.
- The app already contains a standard recovery-link implementation and a public `/reset-password` page, but the visible forgot-password form currently bypasses that working architecture in favor of the missing OTP functions.

## Implementation

1. **Create the new administrator safely**
   - Create `ibnsulaimon001@gmail.com` as an email-confirmed auth user in the external database.
   - Ensure the signup trigger-created student role is removed and assign only the `admin` role in `user_roles`.
   - Ensure its profile exists with an iVintage administrator display name and `must_change_password` enabled.
   - Keep `suleayo04@gmail.com` unchanged as a second administrator.

2. **Replace the broken OTP reset entry point**
   - Update the forgot-password form to call the existing native recovery-email method instead of the undeployed `send-otp` function.
   - Show a single confirmation state that does not reveal whether an email is registered.
   - Keep `/reset-password` as the page where the recovery session sets the new password.
   - Remove the inaccessible OTP/password steps from this form so password reset no longer depends on `send-otp`, `verify-otp`, Resend, or custom function secrets.

3. **Deliver access without exposing a temporary password**
   - Generate a strong random bootstrap password server-side and do not print or transmit it.
   - Trigger a recovery email for `ibnsulaimon001@gmail.com`; the owner sets their own password through the link.
   - This avoids placing an administrator password in chat, source code, shell output, or browser logs.

4. **Verify end to end**
   - Confirm both admin rows, the new profile, and the new admin role directly in the database.
   - Verify the recovery request reaches the Auth API successfully and redirects to `/reset-password`.
   - Test the reset page's password policy and session handling.
   - After the user sets the password from their email, verify login reaches the admin dashboard and that protected admin reads succeed.

## Technical scope

- Frontend: `src/components/auth/ForgotPasswordForm.tsx` and, only if runtime verification exposes an issue, `src/pages/ResetPasswordPage.tsx`.
- Backend data: one new auth user, profile, and `user_roles` admin assignment. No new tables or weakened RLS policies.
- The obsolete OTP functions can remain in source for unrelated legacy use, but the login recovery UI will no longer depend on their deployment.
