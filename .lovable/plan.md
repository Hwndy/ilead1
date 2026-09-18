# Finance access code: reveal and change to 4250645

## What the code is today

The "Access code" box in the Delete Fee dialog checks a value stored in your database settings under `finance_delete_code`. The value shipped with the setup script is **iVintage2026**. I could not read your live database from here, so if someone changed it since setup, the live value may differ — the change below overwrites it either way.

## What will change

1. Set the finance access code to **4250645** in your live settings, so that is the only code accepted when deleting a fee (or any other finance action guarded by this code).
2. Add an "Access code" field to Admin → Settings → Payments so you can read and change this code yourself in future, without needing me or a database script. It shows the current code, allows editing, and saves back to the same setting.

## Technical detail

- Update `app_settings` row `finance_delete_code` to `"4250645"` (jsonb string). Applying this to the external Supabase project needs a fresh access token pasted in chat, or you can run the one-line update in your Supabase SQL editor.
- `db/phase1-finance.sql` default value updated to match, so a fresh setup uses the new code.
- `src/components/admin/BankAccountEditor.tsx` (the Payments settings tab) gains a finance access code field reading/writing `app_settings.finance_delete_code`; admin-only, existing RLS unchanged.
- No change to `FeeStructures.tsx` validation logic.
