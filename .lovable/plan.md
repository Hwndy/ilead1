# Public Website Redesign + Full Admin Content Control

Two goals: a fully redesigned public website that stays clear and easy to read, and an admin "Website" workspace where every word, image, form field and setting on the public site can be changed without touching code.

## 1. Redesigned public website

Every public page gets a new layout, keeping all existing content, links and routes:

- Home: new hero, pillars, programmes, principal's welcome, achievements, testimonials, news, gallery strip, admissions call-to-action, visit-us block.
- About, Admissions, Facilities, School Life, Gallery, News, Testimonials, Careers, Portals, Apply, Track Application, Accept Offer.
- Consistent white/light theme with iVintage navy and lime accents, the arch/book motif used sparingly, stronger typography scale, generous spacing, readable line lengths.
- Better mobile behaviour: simpler menu, larger tap targets, stacked sections, faster-loading images.
- Clear content first: every section keeps a plain heading, short intro and obvious next action. No decoration that hides information.

## 2. Admin "Website" workspace

A single area in the admin dashboard, organised page by page, with a live side-by-side preview that updates as the admin types. Save publishes; nothing changes on the live site until saved.

What the admin can edit:

- **Page content**: every heading, paragraph, list item, button label and link on every public page, section by section. Sections can be reordered, hidden or shown.
- **Navigation & footer**: menu items, order, footer columns, contact details, social links, opening hours, WhatsApp number.
- **School profile**: name, motto, addresses, phones, emails, statistics, logo.
- **Media library**: drag-and-drop uploads from the device, or paste an image link. Reused anywhere an image is needed, with alt text for accessibility.
- **News & events, Gallery, Testimonials**: existing managers rebuilt to match the new editor, with drafts, publishing and ordering.
- **Admission application form builder**: add, remove, reorder and rename fields; set field type (text, number, date, choice, file upload), mark required, add help text, group into steps. The public application form and the admin review screens follow the builder automatically, and existing submissions stay readable.
- **Admissions settings**: required documents, deadlines, session, instructions, bank transfer details, offer-letter wording.
- **Newsletter & contact submissions**: view and export entries captured from the website.
- **SEO per page**: page title, description, social share image.

Safety: only admins can open this area; edits are logged in the existing audit trail; the site falls back to the current built-in text if a field is left empty, so the website can never render blank.

## 3. Technical notes

- Database: extend the existing CMS tables (`website_settings`, `school_info`, `news_articles`, `gallery`, `testimonials`) and add `site_pages`, `site_sections` (typed JSON blocks, ordered, publishable), `site_menu_items`, `site_media`, `form_definitions` + `form_fields`, `form_submissions`, `page_seo`. All in `public`, with GRANTs, RLS (`anon`/`authenticated` read published rows; admin write via `has_role`), `school_id` scoping and `updated_at` triggers. Delivered as `db/phase9-cms.sql` plus a seed script that migrates today's hardcoded copy into the tables so nothing is lost.
- Storage: public `site-media` bucket for uploads, with admin-only write policies.
- Frontend: extend `src/hooks/useCms.ts` with `useSitePage(slug)`, `useMenu`, `useMedia`, `useFormDefinition(key)`; a `SectionRenderer` maps section types to redesigned React section components, so new sections need no route changes.
- Admin: new `src/components/admin/website/` workspace (page list, section editor, block forms, media picker, form builder, menu editor, SEO panel) mounted under the existing `website` tab; live preview renders the same section components against unsaved draft state.
- Application form: `AdmissionForm.tsx` becomes schema-driven from `form_fields`, with zod validation generated from the definition; answers stored in a JSON column alongside the existing typed columns so current admissions, offer letters and exports keep working.
- Verification: typecheck, build, and Playwright passes over every public route at desktop and mobile, plus an admin edit-save-reflect round trip.

## Out of scope

Signed-in dashboards (admin, teacher, student, parent) keep their current styling and behaviour.
