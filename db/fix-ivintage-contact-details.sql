-- Correct saved iVintage College contact details in an existing database.
-- Run this once on the live database if old CMS rows are still overriding the app defaults.

DO $$
BEGIN
  IF to_regclass('public.school_info') IS NOT NULL THEN
    INSERT INTO public.school_info (info_key, info_value, category, is_active) VALUES
      ('name', 'iVintage College', 'general', true),
      ('school_name', 'iVintage College', 'general', true),
      ('address', 'iVintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos', 'contact', true),
      ('contact_phone', '+234 813 419 7710', 'contact', true),
      ('phone', '+234 813 419 7710', 'contact', true),
      ('whatsapp_number', '2348134197710', 'contact', true),
      ('contact_email', 'ivintagecollege@gmail.com', 'contact', true),
      ('email', 'ivintagecollege@gmail.com', 'contact', true),
      ('logo_url', '/ivintage_logo.png', 'branding', true)
    ON CONFLICT (info_key) DO UPDATE SET
      info_value = EXCLUDED.info_value,
      category = EXCLUDED.category,
      is_active = EXCLUDED.is_active,
      updated_at = now();

    UPDATE public.school_info
    SET is_active = false,
        info_value = '',
        category = 'contact',
        updated_at = now()
    WHERE info_key IN ('address_alt', 'contact_phone_alt', 'contact_email_alt', 'phone_alt', 'phone_alt2');
  END IF;

  IF to_regclass('public.website_settings') IS NOT NULL THEN
    INSERT INTO public.website_settings (setting_key, setting_value, description) VALUES
      ('contact_email', to_jsonb('ivintagecollege@gmail.com'::text), 'Main contact email'),
      ('contact_phone', to_jsonb('+234 813 419 7710'::text), 'Main contact phone'),
      ('contact_address', to_jsonb('iVintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos'::text), 'Campus address'),
      ('apply.help_text', to_jsonb('Need help? Call the admissions office on +234 813 419 7710.'::text), 'Application page help note'),
      ('admissions.contacts', '[{"label":"Admissions office","value":"+234 813 419 7710"},{"label":"Email","value":"ivintagecollege@gmail.com"},{"label":"Office hours","value":"Mon – Fri, 8AM – 4PM"}]'::jsonb, 'Admissions contact cards'),
      ('home_key_dates', '[{"label":"Applications","value":"Now open","icon":"ClipboardList"},{"label":"Entrance examination","value":"Every Saturday, 10am prompt","icon":"FileCheck2"},{"label":"Enquiry line","value":"+234 813 419 7710","icon":"CalendarDays"},{"label":"New session begins","value":"September","icon":"GraduationCap"}]'::jsonb, 'Admissions key dates')
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      description = EXCLUDED.description,
      updated_at = now();
  END IF;

  IF to_regclass('public.schools') IS NOT NULL THEN
    UPDATE public.schools
    SET contact_email = 'ivintagecollege@gmail.com',
        contact_phone = '+234 813 419 7710',
        address = 'iVintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos',
        updated_at = now()
    WHERE lower(coalesce(name, '')) LIKE '%ivintage%'
       OR lower(coalesce(name, '')) LIKE '%i vintage%'
       OR lower(coalesce(name, '')) LIKE '%ilead%'
       OR lower(coalesce(subdomain, '')) = 'default';
  END IF;
END $$;