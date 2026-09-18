# Use the official iVintage letterhead everywhere

Your uploaded letterhead becomes the single official template for every document and email the system sends. It is used exactly as supplied — no redrawn logo, no re-typed address, no colour changes. Content is simply typeset inside its clear white area.

## What the letterhead is used for

**Full-page letterhead (documents people print or download as PDF)**
- Offer letters (already on letterhead — switched to the official file)
- Admission letters, acceptance and rejection letters
- Report cards (printed sheet and PDF)
- Fee receipts and payment acknowledgements
- Any other printed letter produced from the admin side

**Header and footer strips (emails)**
A full A4 page looks wrong inside an inbox, so emails use the top band (arc + logo + strapline) as the header image and the bottom band (addresses, phone, website, email) as the footer. Both strips are cut from the same file, so the branding is identical — nothing is redrawn.

Emails covered: admission notifications, offer letter mail, report card mail, fee reminders, bulk email to parents and staff, one-time codes and account emails.

## Placement rules

- Text never overlaps the artwork: content sits inside the safe area (below the top arc, above the footer block).
- Long documents: page one carries the full letterhead, following pages carry a lighter continuation version (top arc only) so the address block is not repeated.
- Report cards keep their current table layout; only the surrounding page frame changes to the letterhead.

## Technical notes

- Convert the uploaded `.docx` to a print-resolution PNG (LibreOffice → PDF → 300 dpi render) plus a continuation crop, a header strip and a footer strip. Store all four through the asset pipeline (`src/assets/*.asset.json`) so they are served from the CDN and reachable from edge functions by absolute URL.
- New shared module `src/lib/letterhead.ts`: exports the asset URLs, the safe-area margins (mm for jsPDF, CSS for HTML), a `drawLetterhead(doc, page)` helper for jsPDF and a `letterheadPageCss()` helper for printable HTML.
- Shared module `supabase/functions/_shared/letterhead.ts` for edge functions: cached base64 fetch of the full page (moved out of `send-offer-letter`) and the email header/footer strip markup.
- Wire-ups: `src/lib/receipt-pdf.ts`, `src/lib/report-card-html.ts`, `src/components/admin/results/BulkReportCards.tsx`, `send-offer-letter`, `send-admission-notification`, `send-report-cards`, `send-fee-reminders`, `send-bulk-email`, `send-otp`, `accept-offer`.
- The current `ivintage-letterhead` asset (an earlier generated approximation) is retired; all references point at the official file.
- ID cards are unchanged — they use the logo, not the letterhead.
