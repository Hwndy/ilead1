# Restore admin access and verify password recovery

## Confirmed state

- The forgot-password form now calls the platform's native recovery-email method and redirects recovery links to `/reset-password`; it no longer calls the missing `send-otp` or `verify-otp` functions.
- `/reset-password` is a public route and updates the password from the recovery session.
- Direct database verification is currently unavailable from this workspace, so the new administrator's database state must be checked before creation to avoid duplicates.

## Implementation

1. **Verify the external backend and recovery configuration**
   - Confirm the external authentication service is reachable.
   - Confirm the published and preview URLs are allowed recovery redirect URLs.
   - Submit a real recovery request and inspect the Auth API response rather than relying only on the form's confirmation state.

2. **Create the new administrator safely**
   - Check whether `ibnsulaimon001@gmail.com` already exists before creating anything.
   - If absent, create it as an email-confirmed auth user with a strong random bootstrap password that is never printed or stored in source.
   - Ensure the associated profile exists, remove any trigger-created student role, and assign only the `admin` role in `user_roles`.
   - Mark the profile for a required password change and leave the existing `suleayo04@gmail.com` administrator intact.

3. **Deliver access through password recovery**
   - Trigger a native recovery email for `ibnsulaimon001@gmail.com` so the owner chooses the password privately.
   - Keep the response account-enumeration-safe: the UI must not reveal whether an address exists.

4. **Verify end to end**
   - Confirm both administrator records, profiles, and role assignments directly in the database.
   - Open the recovery link, confirm `/reset-password` accepts a policy-compliant password, and verify the temporary recovery session is signed out afterward.
   - Sign in with the new password and verify the account reaches the admin dashboard and can perform protected admin reads.

## Technical scope

- Frontend verification: `src/components/auth/ForgotPasswordForm.tsx`, `src/contexts/AuthContext.tsx`, `src/pages/ResetPasswordPage.tsx`, and route configuration.
- Backend data: one admin auth user, one profile, and one `user_roles` assignment only if they do not already exist.
- No new tables, permissive policies, exposed temporary credentials, or dependency on undeployed OTP functions.
