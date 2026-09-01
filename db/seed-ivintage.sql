-- ============================================================
-- iVintage College branding / reference data
-- Run AFTER db/setup.sql in your new Supabase project.
-- Safe to re-run (upserts only).
-- ============================================================

-- --- Portal settings --------------------------------------------------------
INSERT INTO public.app_settings (setting_key, setting_value) VALUES
  ('school_name', '"iVintage College"'),
  ('academic_year', '"2025/2026"'),
  ('allow_student_registration', 'true')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- --- School information (used by ID cards, report cards, letters) -----------
INSERT INTO public.school_info (info_key, info_value, category) VALUES
  ('school_name', 'iVintage College', 'general'),
  ('motto', 'Knowledge. Character. Excellence.', 'general'),
  ('phone', '+234 813 418 7710', 'contact'),
  ('phone_alt', '+234 802 322 6806', 'contact'),
  ('phone_alt2', '+234 705 427 3127', 'contact'),
  ('email', 'ileadvintagecollege@gmail.com', 'contact'),
  ('address', 'Akinsanya Estate, Owode-Ibeshe Road, beside Ansar-Ud-Deen (ADS) Mosque, Ikorodu, Lagos', 'contact'),
  ('logo_url', '/ivintage_logo.png', 'branding'),
  ('student_count', '500+', 'statistics'),
  ('teacher_count', '50+', 'statistics'),
  ('success_rate', '98%', 'statistics')
ON CONFLICT (info_key) DO UPDATE SET info_value = EXCLUDED.info_value, category = EXCLUDED.category;

-- Remove stale Al-Bari entries that are not part of the new brand
DELETE FROM public.school_info WHERE info_key IN ('established', 'facebook', 'twitter', 'instagram')
  AND info_value ILIKE '%albari%';

-- --- Website / CMS settings -------------------------------------------------
INSERT INTO public.website_settings (setting_key, setting_value, description) VALUES
  ('site_title', '"iVintage College - Day School, Boarding & Tahfeedh"', 'Main site title'),
  ('site_tagline', '"Day School | Boarding | Tahfeedh"', 'Site tagline/motto'),
  ('contact_email', '"ileadvintagecollege@gmail.com"', 'Main contact email'),
  ('contact_phone', '"+234 813 418 7710"', 'Main contact phone'),
  ('contact_address', '"Akinsanya Estate, Owode-Ibeshe Road, beside Ansar-Ud-Deen (ADS) Mosque, Ikorodu, Lagos"', 'Campus address'),
  ('logo_url', '"/ivintage_logo.png"', 'School logo'),
  ('school_colors', '{"primary": "#141C2B", "secondary": "#C6D92D", "accent": "#C6D92D"}', 'School brand colors')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, description = EXCLUDED.description;

-- --- Website copy from the school's previous site ---------------------------
INSERT INTO public.school_info (info_key, info_value, category) VALUES
  ('motto', '…redefining western and Islamic intellectualism', 'general'),
  ('address', 'iLead Vintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos', 'contact'),
  ('address_alt', '28, Olayinka Jumbo Street, off Noah Junction, Ebutte, Ikorodu, Lagos', 'contact'),
  ('contact_phone_alt', '0705 427 3127, 0802 322 6806', 'contact'),
  ('contact_email_alt', 'info@ileadcollege.com', 'contact')
ON CONFLICT (info_key) DO UPDATE SET info_value = EXCLUDED.info_value, category = EXCLUDED.category;

INSERT INTO public.website_settings (setting_key, setting_value, description) VALUES
  ('site_tagline', '"…redefining western and Islamic intellectualism"', 'Site tagline'),
  ('hero_title', '"…redefining western and"', 'Hero headline'),
  ('hero_title_highlight', '"Islamic intellectualism"', 'Hero headline highlight'),
  ('hero_subtitle', '"We deliver a perfect blend of western and Islamic education as well as proficiency in ICT, with coding being a major component."', 'Hero subtitle'),
  ('about_vision', '"To be the largest network of Neighbourhood Schools of Choice in Nigeria."', 'Vision statement'),
  ('about_mission', '"To nurture leaders who are committed to excellence and imbued with a perfect blend of Western and Islamic education with a solid foundation in ICT."', 'Mission statement'),
  ('about_target', '"To establish a network of schools with branches in all 20 Local Governments in Lagos, and all 774 Local Governments in Nigeria."', 'Growth target'),
  ('home_pillars_heading', '"A perfect blend of western and Islamic education"', 'Pillars heading'),
  ('home_pillars_intro', '"Four pillars shape every child who passes through iVintage College  with coding a major component."', 'Pillars intro'),
  ('home_pillars', '[{"title":"Academic excellence","description":"Sound, highly qualitative western education, with distinction scores maintained in both internal and external examinations.","image":"/img1.png"},{"title":"ICT and coding","description":"Proficiency in Microsoft Office (Word, Excel, PowerPoint, Access), basic programming and coding, and robotics.","image":"/img3.png"},{"title":"Hifdhul Qur’an, Islamic education and Arabic","description":"Qur’an memorisation  at least a quarter of the whole Qur’an  Arabic literacy and proficiency, very sound morals, and a high level of understanding of Islamic beliefs and values.","image":"/img2.png"},{"title":"Leadership development","description":"Leadership training classes, mentoring and coaching programmes, clubs and associations (literacy and debating, book readers, karate and more), plus guidance and counselling.","image":"/campus.png"}]', 'Home pillars'),
  ('home_key_dates_note', '"Entrance examinations hold every Saturday at 10am prompt. Apply early  places in each class are limited."', 'Admissions note'),
  ('home_key_dates', '[{"label":"Applications","value":"Now open","icon":"ClipboardList"},{"label":"Entrance examination","value":"Every Saturday, 10am prompt","icon":"FileCheck2"},{"label":"Enquiry lines","value":"+234 818 803 2057, +234 805 317 1279","icon":"CalendarDays"},{"label":"New session begins","value":"September","icon":"GraduationCap"}]', 'Admissions key dates')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, description = EXCLUDED.description;

-- --- Student testimonials from the previous site ----------------------------
INSERT INTO public.testimonials (name, role, content, rating, is_featured, is_published, created_by)
SELECT v.name, v.role, v.content, 5, true, true,
       (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1)
FROM (VALUES
  ('Orelesi Al Aameen', 'Student', 'iLead is a school of many experiences for everyone; it is one of the best schools in Ikorodu.'),
  ('Lekki Farraj', 'Student', 'iLead College is a school of prestige  a place for diverse Islamic intellectualism and a fountain of knowledge beyond measure.'),
  ('Oreagba Abd Hamid', 'Student', 'iLead College is a school filled with lots of experiences and outcomes. It teaches good morals, leadership skills and outstanding western educational knowledge.'),
  ('Agbaje Fatia', 'Student', 'iLead is a group of schools located in different locations. A good moralistic, disciplined, interactive and educational academy  a great school where we are taught islamically coupled with westernism, and teachers focus on students'' all-round excellent performance.')
) AS v(name, role, content)
WHERE NOT EXISTS (SELECT 1 FROM public.testimonials t WHERE t.name = v.name);
