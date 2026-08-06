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
