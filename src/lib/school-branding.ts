import { supabase } from '@/integrations/supabase/client';

export interface SchoolBranding {
  name: string;
  address: string;
  phone: string;
  email: string;
  motto: string;
  logo_url: string;
  principal_name: string;
}

export const DEFAULT_SCHOOL_BRANDING: SchoolBranding = {
  name: 'iVintage College',
  address: 'Lagos, Nigeria',
  phone: '',
  email: '',
  motto: '',
  logo_url: '/ivintage_logo.png',
  principal_name: '',
};

let cache: { value: SchoolBranding; ts: number } | null = null;
const TTL = 5 * 60 * 1000;

/**
 * school_info is a key/value table (info_key / info_value).
 * This resolves the branding fields used on printed documents (report cards,
 * ID cards, receipts) with sensible fallbacks and legacy-key aliasing.
 */
export async function fetchSchoolBranding(force = false): Promise<SchoolBranding> {
  if (!force && cache && Date.now() - cache.ts < TTL) return cache.value;

  const { data } = await supabase
    .from('school_info')
    .select('info_key, info_value, is_active');

  const map = new Map<string, string>();
  (data || []).forEach((r: any) => {
    if (r?.is_active === false) return;
    const v = (r?.info_value ?? '').toString().trim();
    if (v) map.set(r.info_key, v);
  });

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = map.get(k);
      if (v) return v;
    }
    return '';
  };

  const value: SchoolBranding = {
    name: pick('name', 'school_name') || DEFAULT_SCHOOL_BRANDING.name,
    address: pick('address', 'school_address') || DEFAULT_SCHOOL_BRANDING.address,
    phone: pick('contact_phone', 'phone_primary', 'phone'),
    email: pick('contact_email', 'email_primary', 'email'),
    motto: pick('motto', 'school_motto'),
    logo_url: pick('logo_url') || DEFAULT_SCHOOL_BRANDING.logo_url,
    principal_name: pick('principal_name'),
  };

  cache = { value, ts: Date.now() };
  return value;
}

export function clearSchoolBrandingCache() {
  cache = null;
}