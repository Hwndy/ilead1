# Fix iVintage contact details not reflecting on the live app

## Confirmed issue

Today's commits changed some code fallback values, but the public website is still reading saved live data for the school profile and website settings. Those live rows still contain the old email, old phone/WhatsApp number, and the old `iLead Vintage College Complex` address, so they override the newer fallback values in the app.

I also found that some seed/setup values are still inconsistent, so a fresh setup could reintroduce older contact details.

## Values to enforce everywhere

- Email: `ivintagecollege@gmail.com`
- Contact phone: `+234 813 419 7710`
- WhatsApp: `2348134197710`
- Address: `iVintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos`

## Plan

1. **Add a corrective database update**
   - Update the live saved school profile rows that power the website header, footer, contact sections, WhatsApp button, and printed/email branding.
   - Update the saved website settings rows for contact email, phone, and address.
   - Remove or replace stale alternate contact email/phone values where they conflict with the “only email” and single phone requirement.

2. **Clean up source defaults and setup data**
   - Replace remaining old contact details in seed/setup files so future resets or database setup keep the same official values.
   - Ensure the fallback website data uses the same email, phone, WhatsApp, and address.
   - Update metadata where the public site exposes contact details.

3. **Check website/admin-controlled content paths**
   - Confirm the public header, footer, Visit Us area, Apply page help text, Admissions contact cards, WhatsApp floating button, and structured metadata all resolve to the new values.
   - Keep the existing admin website controls intact so admins can still edit content from the dashboard.

4. **Verify the fix end to end**
   - Open the public website after the live data update and confirm the old email, old phone, and `iLead Vintage College Complex` no longer appear.
   - Check the WhatsApp link points to `2348134197710`.
   - Check the build diagnostics after changes and fix any errors before finishing.

## Technical notes

- The key cause is not the visual redesign; it is saved database content overriding updated code fallbacks.
- Editing older seed-only inserts is not enough when live rows already exist, so the fix needs an explicit update/upsert migration or direct data correction.
- I will not change dashboard functionality, forms, routes, or the public design beyond correcting these contact values.
