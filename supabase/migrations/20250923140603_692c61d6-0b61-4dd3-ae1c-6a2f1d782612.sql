-- Create website CMS tables for Al-Bari Group of Schools Website

-- Website pages for static content management
CREATE TABLE public.website_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text,
  meta_title text,
  meta_description text,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Website sections for reusable content blocks
CREATE TABLE public.website_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id uuid,
  section_type text NOT NULL, -- 'hero', 'statistics', 'content', 'gallery', etc.
  title text,
  content text,
  image_url text,
  section_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  FOREIGN KEY (page_id) REFERENCES public.website_pages(id) ON DELETE CASCADE
);

-- News and events articles
CREATE TABLE public.news_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL,
  featured_image text,
  category text NOT NULL DEFAULT 'news', -- 'news', 'events', 'announcements'
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  event_date timestamp with time zone, -- for events
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Gallery for images and media
CREATE TABLE public.gallery (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  category text NOT NULL DEFAULT 'general', -- 'facilities', 'events', 'activities', etc.
  alt_text text,
  is_featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- School information and settings
CREATE TABLE public.school_info (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  info_key text NOT NULL UNIQUE,
  info_value text NOT NULL,
  category text NOT NULL DEFAULT 'general', -- 'contact', 'social', 'statistics', etc.
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Testimonials from students and parents
CREATE TABLE public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL, -- 'student', 'parent', 'alumni', 'staff'
  content text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  image_url text,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Website settings for global configuration
CREATE TABLE public.website_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all website tables
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for website content (public read access, admin write access)
CREATE POLICY "Public can view published pages" ON public.website_pages
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage pages" ON public.website_pages
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view active sections" ON public.website_sections
  FOR SELECT USING (is_active = true AND EXISTS (
    SELECT 1 FROM public.website_pages 
    WHERE id = website_sections.page_id AND is_published = true
  ));

CREATE POLICY "Admins can manage sections" ON public.website_sections
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view published articles" ON public.news_articles
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage articles" ON public.news_articles
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view gallery" ON public.gallery
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage gallery" ON public.gallery
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view active school info" ON public.school_info
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage school info" ON public.school_info
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view published testimonials" ON public.testimonials
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage testimonials" ON public.testimonials
  FOR ALL USING (is_admin());

CREATE POLICY "Admins can manage website settings" ON public.website_settings
  FOR ALL USING (is_admin());

CREATE POLICY "Public can view website settings" ON public.website_settings
  FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX idx_website_pages_slug ON public.website_pages(slug);
CREATE INDEX idx_website_pages_published ON public.website_pages(is_published);
CREATE INDEX idx_website_sections_page_order ON public.website_sections(page_id, section_order);
CREATE INDEX idx_news_articles_slug ON public.news_articles(slug);
CREATE INDEX idx_news_articles_published ON public.news_articles(is_published, published_at);
CREATE INDEX idx_news_articles_category ON public.news_articles(category);
CREATE INDEX idx_gallery_category ON public.gallery(category);
CREATE INDEX idx_school_info_key ON public.school_info(info_key);
CREATE INDEX idx_testimonials_featured ON public.testimonials(is_featured, is_published);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_website_pages_updated_at
  BEFORE UPDATE ON public.website_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_website_sections_updated_at
  BEFORE UPDATE ON public.website_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_news_articles_updated_at
  BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_school_info_updated_at
  BEFORE UPDATE ON public.school_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_website_settings_updated_at
  BEFORE UPDATE ON public.website_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial school information
INSERT INTO public.school_info (info_key, info_value, category) VALUES
('school_name', 'Al-Bari Group of Schools', 'general'),
('phone', '+234 813 418 7710', 'contact'),
('email', 'info@albari.edu.ng', 'contact'),
('address', 'Lagos, Nigeria', 'contact'),
('established', '2010', 'general'),
('student_count', '500+', 'statistics'),
('teacher_count', '50+', 'statistics'),
('success_rate', '98%', 'statistics'),
('facebook', 'https://facebook.com/albariGroup of Schools', 'social'),
('twitter', 'https://twitter.com/albariGroup of Schools', 'social'),
('instagram', 'https://instagram.com/albariGroup of Schools', 'social');

-- Insert initial website settings
INSERT INTO public.website_settings (setting_key, setting_value, description) VALUES
('site_title', '"Al-Bari Group of Schools - Excellence in Education"', 'Main site title'),
('site_tagline', '"Building Tomorrow''s Leaders Today"', 'Site tagline/motto'),
('contact_email', '"info@albari.edu.ng"', 'Main contact email'),
('contact_phone', '"+234 813 418 7710"', 'Main contact phone'),
('social_links', '{"facebook": "https://facebook.com/albariGroup of Schools", "twitter": "https://twitter.com/albariGroup of Schools", "instagram": "https://instagram.com/albariGroup of Schools"}', 'Social media links'),
('school_colors', '{"primary": "#22c55e", "secondary": "#16a34a", "accent": "#15803d"}', 'School brand colors');