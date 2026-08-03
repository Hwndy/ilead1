
-- Ensure PostgREST anonymous reads work for public CMS tables
GRANT SELECT ON public.school_info TO anon, authenticated;
GRANT SELECT ON public.website_settings TO anon, authenticated;
GRANT SELECT ON public.news_articles TO anon, authenticated;
GRANT SELECT ON public.gallery TO anon, authenticated;
GRANT SELECT ON public.testimonials TO anon, authenticated;
GRANT SELECT ON public.website_pages TO anon, authenticated;
GRANT SELECT ON public.website_sections TO anon, authenticated;

GRANT ALL ON public.school_info TO service_role;
GRANT ALL ON public.website_settings TO service_role;
GRANT ALL ON public.news_articles TO service_role;
GRANT ALL ON public.gallery TO service_role;
GRANT ALL ON public.testimonials TO service_role;
GRANT ALL ON public.website_pages TO service_role;
GRANT ALL ON public.website_sections TO service_role;

-- Seed default school_info keys (do nothing on conflict)
INSERT INTO public.school_info (info_key, info_value, category, is_active) VALUES
  ('name', 'Al-Bari Group of Schools', 'general', true),
  ('motto', 'Building Tomorrow''s Leaders Today', 'general', true),
  ('address', 'Lagos, Nigeria', 'contact', true),
  ('contact_phone', '+234 813 418 7710', 'contact', true),
  ('contact_email', 'info@albari.com.ng', 'contact', true),
  ('whatsapp_number', '2348134187710', 'contact', true),
  ('facebook_url', '', 'social', true),
  ('twitter_url', '', 'social', true),
  ('instagram_url', '', 'social', true),
  ('youtube_url', '', 'social', true),
  ('tiktok_url', '', 'social', true),
  ('stat_students', '500+', 'statistics', true),
  ('stat_teachers', '40+', 'statistics', true),
  ('stat_years', '22+', 'statistics', true),
  ('stat_success_rate', '98%', 'statistics', true),
  ('logo_url', '/albari_logo.jpg', 'general', true)
ON CONFLICT (info_key) DO NOTHING;

