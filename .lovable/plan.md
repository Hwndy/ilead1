# Restore the public website's original look

Bring the public website (the pages visitors see) back to how it looked before the recent color overhaul, while leaving every signed-in portal — admin, teacher, student, parent — exactly as it is today.

## What changes

- Header, navigation, mobile menu and footer return to their previous styling.
- Home page hero, badges, buttons and closing call-to-action return to the earlier look.
- Inner page banners (About, Admissions, School Life, Gallery, etc.) return to their earlier treatment.
- The decorative layered-arch shapes added during the overhaul are removed from the website pages.
- Website colors, corner rounding and card shadows go back to the earlier navy + lime palette (softer navy, white page background, rounder corners).
- Website text returns to the previous typeface.

## What stays the same

- All dashboards and portals keep the current premium navy styling.
- No content, wording, images, links, pages, routes, logins, permissions or data change.
- The iVintage logo, navy and lime brand colors remain in use.

## Technical notes

- Restore `src/components/website/WebsiteLayout.tsx`, `src/components/website/PageHero.tsx`, and `src/pages/website/HomePage.tsx` to their pre-overhaul versions (commit `950ead7`).
- Rather than reverting the global tokens in `src/index.css` (which would also change the portals), add a website-scoped theme class applied to the `WebsiteLayout` root that re-declares the pre-overhaul values: `--background`, `--foreground`, `--card*`, `--popover*`, `--primary*`, `--secondary*`, `--muted*`, `--accent*`, `--gold*`, `--border`, `--input`, `--ring`, `--radius: 0.75rem`, `--gradient-primary`, `--shadow-card`, `--shadow-hover`, plus the previous body font family within that scope.
- Leave `tailwind.config.ts`, `src/main.tsx` font imports, and all shared UI primitives untouched so portals are unaffected.
- Verify with typecheck, build, and Playwright passes over `/website`, `/website/about`, `/website/admissions`, `/website/gallery` at desktop and mobile widths, plus one portal screen to confirm it is unchanged.
