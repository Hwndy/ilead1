# Full iVintage color and visual branding overhaul

Apply the selected **Academic Navy Premium** direction across the public website and every authenticated area. The uploaded welcome artwork is the visual reference only; its navy, steel-blue, lime, white, layered arches, and typographic character will become a reusable system rather than embedding the poster itself.

## Brand system

- Set the core palette to deep navy `#202635`, steel blue `#35435E`, vivid lime `#C8ED00`, white, and restrained cool neutrals.
- Use **Sora** for headings and **Manrope** for body and interface text, loaded globally.
- Rework semantic color, shadow, radius, focus, chart, sidebar, status, and dark-mode tokens so existing screens inherit the new identity consistently.
- Add a reusable layered-arch motif inspired by the supplied artwork for selected page openings, image framing, empty states, and subtle background details.
- Keep lime controlled: primary actions, active navigation, focus rings, progress, and key highlights—not large reading surfaces.
- Preserve accessible contrast, readable data density, and reduced-motion behavior.

## Public website

- Restyle the navigation, mobile menu, footer, buttons, links, forms, and calls to action with the new navy-led identity.
- Recompose the home opening area around the selected direction: strong navy framing, photo focus, layered steel-blue arches, and a precise lime edge/accent.
- Carry the system through About, Admissions, Apply, School Life, Facilities, News, Gallery, Testimonials, Careers, Portals, application tracking, and offer acceptance.
- Standardize section headings, image treatments, cards, statistics, timelines, testimonials, notices, and alternating surfaces so every page clearly belongs to iVintage.
- Keep all existing copy, CMS content, links, and admissions behavior intact.

## Admin, teacher, student, and parent portals

- Establish the selected structured-sidebar layout language: deep navy navigation, lime active state, crisp white work surfaces, and steel-blue secondary hierarchy.
- Apply it consistently to every role shell, top bar, navigation group, breadcrumb, profile area, mobile navigation, and logout action.
- Refresh dashboard summaries, tables, tabs, filters, forms, dialogs, alerts, empty/loading states, badges, progress bars, calendars, finance views, exams, admissions, reports, attendance, and settings through shared primitives.
- Use compact spacing and restrained decoration on operational pages; reserve the larger arch treatment for dashboard welcomes and high-level overview areas.
- Preserve all permissions, calculations, data queries, navigation, and workflows.

## Shared controls and consistency pass

- Update shared buttons, cards, badges, inputs, selects, tables, tabs, dialogs, sheets, tooltips, pagination, skeletons, and notifications before page-level refinements.
- Replace scattered off-brand hardcoded interface colors with semantic tokens while retaining meaningful success, warning, and error states.
- Keep official letterhead artwork and print-safe document layouts unchanged; only surrounding on-screen controls receive the new theme.
- Keep the official logo unchanged and use it consistently in public and portal navigation.

## Verification

- Check representative public, admin, teacher, student, parent, login, admissions, finance, and report-card screens at desktop and mobile widths.
- Verify text fit, navigation behavior, form states, table readability, contrast, and absence of overlap.
- Confirm the preview builds cleanly and that existing workflows remain functional.

## Technical notes

- Presentation-only overhaul: no database, role, payment, admissions, or business-rule changes.
- The supplied poster remains a design reference and is not added as page content.
- The selected prototype is the structural and visual target; implementation will use the project’s shared React and Tailwind components plus semantic theme tokens.
