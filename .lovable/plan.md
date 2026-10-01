# Fix "ivintagecollege.com domain is not verified" on admission emails

## What we know
- Your DNS records (DKIM and SPF) are correct. Resend shows ivintagecollege.com as **Verified** at 3:20 PM.
- The failed tests in Email Logs were sent at **3:16 PM**, which is before verification finished. So some of those failures were expected.
- If a test sent **after 3:20 PM** still fails with the same message, the most likely cause is a mismatch: the Resend key stored on the school's server may belong to a **different Resend account (or team)** than the one where you verified the domain. Resend only lets a key send from domains in its own account.

## Fix
1. **Fresh test first**: send one new test from the Email Testing panel. If it arrives, nothing else is needed.
2. **Add a clear check to the test button**: when a test fails, the server also asks Resend which domains the stored key can see, and shows that on screen. Example: "This key can send from: ivintage.vercel.app. ivintagecollege.com is not in this account."
3. **If the key is from the wrong account**:
   - In your Resend account **suleayo04** (where the domain is verified): API keys → Create API key → "Sending access", all domains (or ivintagecollege.com).
   - I open a secure form so you can paste it, then save it as the server's Resend key and republish the email services.
4. **Confirm**: send a real test to suleayo04@gmail.com and check that it arrives from admissions@ivintagecollege.com with reply-to ivintagecollege@gmail.com.

## What I may need from you
- The new Resend key, only if step 2 shows a mismatch.
- A Supabase access token to republish the email service on the school's backend (same as before). Please revoke it afterwards.

## Technical details
- `send-admission-notification` (test mode only, admin-gated): on send failure, call `resend.domains.list()` and return `{ error, key_domains: [{name,status}] }`.
- `EmailTestingPanel.tsx`: show `key_domains` under the error message.
- Update `RESEND_API_KEY` in the external project's function secrets and redeploy all six email functions so they share the new key.
