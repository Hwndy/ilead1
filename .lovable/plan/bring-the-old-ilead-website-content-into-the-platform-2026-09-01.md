# Bring the old iLead website content into the platform

The client has no WordPress site to migrate technically — only screenshots. So this is a content transfer: lift the real copy from the old site into the website section already built here, replacing placeholder defaults.

## Content extracted from the screenshots

**Identity**
- Tagline: "...redefining western and Islamic intellectualism"
- About blurb: "We deliver a perfect blend of western and Islamic education as well as proficiency in ICT, with coding being a major component."
- Vision: To be the largest network of Neighbourhood Schools of Choice in Nigeria
- Mission: To nurture leaders who are committed to excellence and imbued with a perfect blend of Western and Islamic education with a solid foundation in ICT
- Target: To establish a network of schools with branches in all 20 LGs in Lagos and all 774 LGs in Nigeria

**Four pillars (replaces the generic "Why choose us" cards)**
1. Academic Excellence — sound, highly qualitative western education; distinction scores in internal and external examinations.
2. ICT — Microsoft Office proficiency (Word, Excel, PowerPoint, Access), basic programming and coding, robotics.
3. Hifdhul Qur'an, Islamic Education and Arabic — Qur'an memorisation (at least a quarter), Arabic literacy, sound morals, understanding of Islamic beliefs and values.
4. Leadership Development — leadership training classes, mentoring and coaching, clubs and associations (literacy and debating, book readers, karate), guidance and counselling.

**Admissions**
- Entrance examination every Saturday, 10am prompt.
- Enquiry lines from the old site: +234 818 803 2057, +234 805 317 1279.

**Testimonials (students, from the old site)**
- Orelesi Al Aameen, Lekki Farraj, Oreagba Abd Hamid, Agbaje Fatia — quotes used verbatim.

**Contact / footer**
- Phones 0705 427 3127, 0802 322 6806; email info@ileadcollege.com
- Two locations: 28 Olayinka Jumbo Street, off Noah Junction, Ebutte, Ikorodu, Lagos; and iLead Vintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos.

Old-site photos are low quality and carry the orange theme, so they are not imported; existing imagery and the navy/lime brand stay.

## What gets changed

1. **Home page** — pillars, programme blurbs, admissions-at-a-glance (Saturday entrance exam + enquiry lines), and hero tagline use the real copy.
2. **About page** — vision, mission and the network target replace the placeholder text; history paragraphs rewritten around the blend of western/Islamic education and ICT.
3. **Testimonials** — the four student quotes seeded so the section is no longer empty.
4. **Footer / contact info** — second campus address, the additional phone numbers, and info@ileadcollege.com added alongside the current ones.

## Technical notes

- Copy lives in the CMS (`website_settings`, `school_info`, `testimonials`), so the school can edit it later. Component defaults in `src/components/website/home/*`, `AboutPage.tsx` and `useCms.ts` are updated to match, so the site reads correctly even before the database rows exist.
- `db/seed-ivintage.sql` is extended with the same values (upserts) so a fresh database gets the real content.
- Existing rows already seeded in the live database are updated in place — database values override component defaults, so both must move together.
- No layout, routing, or backend logic changes.

## Open item

The old site lists info@ileadcollege.com while the app currently uses ileadvintagecollege@gmail.com. Both are kept unless you say which is primary.
