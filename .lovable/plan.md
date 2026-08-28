# Restore administrator login and password recovery

## Confirmed state

- The external authentication host is online and resolving again.
- The forgot-password form now uses the native recovery-email API and redirects links to `/reset-password`; it no longer depends on the missing OTP Edge Functions.
- The public reset page accepts the recovery session, enforces the password policy, updates the password, and signs out an email-recovery session afterward.
- A complete administrator account requires an auth user, a matching profile, and an `admin` entry in `user_roles`.

## Implementation

1. **Diagnose recovery delivery live**
   - Verify the preview and published `/reset-password` URLs are allowed authentication redirects.
   - Submit a real recovery request and inspect the Auth API response and email-delivery configuration/logs.
   - Correct the redirect or email configuration identified by that check; keep the account-enumeration-safe confirmation screen.

2. **Provision the new administrator safely**
   - Check whether `ibnsulaimon001@gmail.com` already exists before creating anything.
   - Create it only if absent, using a strong generated bootstrap password that is never printed, placed in source, or sent in chat.
   - Ensure its profile exists, remove any default student role, assign only the `admin` role in `user_roles`, and require an initial password change.
   - Leave the existing `suleayo04@gmail.com` administrator intact.

3. **Deliver credentials privately**
   - Send `ibnsulaimon001@gmail.com` a native password-recovery link so the owner chooses the actual password privately.
   - If managed auth-email delivery is not configured on the external project, report the exact dashboard setting that must be enabled rather than exposing a temporary credential.

4. **Verify end to end**
   - Confirm both administrator records, profiles, and role assignments in the live database.
   - Verify the recovery URL opens `/reset-password`, accepts a policy-compliant password, clears the recovery session, and returns to login.
   - Sign in with the new account and verify it reaches the administrator dashboard and can perform protected administrator reads.

## Technical scope

- Authentication configuration and live account data in the external project.
- Frontend changes only if live verification exposes a remaining defect in the recovery or reset-page handling.
- No new tables, permissive policies, custom OTP dependency, or exposed administrator password.