# Rebrand: Al-Bari → iVintage College

Replace all Al-Bari branding across the website, portals, printed documents, emails and PWA with iVintage College identity, using the uploaded logo and its lime-green + navy palette.

## Brand facts to apply everywhere

- Name: **iVintage College**
- Address: Akinsanya Estate, Owode-Ibeshe Road, beside Ansar-Ud-Deen (ADS) Mosque, Ikorodu, Lagos
- Email: ileadvintagecollege@gmail.com
- Phones: +234 813 418 7710, +234 802 322 6806, +234 705 427 3127
- Facilities: iLead Vintage College (Day School), iLead Vintage Boarding House, iLead Tahfeedh School

## 1. Logo and favicon

- Upload the provided logo as a CDN asset and point the shared `Logo` component at it; wordmark text becomes "iVINTAGE" / "COLLEGE".
- Generate a square favicon from the logo in `public/`, update `index.html` icon links, and remove the old `favicon.ico`.
- Replace `public/albari_logo.jpg` references (ID cards, report cards, emails) with the new logo, and replace the letterhead asset used on printed documents with an iVintage version.

## 2. Colour system

Retheme `src/index.css` and `tailwind.config.ts`:
- Primary: lime-green from the logo (~#C6D92D) with dark navy (~#141C2B) as the deep/contrast tone.
- Update accent, ring, gradients, shadows and the dark-mode variants to match; the existing "gold" accent token becomes the lime accent.
- Card components (student/staff ID cards, report card HTML) use hard-coded green/lemon hex values  these get updated to the new navy/lime pair so print output matches.

## 3. Text and metadata

- `index.html`: title, description, OG/Twitter tags, JSON-LD organisation block, apple-web-app title, manifest name.
- `public/manifest.json`, `public/sw.js` cache names, `public/robots.txt`, `public/sitemap.xml`, `scripts/generate-sitemap.ts`.
- `src/lib/school-info.ts`, `src/lib/school-branding.ts` defaults, `src/lib/scan-url.ts`, `src/hooks/useCms.ts` fallbacks.
- Every website page and home-page section (Home, About, Admissions, Apply, Careers, Facilities, Gallery, News, Portals, School Life, Testimonials, Accept Offer, Payment Callback, 404) plus `WebsiteLayout`, `SEO`, `AdmissionForm`, `ApplicationTracker`, `LoginForm`, `InstallPage`, PWA prompts.
- Contact blocks (VisitUs, footer, WhatsApp float) get the new address, three phone numbers and email; the facilities/programmes copy mentions the day school, boarding house and Tahfeedh school.

## 4. Emails and edge functions

Update sender names, subjects, headers and HTML templates in: send-offer-letter, send-admission-notification, send-otp, send-report-cards, send-bulk-email, notify-absentees, send-push-notification, verify-acceptance-payment, backfill-student-logins, create-parent-account, export-users. Edge functions are redeployed after edits.

## 5. Imagery

Replace the Al-Bari campus/gallery/testimonial photos with neutral generated school imagery (campus exterior, classroom, students, library/lab) so no old-school photos remain. Old image files are removed.

## Notes

- Historic SQL migration files keep their original text (rewriting them would break migration history). Any school-name rows currently stored in the `school_info` table are updated with a new migration so the database matches the new brand.
- No functional/business-logic changes  this is branding, copy and theme only.
