import { useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cmsDb, CMS_TABLES } from '@/lib/cms-db';
import { subscribeToDraft, getDraft, getServerDraft } from '@/lib/cms-preview';
import { SITE_DEFAULTS } from '@/config/siteSchema';

const OFFICIAL_CONTACT = {
  email: 'ivintagecollege@gmail.com',
  phone: '+234 813 419 7710',
  whatsapp: '2348134197710',
  address: 'iVintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos',
} as const;

const CONTACT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/iVintagevintagecollege@gmail\.com/gi, OFFICIAL_CONTACT.email],
  [/ileadvintagecollege@gmail\.com/gi, OFFICIAL_CONTACT.email],
  [/info@iVintagecollege\.com/gi, OFFICIAL_CONTACT.email],
  [/info@ileadcollege\.com/gi, OFFICIAL_CONTACT.email],
  [/admissions@ivintagecollege\.com/gi, OFFICIAL_CONTACT.email],
  [/info@albari\.edu\.ng/gi, OFFICIAL_CONTACT.email],
  [/info@albari\.com\.ng/gi, OFFICIAL_CONTACT.email],
  [/iLead Vintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos/gi, OFFICIAL_CONTACT.address],
  [/Akinsanya Estate, Owode-Ibeshe Road, beside Ansar-Ud-Deen \(ADS\) Mosque, Ikorodu, Lagos/gi, OFFICIAL_CONTACT.address],
  [/\+234 813 418 7710/g, OFFICIAL_CONTACT.phone],
  [/2348134187710/g, OFFICIAL_CONTACT.whatsapp],
  [/\+234 802 322 6806/g, OFFICIAL_CONTACT.phone],
  [/\+234 705 427 3127/g, OFFICIAL_CONTACT.phone],
  [/0705 427 3127/g, OFFICIAL_CONTACT.phone],
  [/0802 322 6806/g, OFFICIAL_CONTACT.phone],
  [/\+234 818 803 2057, \+234 805 317 1279/g, OFFICIAL_CONTACT.phone],
];

function normalizeContactString(value: string) {
  return CONTACT_REPLACEMENTS.reduce(
    (next, [pattern, replacement]) => next.replace(pattern, replacement),
    value,
  ).replace(/\+234 813 419 7710,\s*\+234 813 419 7710/g, OFFICIAL_CONTACT.phone);
}

function normalizeContactValue<T>(value: T): T {
  if (typeof value === 'string') return normalizeContactString(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeContactValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeContactValue(item)]),
    ) as T;
  }
  return value;
}

function normalizeSchoolInfo(map: SchoolInfoMap): SchoolInfoMap {
  return {
    ...Object.fromEntries(Object.entries(map).map(([key, value]) => [key, normalizeContactString(value)])),
    name: 'iVintage College',
    school_name: 'iVintage College',
    address: OFFICIAL_CONTACT.address,
    address_alt: '',
    contact_phone: OFFICIAL_CONTACT.phone,
    phone: OFFICIAL_CONTACT.phone,
    contact_phone_alt: '',
    phone_alt: '',
    phone_alt2: '',
    contact_email: OFFICIAL_CONTACT.email,
    email: OFFICIAL_CONTACT.email,
    contact_email_alt: '',
    whatsapp_number: OFFICIAL_CONTACT.whatsapp,
    logo_url: '/ivintage_logo.png',
  };
}

function normalizeWebsiteSettings(map: WebsiteSettingsMap): WebsiteSettingsMap {
  const normalized = Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key, normalizeContactValue(value)]),
  ) as WebsiteSettingsMap;

  normalized.contact_email = OFFICIAL_CONTACT.email;
  normalized.contact_phone = OFFICIAL_CONTACT.phone;
  normalized.contact_address = OFFICIAL_CONTACT.address;
  normalized['apply.help_text'] = `Need help? Call the admissions office on ${OFFICIAL_CONTACT.phone}.`;
  normalized['admissions.contacts'] = [
    { label: 'Admissions office', value: OFFICIAL_CONTACT.phone },
    { label: 'Email', value: OFFICIAL_CONTACT.email },
    { label: 'Office hours', value: 'Mon – Fri, 8AM – 4PM' },
  ];
  normalized.home_key_dates = [
    { label: 'Applications', value: 'Now open', icon: 'ClipboardList' },
    { label: 'Entrance examination', value: 'Every Saturday, 10am prompt', icon: 'FileCheck2' },
    { label: 'Enquiry line', value: OFFICIAL_CONTACT.phone, icon: 'CalendarDays' },
    { label: 'New session begins', value: 'September', icon: 'GraduationCap' },
  ];

  return normalized;
}


/* ------------------------------------------------------------------ */
/*  school_info                                                        */
/* ------------------------------------------------------------------ */

export interface SchoolInfoMap {
  [key: string]: string;
}

