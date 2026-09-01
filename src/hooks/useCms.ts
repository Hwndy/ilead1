import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/* ------------------------------------------------------------------ */
/*  school_info                                                        */
/* ------------------------------------------------------------------ */

export interface SchoolInfoMap {
  [key: string]: string;
}

const SCHOOL_INFO_DEFAULTS: SchoolInfoMap = {
  name: 'iVintage College',
  motto: '\u2026redefining western and Islamic intellectualism',
  address: 'iLead Vintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos',
  address_alt: '28, Olayinka Jumbo Street, off Noah Junction, Ebutte, Ikorodu, Lagos',
  contact_phone: '+234 813 418 7710',
  contact_phone_alt: '0705 427 3127, 0802 322 6806',
  contact_email: 'ileadvintagecollege@gmail.com',
  contact_email_alt: 'info@ileadcollege.com',
  whatsapp_number: '2348134187710',
  facebook_url: '',
  twitter_url: '',
  instagram_url: '',

  youtube_url: '',
  tiktok_url: '',
  stat_students: '600+',
  stat_teachers: '60+',
  stat_years: '',
  stat_success_rate: '98%',
  logo_url: '/ivintage_logo.png',
};

export function useSchoolInfo() {
  const query = useQuery({
    queryKey: ['cms', 'school_info'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SchoolInfoMap> => {
      const { data, error } = await supabase
        .from('school_info')
        .select('info_key, info_value, is_active')
        .eq('is_active', true);
      if (error) throw error;
      const map: SchoolInfoMap = { ...SCHOOL_INFO_DEFAULTS };
      (data || []).forEach((row) => {
        if (row?.info_key && row?.info_value != null) map[row.info_key] = String(row.info_value);
      });
      return map;
    },
  });
  return { info: query.data ?? SCHOOL_INFO_DEFAULTS, isLoading: query.isLoading, error: query.error };
}

/* ------------------------------------------------------------------ */
/*  website_settings                                                   */
/* ------------------------------------------------------------------ */

export interface WebsiteSettingsMap {
  [key: string]: any;
}

export function useWebsiteSettings() {
  const query = useQuery({
    queryKey: ['cms', 'website_settings'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<WebsiteSettingsMap> => {
      const { data, error } = await supabase
        .from('website_settings')
        .select('setting_key, setting_value');
      if (error) throw error;
      const map: WebsiteSettingsMap = {};
      (data || []).forEach((row: any) => {
        map[row.setting_key] = row.setting_value;
      });
      return map;
    },
  });
  return { settings: query.data ?? {}, isLoading: query.isLoading, error: query.error };
}

// Helper: setting values are stored as jsonb; unwrap primitive strings/objects with fallback.
export function settingValue<T = any>(map: WebsiteSettingsMap, key: string, fallback: T): T {
  const v = map?.[key];
  if (v == null) return fallback;
  return v as T;
}

/* ------------------------------------------------------------------ */
/*  news_articles                                                      */
/* ------------------------------------------------------------------ */

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  category: string;
  featured_image: string | null;
  published_at: string | null;
  event_date: string | null;
  created_at: string;
}

export function useNews(opts: { category?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['cms', 'news', opts],
    queryFn: async (): Promise<NewsItem[]> => {
      let q = supabase
        .from('news_articles')
        .select('id,title,slug,excerpt,content,category,featured_image,published_at,event_date,created_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false, nullsFirst: false });
      if (opts.category) q = q.eq('category', opts.category);
      if (opts.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data as NewsItem[]) || [];
    },
  });
}

export function useNewsArticle(slug: string | undefined) {
  return useQuery({
    queryKey: ['cms', 'news', 'slug', slug],
    enabled: !!slug,
    queryFn: async (): Promise<NewsItem | null> => {
      const { data, error } = await supabase
        .from('news_articles')
        .select('id,title,slug,excerpt,content,category,featured_image,published_at,event_date,created_at')
        .eq('slug', slug!)
        .eq('is_published', true)
        .maybeSingle();
      if (error) throw error;
      return (data as NewsItem) ?? null;
    },
  });
}

/* ------------------------------------------------------------------ */
/*  gallery                                                            */
/* ------------------------------------------------------------------ */

export interface GalleryItem {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
  category: string;
  alt_text: string | null;
  is_featured: boolean;
  display_order: number;
}

export function useGallery(opts: { category?: string; featured?: boolean; limit?: number } = {}) {
  return useQuery({
    queryKey: ['cms', 'gallery', opts],
    queryFn: async (): Promise<GalleryItem[]> => {
      let q = supabase
        .from('gallery')
        .select('id,title,description,image_url,category,alt_text,is_featured,display_order')
        .order('display_order', { ascending: true });
      if (opts.category) q = q.eq('category', opts.category);
      if (opts.featured) q = q.eq('is_featured', true);
      if (opts.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data as GalleryItem[]) || [];
    },
  });
}

/* ------------------------------------------------------------------ */
/*  testimonials                                                       */
/* ------------------------------------------------------------------ */

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number | null;
  image_url: string | null;
  is_featured: boolean;
}

export function useTestimonials(opts: { featured?: boolean; limit?: number } = {}) {
  return useQuery({
    queryKey: ['cms', 'testimonials', opts],
    queryFn: async (): Promise<Testimonial[]> => {
      let q = supabase
        .from('testimonials')
        .select('id,name,role,content,rating,image_url,is_featured')
        .eq('is_published', true)
        .order('is_featured', { ascending: false });
      if (opts.featured) q = q.eq('is_featured', true);
      if (opts.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Testimonial[]) || [];
    },
  });
}