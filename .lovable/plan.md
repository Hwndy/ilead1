# Create a detailed changelog document of all recent changes

## Goal
Deliver a single downloadable Markdown file listing every recent change to the iVintage College platform end to end, with the implementation details.

## Deliverable
`/mnt/documents/ivintage-recent-changes.md` — a standalone document (no project code changes).

## Contents
1. **Contact details correction (today)** — the root cause (saved database rows overriding code fallbacks), the official values enforced, and every implementation piece: runtime normalization in `useCms.ts`, footer cleanup, fallback/seed/setup updates, email edge-function sender fixes, the admin editor key fix, and the manual live-database script `db/fix-ivintage-contact-details.sql` with the note that it still must be run against the live database.
2. **Public website redesign** — branding tokens, page layouts, `IVC-ADM-` application IDs.
3. **Responsiveness & hero fix** — 13 routes × 5 viewports verification.
4. **Bank-transfer-only payments** — Lotus Bank details, access code `4250645`.
5. **Official letterhead** across all emails, receipts, report cards.
6. **Admin CMS wiring** — full website editing from the dashboard.
7. **Staff creation fix & System audit area / Live Monitor**.
8. **Platform-wide broken-page audit fixes**.
9. **Earlier platform work** — branding overhaul, WordPress content migration, finance/admissions phases, secrets.
10. **Outstanding items table** — live DB script to run, Deno dependency installs, setup.sql review, GitHub connection, custom domain status.
11. **Verification summary** — build OK, typecheck clean, 65/65 Playwright checks.

## Technical notes
- One file write to `/mnt/documents` only; no source edits, no database changes.