-- Seed default website_settings keys
INSERT INTO public.website_settings (setting_key, setting_value, description) VALUES
  ('hero_badge', to_jsonb('Excellence in Education Since 2004'::text), 'Homepage hero badge text'),
  ('hero_title', to_jsonb('Building Tomorrow''s'::text), 'Homepage hero title'),
  ('hero_title_highlight', to_jsonb('Leaders Today'::text), 'Highlighted portion of hero title'),
  ('hero_subtitle', to_jsonb('At Al-Bari Group of Schools, we are committed to nurturing young minds and developing future leaders through innovative education, character building, and academic excellence.'::text), 'Homepage hero subtitle'),
  ('hero_cta_primary_label', to_jsonb('Apply Now'::text), 'Primary hero CTA label'),
  ('hero_cta_secondary_label', to_jsonb('Learn More'::text), 'Secondary hero CTA label'),
  ('hero_images', '["/albari-campus.png","/img1.png","/img2.png","/img3.png"]'::jsonb, 'Rotating hero background images'),
  ('principal_name', to_jsonb('Dr. Awe'::text), 'Principal display name'),
  ('principal_title', to_jsonb('Director of Studies'::text), 'Principal title'),
  ('principal_photo_url', to_jsonb('/awe.png'::text), 'Principal portrait URL'),
  ('principal_message', to_jsonb('For over two decades, Al-Bari Group of Schools has been a sanctuary where bright minds are nurtured into principled leaders. We believe that true education is the marriage of intellectual rigour and moral clarity, and every child who walks through our gates is treated as a future custodian of that vision.\n\nWelcome to a community that will challenge, support and celebrate your child.'::text), 'Principal welcome message'),
  ('accreditations', '[
    {"name":"WAEC","desc":"West African Examinations Council","icon":"Award"},
    {"name":"NECO","desc":"National Examinations Council","icon":"ShieldCheck"},
    {"name":"Cambridge","desc":"Cambridge Assessment","icon":"BookMarked"},
    {"name":"Ministry of Education","desc":"Federal Republic of Nigeria","icon":"Building2"},
    {"name":"NUC Recognised","desc":"Pathway Partner","icon":"GraduationCap"}
  ]'::jsonb, 'Accreditation bodies'),
  ('how_to_apply_steps', '[
    {"n":"01","icon":"FileText","title":"Submit Application","body":"Complete the online application with your child''s details and upload required documents."},
    {"n":"02","icon":"CreditCard","title":"Sit Entrance Assessment","body":"Pay the application fee and attend the scheduled entrance examination and interview."},
    {"n":"03","icon":"GraduationCap","title":"Accept Your Offer","body":"Receive your offer letter, pay acceptance fees and join the Al-Bari family."}
  ]'::jsonb, 'How to apply steps'),
  ('portals', '[
    {"title":"Student Portal","description":"Access exam schedules, results, assignments, and academic resources","icon":"GraduationCap","link":"/login?portal=true&role=student","features":["View Exam Results","Class Schedules","Assignments","Academic Calendar"],"enabled":true},
    {"title":"Parent Portal","description":"Monitor your child''s academic progress, attendance, and school activities","icon":"Users","link":"/login?portal=true&role=parent","features":["Child''s Progress","Fee Payment","Communication","Events Updates"],"enabled":true},
    {"title":"Teacher Portal","description":"Manage classes, create exams, track student performance and communicate with parents","icon":"UserCheck","link":"/login?portal=true&role=teacher","features":["Class Management","Exam Creation","Grade Reports","Student Records"],"enabled":true},
    {"title":"Admin Portal","description":"Comprehensive school management system for administrators and staff","icon":"Shield","link":"/login?portal=true&role=admin","features":["User Management","System Settings","Reports","School Analytics"],"enabled":true}
  ]'::jsonb, 'Portal cards for /portals page'),
  ('about_history', to_jsonb('Al-Bari Group of Schools was founded in 2004 with a vision to provide quality education that combines academic excellence with moral values. What started as a small institution with just 50 students has grown into one of Lagos'' most respected educational establishments.\n\nOver the years, we have consistently maintained our commitment to excellence, producing graduates who have gone on to achieve success in various fields including medicine, engineering, law, and business.\n\nOur journey has been marked by continuous innovation in teaching methodologies, infrastructure development, and the integration of modern technology into traditional learning approaches.'::text), 'About page history'),
  ('about_vision', to_jsonb('To be the leading educational institution in Nigeria, recognized for academic excellence, character development, and the production of well-rounded individuals who contribute positively to society.'::text), 'Vision statement'),
  ('about_mission', to_jsonb('To provide quality education that nurtures intellectual growth, moral development, and practical skills, preparing students to excel in their chosen careers while maintaining the highest ethical standards.'::text), 'Mission statement'),
  ('facilities_intro', to_jsonb('Modern infrastructure designed to support effective teaching, learning, and character development'::text), 'Facilities page intro'),
  ('facilities', '[
    {"title":"Modern Library","description":"Extensive collection of books, digital resources, and quiet study spaces for enhanced learning.","icon":"BookOpen"},
    {"title":"Science Laboratories","description":"Fully equipped labs for Biology, Chemistry, and Physics with modern equipment and safety measures.","icon":"Microscope"},
    {"title":"Computer Laboratory","description":"State-of-the-art computers with high-speed internet for digital literacy and research.","icon":"Monitor"},
    {"title":"Sports Complex","description":"Indoor and outdoor facilities including basketball court, football field, and athletics track.","icon":"Trophy"},
    {"title":"Cafeteria","description":"Hygienic food service providing nutritious meals and refreshments for students and staff.","icon":"Utensils"},
    {"title":"Transportation","description":"Safe and reliable school bus services covering major routes across Lagos.","icon":"Bus"}
  ]'::jsonb, 'Facilities list'),
  ('newsletter_enabled', to_jsonb(true), 'Show newsletter block on homepage')
ON CONFLICT (setting_key) DO NOTHING;
