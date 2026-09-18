-- ============================================================================
-- Phase 9 — Website CMS: admin-editable content, sections, menus, media,
-- SEO and a dynamic form builder for the public application form.
-- Safe to re-run.
-- ============================================================================

-- ------------------------------------------------------------------- menu ---
CREATE TABLE IF NOT EXISTS public.site_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL DEFAULT 'primary', -- primary | more | footer
  label text NOT NULL,
  href text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ media ---
CREATE TABLE IF NOT EXISTS public.site_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  title text,
  alt_text text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------- seo ---
CREATE TABLE IF NOT EXISTS public.page_seo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL UNIQUE,
  title text,
  description text,
  og_image text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------- form builder -----
CREATE TABLE IF NOT EXISTS public.form_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key text NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text', -- text | textarea | number | date | select | checkbox | file
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  help_text text,
  is_required boolean NOT NULL DEFAULT false,
  step integer NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_key, field_key)
);

-- Dynamic answers captured alongside the fixed admission columns.
ALTER TABLE public.admission_applications
  ADD COLUMN IF NOT EXISTS custom_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Website enquiry / newsletter capture
CREATE TABLE IF NOT EXISTS public.site_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key text NOT NULL DEFAULT 'contact',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------- grants ---
GRANT SELECT ON public.site_menu_items, public.site_media, public.page_seo, public.form_definitions, public.form_fields TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_menu_items, public.site_media, public.page_seo, public.form_definitions, public.form_fields TO authenticated;
GRANT INSERT ON public.site_submissions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.site_submissions TO authenticated;
GRANT ALL ON public.site_menu_items, public.site_media,
  public.page_seo, public.form_definitions, public.form_fields, public.site_submissions TO service_role;

-- -------------------------------------------------------------------- RLS ---
ALTER TABLE public.site_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_seo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_submissions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_menu_items','site_media','page_seo','form_definitions','form_fields']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public read %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Public read %1$s" ON public.%1$I FOR SELECT USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %1$s" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Admins manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))',
      t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Anyone can submit" ON public.site_submissions;
CREATE POLICY "Anyone can submit" ON public.site_submissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins read submissions" ON public.site_submissions;
CREATE POLICY "Admins read submissions" ON public.site_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins delete submissions" ON public.site_submissions;
CREATE POLICY "Admins delete submissions" ON public.site_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------------- triggers ---
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_form_fields_updated ON public.form_fields';
    EXECUTE 'CREATE TRIGGER trg_form_fields_updated BEFORE UPDATE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

-- ---------------------------------------------------------------- indexes ---
CREATE INDEX IF NOT EXISTS idx_site_menu_location ON public.site_menu_items(location, display_order);
CREATE INDEX IF NOT EXISTS idx_form_fields_form ON public.form_fields(form_key, display_order);

-- ------------------------------------------------------------------ seeds ---
INSERT INTO public.form_definitions (form_key, title, description)
VALUES ('admission_application', 'Admission application', 'Extra questions shown on the public application form')
ON CONFLICT (form_key) DO NOTHING;

INSERT INTO public.site_menu_items (location, label, href, display_order) VALUES
  ('primary', 'Home', '/website', 1),
  ('primary', 'About Us', '/website/about', 2),
  ('primary', 'Admissions', '/website/admissions', 3),
  ('primary', 'School Life', '/website/school-life', 4),
  ('primary', 'News & Events', '/website/news', 5),
  ('primary', 'Portals', '/website/portals', 6),
  ('more', 'Gallery', '/website/gallery', 1),
  ('more', 'Testimonials', '/website/testimonials', 2),
  ('more', 'Facilities', '/website/facilities', 3),
  ('more', 'Careers', '/website/careers', 4)
ON CONFLICT DO NOTHING;

-- Public media bucket for website uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-media', 'site-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read site media" ON storage.objects;
CREATE POLICY "Public read site media" ON storage.objects FOR SELECT
  USING (bucket_id = 'site-media');
DROP POLICY IF EXISTS "Admins write site media" ON storage.objects;
CREATE POLICY "Admins write site media" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'site-media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'site-media' AND public.has_role(auth.uid(), 'admin'));
