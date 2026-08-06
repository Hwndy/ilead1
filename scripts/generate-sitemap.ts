// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.VITE_FRONTEND_URL || 'https://ilead1.lovable.app';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://trtuqzdsutmindcjbkvj.supabase.co';
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_6WHJnH9aYbEnuk8pLCUz3Q_EowZpmTS';


interface Entry { path: string; lastmod?: string; changefreq?: string; priority?: string; }

const staticEntries: Entry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/website', changefreq: 'weekly', priority: '1.0' },
  { path: '/website/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/website/school-life', changefreq: 'monthly', priority: '0.7' },
  { path: '/website/admissions', changefreq: 'weekly', priority: '0.9' },
  { path: '/website/admissions/apply', changefreq: 'monthly', priority: '0.8' },
  { path: '/website/track-application', changefreq: 'yearly', priority: '0.4' },
  { path: '/website/facilities', changefreq: 'monthly', priority: '0.7' },
  { path: '/website/news', changefreq: 'weekly', priority: '0.8' },
  { path: '/website/gallery', changefreq: 'weekly', priority: '0.6' },
  { path: '/website/testimonials', changefreq: 'monthly', priority: '0.5' },
  { path: '/website/portals', changefreq: 'yearly', priority: '0.4' },
];

async function fetchNews(): Promise<Entry[]> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data, error } = await supabase
      .from('news_articles')
      .select('slug, published_at, updated_at')
      .eq('is_published', true);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      path: `/website/news/${row.slug}`,
      lastmod: (row.updated_at || row.published_at || '').slice(0, 10) || undefined,
      changefreq: 'monthly',
      priority: '0.6',
    }));
  } catch (e) {
    console.warn('sitemap: failed to fetch news_articles, continuing with static entries only.', e);
    return [];
  }
}

function render(entries: Entry[]) {
  const urls = entries.map((e) => [
    '  <url>',
    `    <loc>${BASE_URL}${e.path}</loc>`,
    e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n');
}

(async () => {
  const news = await fetchNews();
  const all = [...staticEntries, ...news];
  writeFileSync(resolve('public/sitemap.xml'), render(all));
  console.log(`sitemap.xml written (${all.length} entries)`);
})();