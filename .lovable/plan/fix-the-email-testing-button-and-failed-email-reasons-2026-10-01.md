# Fix the Email Testing button and failed email reasons

## What's wrong
- The "Send Test Email" button sends a made-up application to the server. The server looks that application up, can't find it, and stops with a generic error ("non-2xx status code"). It never gets as far as sending the email. The test feature has never worked this way.
- The older failed emails in the log (for example the Sep 24 offer letter) were sent before the new sender address was set up. Their real reason is stored in the log, but the screen doesn't show it clearly.

## Fix
1. **Server test mode**: when the button sends a test, the admission email service skips the application lookup. It builds a sample applicant ("Test Applicant", sample class and reference) and sends the chosen email type to the address you typed. It still uses the letterhead, sender admissions@ivintagecollege.com and reply-to ivintagecollege@gmail.com. Only admins can use test mode.
2. **Logging**: each test send is recorded in Email Logs as "sent" or "failed", with the real reason from Resend (for example "domain not verified").
3. **Clear errors on screen**: the testing panel shows the server's real message instead of "non-2xx status code". Each failed row in Email Logs shows its error text.
4. **Publish** the updated email service to the school's backend. Then send a real test to suleayo04@gmail.com and confirm it arrives.

## What I may need from you
- Publishing to the school's backend needs a Supabase access key, the same kind you sent before. Please revoke it afterwards.
- If Resend still rejects the sender, you need to finish verifying ivintagecollege.com in Resend. The new error message will tell us if that is the problem.

## Technical details
- `send-admission-notification`: if `additional_data.test_mode && test_email`, check the caller is an admin through their sign-in token, use a stub application object, and skip `.single()` (which currently throws on the random id). Insert into `email_logs` with `error_message`.
- `EmailTestingPanel.tsx`: switch to `invokeFunction` from `src/lib/functions.ts` so the JSON error from the server is shown.
- `EmailLogsViewer.tsx`: show `error_message` on failed rows.
