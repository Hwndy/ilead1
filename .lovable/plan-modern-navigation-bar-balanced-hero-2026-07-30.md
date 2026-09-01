# Modern navigation bar + balanced hero

## What's wrong today (confirmed from the live page)

- The logo image `/albari_logo.jpg` is a JPEG, so it carries a hard white box behind the crest.
- The header shows the school identity twice: the `Logo` component prints "AL-BARI / GROUP OF SCHOOLS" and right next to it the layout prints the full school name plus motto. Combined with 10 nav links, the bar wraps onto two lines and looks cramped.
- Nav links are plain text with a border-bottom active state, no spacing rhythm, no call-to-action button.
- The hero puts everything in a left column and leaves the whole right half empty, so the section reads lopsided; the slideshow dots sit alone in the bottom-right corner.

## Navigation bar rebuild

1. Transparent logo: produce a background-free PNG from the existing crest and use it in the `Logo` component (the JPEG stays available for print/PDF paths that already reference it). No white box anywhere it appears.
2. Single identity block: `Logo` renders icon-only inside the header; the wordmark comes from the header's own name + motto text. Truncation tuned so the full school name fits instead of "Al-Bari Group of Scho...".
3. Slimmer, modern bar:
   - Utility strip stays but becomes thinner, lower contrast, and hides on small screens.
   - Main bar becomes one clean row: crest + name left, nav right, a solid "Apply Now" button pinned at the end.
   - Header becomes a translucent blur surface that only gains a border and shadow after scroll, so it floats over the hero instead of sitting in a grey slab.
4. Nav de-cluttering: primary links stay inline (Home, About, Admissions, School Life, News, Portals); the rest (Gallery, Testimonials, Facilities, Careers) move into a "More" dropdown so nothing wraps. Active state becomes a soft pill highlight instead of an underline.
5. Mobile: full-height slide-in sheet with grouped links, contact row and an Apply Now button; logo and trigger sized so they never overlap.

## Hero rebalancing

- Two-column layout on desktop: copy on the left (badge, headline, subtitle, CTAs), and on the right a floating glass highlight card (students, years, success rate, plus an "Admissions open" note) so the right half is no longer empty. Single-column stack on mobile, same content order.
- Tighter vertical rhythm: consistent spacing between badge, headline, paragraph and buttons; headline max-width capped so lines break evenly.
- The highlight span in the headline uses the brand accent colour again instead of being overridden to plain white.
- Scrim upgraded from a flat 60% black wash to a directional gradient (darker left, lighter right) so the campus photo stays visible while text keeps contrast.
- Slideshow dots move to bottom-centre and become clickable slide selectors.

## Technical notes

- Files touched: `src/components/website/WebsiteLayout.tsx` (header/nav), `src/components/shared/Logo.tsx` (transparent asset + icon-only mode), `src/pages/website/HomePage.tsx` (hero), plus a new transparent logo asset in `src/assets`.
- Colours use existing semantic tokens (`primary`, `background`, `foreground`, `muted-foreground`); no hardcoded hex outside the hero's over-image treatment.
- Nav content is unchanged data  only grouping and presentation change. No routing, CMS or backend changes.