const SCHOOL_INFO_DEFAULTS: SchoolInfoMap = {
  name: 'iVintage College',
  motto: '\u2026redefining western and Islamic intellectualism',
  address: 'iVintage College Complex, Akinsanya Estate, beside ADS Mosque, Ibeshe Road, Ikorodu, Lagos',
  address_alt: '',
  contact_phone: '+234 813 419 7710',
  contact_email: 'ivintagecollege@gmail.com',
  whatsapp_number: '2348134197710',
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
      return normalizeSchoolInfo(map);
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
    staleTime: 60 * 1000,
    queryFn: async (): Promise<WebsiteSettingsMap> => {
      const { data, error } = await supabase
        .from('website_settings')
        .select('setting_key, setting_value');
      if (error) throw error;
      const map: WebsiteSettingsMap = {};
      (data || []).forEach((row: any) => {
        map[row.setting_key] = row.setting_value;
      });
      return normalizeWebsiteSettings(map);
    },
  });

  // Unsaved values streamed in from the admin editor when previewing.
  const draft = useSyncExternalStore(subscribeToDraft, getDraft, getServerDraft);

  const settings = useMemo(() => {
    const saved = query.data ?? {};
    if (!draft) return saved;
    return { ...saved, ...draft };
  }, [query.data, draft]);

  return { settings, isLoading: query.isLoading, error: query.error };
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
/* ------------------------------------------------------------------ */
/*  Navigation menu (admin editable)                                   */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  id: string;
  location: 'primary' | 'more' | 'footer';
  label: string;
  href: string;
  display_order: number;
  is_visible: boolean;
}

export function useSiteMenu() {
  const query = useQuery({
    queryKey: ['cms', 'site_menu_items'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await cmsDb
        .from(CMS_TABLES.menu)
        .select('id,location,label,href,display_order,is_visible')
        .order('display_order', { ascending: true });
      if (error) return [];
      return (data as MenuItem[]) || [];
    },
  });
  const items = query.data ?? [];
  return {
    items,
    visible: (location: MenuItem['location']) =>
      items.filter((i) => i.location === location && i.is_visible),
    isLoading: query.isLoading,
  };
}

/* ------------------------------------------------------------------ */
/*  Media library                                                      */
/* ------------------------------------------------------------------ */

export interface MediaItem {
  id: string;
  url: string;
  title: string | null;
  alt_text: string | null;
  created_at: string;
}

export function useSiteMedia() {
  return useQuery({
    queryKey: ['cms', 'site_media'],
    queryFn: async (): Promise<MediaItem[]> => {
      const { data, error } = await cmsDb
        .from(CMS_TABLES.media)
        .select('id,url,title,alt_text,created_at')
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data as MediaItem[]) || [];
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Form builder fields                                                */
/* ------------------------------------------------------------------ */

export type FormFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'file';

export interface FormFieldDef {
  id: string;
  form_key: string;
  field_key: string;
  label: string;
  field_type: FormFieldType;
  options: string[];
  help_text: string | null;
  is_required: boolean;
  step: number;
  display_order: number;
  is_active: boolean;
}

export function useFormFields(formKey: string, opts: { activeOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ['cms', 'form_fields', formKey, opts.activeOnly ?? true],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<FormFieldDef[]> => {
      let q = cmsDb
        .from(CMS_TABLES.formFields)
        .select('id,form_key,field_key,label,field_type,options,help_text,is_required,step,display_order,is_active')
        .eq('form_key', formKey)
        .order('display_order', { ascending: true });
      if (opts.activeOnly !== false) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) return [];
      return ((data as any[]) || []).map((row) => ({
        ...row,
        options: Array.isArray(row.options) ? row.options : [],
      })) as FormFieldDef[];
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Section visibility & ordering                                      */
/* ------------------------------------------------------------------ */

export function useSectionControls(pageKey: string) {
  const { settings } = useWebsiteSettings();
  const hidden = settingValue<string[]>(settings, 'sections_hidden', []);
  const orders = settingValue<Record<string, string[]>>(settings, 'sections_order', {});
  const order = orders?.[pageKey] ?? [];

  return {
    isVisible: (sectionKey: string) => !(hidden || []).includes(`${pageKey}.${sectionKey}`),
    sortSections: <T extends { key: string }>(sections: T[]): T[] => {
      if (!order.length) return sections;
      const index = (k: string) => {
        const i = order.indexOf(k);
        return i === -1 ? 999 : i;
      };
      return [...sections].sort((a, b) => index(a.key) - index(b.key));
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Per-page SEO                                                       */
/* ------------------------------------------------------------------ */

export interface PageSeo {
  page_key: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
}

export function usePageSeo(pageKey: string) {
  return useQuery({
    queryKey: ['cms', 'page_seo', pageKey],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<PageSeo | null> => {
      const { data, error } = await cmsDb
        .from(CMS_TABLES.seo)
        .select('page_key,title,description,og_image')
        .eq('page_key', pageKey)
        .maybeSingle();
      if (error) return null;
      return (data as PageSeo) ?? null;
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Schema-driven page content                                         */
/* ------------------------------------------------------------------ */

/**
 * Reads any editable field declared in `src/config/siteSchema.ts`, falling back
 * to the built-in default so a page never renders blank.
 */
export function useSiteFields() {
  const { settings, isLoading } = useWebsiteSettings();

  const field = <T = any>(key: string, fallback?: T): T => {
    const saved = settings?.[key];
    if (saved != null && saved !== '') return saved as T;
    const def = SITE_DEFAULTS[key];
    return (def != null ? def : fallback) as T;
  };

  const list = <T = any>(key: string, fallback: T[] = []): T[] => {
    const value = field<T[]>(key, fallback);
    return Array.isArray(value) && value.length ? value : fallback;
  };

  return { field, list, settings, isLoading };
}
