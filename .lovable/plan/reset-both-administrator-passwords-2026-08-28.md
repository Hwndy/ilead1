# Reset both administrator passwords

## Confirmed state

- `suleayo04@gmail.com` and `ibnsulaimon001@gmail.com` are confirmed authentication users.
- Both accounts have email identities and only the `admin` role.
- The portal requires at least 10 characters with uppercase, lowercase, and numeric characters.
- The selected password is `Sulaimon2004`, which meets that policy.

## Implementation

1. Securely replace the encrypted password for both administrator accounts with a server-generated bcrypt hash of the selected password.
2. Preserve both users, profiles, email identities, and administrator role assignments unchanged.
3. Clear the first-login password-change flag for both accounts so the chosen password can be used without an immediate forced reset.
4. Verify each account through the live authentication API, then confirm both still resolve to the administrator role without printing session tokens.

## Technical scope

- Live authentication data only; no frontend, schema, RLS, or source-code changes.
- The plaintext password will not be written to source files, logs, or database columns.
