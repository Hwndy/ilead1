# Admission Emails: admissions@ivintagecollege.com via Resend

## Goal
All admission-related emails (offer letters, admission notifications, application confirmations) send **from** `admissions@ivintagecollege.com` with **reply-to** `ivintagecollege@gmail.com`, using the existing Resend setup.

## What I need from you
1. **Verify the domain in Resend** (one-time, ~10 min):
   - Log in to your Resend dashboard → Domains → Add Domain → enter `ivintagecollege.com`.
   - Resend shows DNS records (DKIM/SPF — usually 3–4 records).
   - Add those records at your domain provider's DNS settings (you confirmed you can edit DNS).
   - Click "Verify" in Resend. Verification can take a few minutes to a few hours.
2. Nothing else — the Resend API key is already stored in the project.

## Code changes (I do these)
1. **Update secrets**: set `SENDER_EMAIL` = `admissions@ivintagecollege.com` and `REPLY_TO_EMAIL` = `ivintagecollege@gmail.com` (they already exist; I'll update the values).
2. **Edge functions** — update sender/reply-to defaults in:
   - `send-admission-notification`
   - `send-offer-letter`
   - `send-bulk-email`
   - `send-report-cards`
   - `send-otp`
   - `notify-absentees`
   Each sends `from: "iVintage College Admissions <admissions@ivintagecollege.com>"` and `reply_to: "ivintagecollege@gmail.com"`. The old `@ivintage.vercel.app` sender-domain restriction is already removed; I'll confirm generic email validation accepts the new address.
3. **Redeploy** the affected edge functions.
4. **Verify**: send a test admission email and confirm the From/Reply-To headers are correct.

## Notes
- Until the domain is verified in Resend, emails from `admissions@ivintagecollege.com` will be rejected by Resend — so step 1 (your part) must happen before real sends work.
- The letterhead and branding in the email templates stay unchanged.
