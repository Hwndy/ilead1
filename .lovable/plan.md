# Fix "server tools could not be reached" when adding a teacher

## What's happening

The Add User form does reach the server: the staff-creation tool is live and answering on your school's backend (I checked it just now). So the message you see is the wrong message — the tool is replying with an error, and the screen reports it as "unreachable" instead of showing the real reason.

The likely real reasons, in order: the signed-in account isn't recognised as an administrator by the server tool, or the staff record can't be saved (missing school/branch information on the new account). Both need the server's own log to confirm.

## Plan

1. Read the server log for the staff-creation tool for today's failed attempt, and confirm the exact reason it rejected the request.
2. Show the real reason in the Add User dialog instead of the generic "could not be reached" text — "Only administrators can create staff accounts", "This email already exists", etc. Keep the generic wording only for genuine connection failures.
3. Fix the confirmed cause. Expected fixes:
   - make the administrator check accept every admin account shape used in this school's data;
   - fill in the school/branch and profile fields the staff record needs so the teacher is saved completely;
   - keep the account creation all-or-nothing, so a half-created teacher is never left behind.
4. Register the staff-creation tool in the backend configuration file (it is currently missing an entry) and redeploy it with the fix.
5. Verify end to end: create a teacher with classes and subjects from Add User, confirm it appears as a Teacher (not a student), the class/subject assignments are saved, you stay signed in as yourself, and the action is recorded in System → Audit Log.

## Technical notes

- `supabase/functions/create-staff-user/index.ts`: admin verification, `profiles`/`staff_details`/`user_roles` writes, rollback on partial failure.
- `supabase/config.toml`: add `[functions.create-staff-user] verify_jwt = true`.
- `src/components/admin/UserManagement.tsx`: `friendlyFunctionError` currently swallows `non-2xx` responses; parse the JSON body returned by the function and surface `message`.

## What I need from you

Steps 1 and 4 (reading server logs and redeploying) need a fresh Supabase access token, since the previous one was deleted. Paste one when you approve and I'll do the rest.
