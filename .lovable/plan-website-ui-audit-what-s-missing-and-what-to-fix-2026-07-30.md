# Website UI Audit  what's missing and what to fix

## Landing page (HomePage)

What's already there: hero slideshow + stats card, accreditations strip, stats band, principal's welcome, why-choose-us, news, gallery, testimonials, how-to-apply, newsletter, CTA, WhatsApp float.

What's missing:
1. **Duplicate stats**  the hero glass card and the band right below it show the same four numbers. Replace the band with something else (see below) or drop the numbers from the hero card.
2. **No academic programmes section**  the single most-searched thing on a school site (Nursery / Primary / Junior Secondary / Senior Secondary) has no home-page block. Add a 4-card programme grid with age range, short blurb, and a link.
3. **No key dates / "Admissions at a glance"**  session start, application deadline, entrance exam date. Parents look for this first.
4. **No results / achievements proof**  WAEC/NECO/BECE pass rates, competition wins, university placements. "Success rate" as a bare number isn't proof.
5. **No location/contact block**  no map, address, phone, or opening hours anywhere above the footer.
6. **No fees or "how much" signpost**  even a "Request fee schedule" CTA reduces bounce.
7. **Generic icon cards**  "Why Choose Us" uses three lucide icons on plain cards; should use real campus photography.
8. **No visual rhythm**  nearly every section is `py-16` on the same background. Alternate surface tones and vary section widths.
9. **Motion**  no scroll reveal or count-up on stats; page feels static after the hero.
10. **Hero copy is generic**  "Building Tomorrow's Leaders Today" says nothing specific. Should carry a differentiator (Islamic values + Cambridge-standard academics, etc.).

## Cross-site issues

- **Brand name inconsistency**  `CareersPage` says "Al-Bari Model Schools"; everywhere else is "Al-Bari Group of Schools". Also `AboutPage` mixes "founded 2004" with a "22+ Years" badge and hero says "Since 2004" while the badge math doesn't line up.
- **Wrong SEO paths**  `CareersPage` declares `path="/careers"` but the route is `/website/careers`, so the canonical URL is wrong. Audit every page's `path`.
- **Inconsistent page shells**  About/Facilities/School Life open with a gradient hero band; Careers/Testimonials just start with an `h1` in a container. Introduce one shared `PageHero` component used by every inner page.
- **Icon-card monoculture**  Facilities, About values, and Home all use the same "centered lucide icon + title + text" card. Facilities in particular should be photo-led.
- **No breadcrumbs** on inner pages, and no `BreadcrumbList` JSON-LD.
- **Empty states are bare**  Careers with no jobs, Gallery/News when the CMS is empty. Needs a designed empty state with a fallback CTA.
- **No 404 page inside the website shell**  an unknown `/website/*` path should render a branded not-found with nav, not the bare app 404.
- **No loading skeletons**  CMS-driven sections (news, gallery, testimonials) pop in; add skeletons.
- **Footer is thin**  needs quick links, contact, social, term dates, and a policy row.
- **Accessibility**  hero slideshow autoplays with no pause control and no `prefers-reduced-motion` handling; decorative images need empty alt; focus rings on the glass buttons are low-contrast.

## Proposed work

**Phase 1  consistency and correctness**
- Shared `PageHero` for every inner page; fix brand name and SEO `path` on all pages; add breadcrumbs + JSON-LD; branded website 404; designed empty states and skeletons; expanded footer.

**Phase 2  landing page depth**
- Replace the duplicated stats band with a **Programmes** grid (Nursery, Primary, Junior Secondary, Senior Secondary), all CMS-editable.
- Add **Admissions at a glance** (key dates + deadline) pulling from admission settings.
- Add **Results & achievements** section (CMS-editable stat/achievement list).
- Add **Visit us** block: address, phone, hours, embedded map, directions link.
- Rework "Why Choose Us" to photo-backed cards.
- Sharpen hero headline and subtitle defaults.

**Phase 3  polish**
- Alternating section surfaces and tighter vertical rhythm; scroll-reveal + count-up stats respecting `prefers-reduced-motion`; slideshow pause/next controls; focus-visible states.

## Technical notes

- All new sections follow the existing `useWebsiteSettings` / `settingValue` pattern with sensible defaults, plus matching fields in the CMS editors so the school can edit them.
- New home sections go in `src/components/website/home/` as separate components, consistent with the current structure.
- `PageHero` lives in `src/components/website/`, and each page keeps its own `SEO` block.
- No backend or business-logic changes; colours come from existing semantic tokens.
