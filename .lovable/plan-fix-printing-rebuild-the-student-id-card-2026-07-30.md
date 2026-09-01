# Fix printing + rebuild the student ID card

## What's wrong with printing

`src/index.css` contains a global print rule (lines 5-22) that applies on **every page of the app**:

- `body * { visibility: hidden !important }`, with only `#student-id-card` made visible again
- `@page { size: 54mm 172mm; margin: 0 }`  an ID-card-sized page

So on the payment receipt page, the application tracker, the broadsheet, timetables and exam results, `window.print()` hides everything and prints an empty ID-card-sized sheet. The receipt page has its own `@media print` block, but it is overridden by the global `!important` rules.

## Fix: scoped printing

1. Delete the global ID-card print block from `index.css`. Replace it with neutral, safe print defaults (white background, exact colour printing, `.no-print { display: none }`, a `.print-only` helper). No global `@page` size, no global visibility hack.
2. Add a shared helper `src/lib/print-node.ts` that prints one DOM element by cloning it (with the page's stylesheets) into an offscreen iframe and printing that iframe, with an optional page size. This removes the fragile visibility hack and never affects the rest of the page.
3. Wire the helper into the places that print:
   - Payment receipt (`PaymentCallbackPage`)  prints the `#payment-receipt` block on A4; its local print CSS block is removed.
   - Application tracker / offer details  same helper where a print action exists.
   - Student ID card dialogs (`StudentsByClass`, `IDCardGenerator`)  print the card node at exact card size.
   - Class list, broadsheet, timetables and exam results keep `window.print()` and now print correctly because the global hack is gone.

## Rebuild the student ID card

Match the uploaded template: a **single-page portrait card** (no separate back).

Layout, top to bottom:
- Angular green / yellow / charcoal corner shapes top and bottom, plus the diagonal striped bar top-right, drawn with CSS clip-path shapes so they stay crisp at print scale.
- Header row: school logo (left) + `AL-BARI GROUP OF SCHOOLS` in bold green with the school address underneath, pulled from school info so it stays editable.
- Large circular student photo with a dark green ring, centred; initials fallback when no photo.
- Full name in heavy uppercase, with `ID: <admission number>` directly beneath it.
- QR code (links to `/scan/<token>`, falling back to the admission number) centred below the name.
- Faint campus watermark band behind the lower half, as in the template.

Everything  photo, name, admission number, QR, logo, school name  lives on one face. `showBack` is removed, and the batch PDF generator in `IDCardGenerator` is updated for the single-face card (54 x 85.6 mm, 4 per A4 sheet, hi-res).

## Technical notes

- Files touched: `src/index.css`, new `src/lib/print-node.ts`, `src/components/admin/StudentIDCard.tsx`, `src/components/admin/IDCardGenerator.tsx`, `src/components/admin/StudentsByClass.tsx`, `src/pages/website/PaymentCallbackPage.tsx`.
- Card colours reuse the brand green / lemon values already in the component; the card stays a fixed-pixel canvas since it is exported as image/PDF rather than themed.
- Photo and logo keep `crossOrigin="anonymous"` so html2canvas export keeps working.