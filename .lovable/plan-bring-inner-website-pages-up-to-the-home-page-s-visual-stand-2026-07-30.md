# Bring inner website pages up to the home page's visual standard

The home page now uses a consistent language: photo-led hero, eyebrow + heading + intro block, scroll reveals, count-up numbers, photo cards over plain icon cards, and alternating section surfaces. The inner pages already share `PageHero` but still sit on the older look  centered lucide-icon cards, flat `py-16` sections, no motion.

## What changes per page

**About**
- Photo-backed `PageHero` (uses the existing `about_hero_image`) instead of the plain gradient band.
- History section becomes an asymmetric two-column block: image on one side with a floating "years" badge card, text on the other.
- Vision & Mission become two contrasting panels (one tinted, one dark) instead of two identical cards.
- Values switch from centered icon cards to left-aligned cards with a small icon chip, on a tinted surface.
- Leadership cards get proper portrait framing, hover lift, and role eyebrow.
- Fix the "founded 2004" vs "22+ Years" mismatch by deriving the years badge from the founding year.

**Facilities**
- Photo-led cards: each facility renders over a campus photo with a gradient scrim, matching `WhyChooseUs`; icon becomes a small chip, not the hero of the card.
- Gallery strip below becomes a proper masonry-ish grid with lazy loading and a link to the full gallery.
- Closing CTA band ("Book a campus tour") consistent with the home CTA.

**School Life**
- Programme tracks become numbered feature cards with subject chips instead of icon-over-text cards.
- Extracurricular list becomes a tag cloud of pills rather than plain text.
- Add alternating surfaces between the sections and a closing CTA.

**Testimonials / News / Gallery / Careers / Portals / Admissions**
- Consistent section headers (eyebrow + heading + intro) matching home.
- Reveal animations on cards and section headers.
- Alternating background surfaces so pages have rhythm instead of one flat tone.
- Portals: cards get gradient accent borders and hover states matching the home programme cards.
- Admissions: key-dates and steps styled like `AdmissionsGlance` / `HowToApply` on home.

## Shared pieces

- New `SectionHeading` component (eyebrow, title, intro, alignment) so every section header on the site is identical.
- New `SectionBand` wrapper for consistent vertical rhythm and alternating `bg-background` / `bg-muted/40` surfaces.
- Reuse existing `Reveal`, `CountUp`, `PageHero`, `EmptyState`.

## Technical notes

- Presentation only  no data, routing, or CMS-schema changes. Existing `settingValue` keys and defaults stay as they are.
- All colours come from existing semantic tokens; no hardcoded colour utilities.
- New shared components live in `src/components/website/`.
- Motion respects `prefers-reduced-motion` via the existing hook.
