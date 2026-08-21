# Fix login: restore the external database connection

## What's wrong

Login fails with "Failed to fetch" — not a code bug. The app points at your own Supabase project `trtuqzdsutmindcjbkvj`, and that hostname currently does not resolve from the network at all (the previous project's hostname still does). A paused Supabase project takes its API hostname offline, so every request from the browser — sign-in, school branding, dashboards — fails before it reaches the server.

Nothing in the app's auth code needs changing.

## Your step

Resume/restore the project in the Supabase dashboard (Project → Resume). Tell me when it's back up.

## My steps once it's live

1. Verify the API is reachable again (auth health + a REST read with the anon key).
2. Confirm the schema and seed data survived the pause: table count, RLS policies, `school_info`/`website_settings` rows showing iVintage College.
3. Confirm the admin account still exists in `auth.users` with its `user_roles` row and profile.
4. Run a real browser login against the preview to confirm sign-in → dashboard works end to end, and check the console for any remaining errors.
5. If anything was lost, re-apply `db/setup.sql`, `db/setup-part2.sql` and `db/seed-ivintage.sql`, recreate the storage buckets, and re-bootstrap the admin.

## Improvement to add while I'm there

Right now a dead backend shows only a generic "Failed to fetch" toast. I'll make the login form detect a network-level failure and show a clear message ("Can't reach the school server — please try again shortly") instead, so this is never mysterious again.

## Technical notes

- No change needed to `src/integrations/supabase/client.ts` — it is correctly pinned to `trtuqzdsutmindcjbkvj`.
- Only file edited for the error-message improvement: `src/components/auth/LoginForm.tsx` (catch block distinguishes `TypeError: Failed to fetch` from credential errors).
- Verification uses direct `curl` against `/auth/v1/health` and `/rest/v1/school_info`, plus a Playwright login run against `localhost:8080`.
