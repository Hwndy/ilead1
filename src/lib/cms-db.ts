import { supabase } from '@/integrations/supabase/client';

/**
 * Untyped view of the Supabase client for the CMS tables introduced in
 * db/phase9-cms.sql (they are not part of the generated types yet).
 */
export const cmsDb = supabase as unknown as {
  from: (table: string) => any;
  storage: typeof supabase.storage;
  auth: typeof supabase.auth;
};

export const CMS_TABLES = {
  content: 'site_content',
  sections: 'site_sections',
  menu: 'site_menu_items',
  media: 'site_media',
  seo: 'page_seo',
  formFields: 'form_fields',
  submissions: 'site_submissions',
} as const;
