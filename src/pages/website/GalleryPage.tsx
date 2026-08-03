import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X, Image as ImageIcon } from 'lucide-react';
import { useGallery } from '@/hooks/useCms';
import { SEO, SITE_URL } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { EmptyState } from '@/components/website/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIES = ['all', 'facilities', 'events', 'activities', 'general'] as const;
type Cat = typeof CATEGORIES[number];

export const GalleryPage: React.FC = () => {
  const [cat, setCat] = useState<Cat>('all');
  const { data: items = [], isLoading } = useGallery(cat === 'all' ? {} : { category: cat });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const jsonLd = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: 'iVintage College — Photo Gallery',
    url: `${SITE_URL}/website/gallery`,
    image: items.slice(0, 12).map((i) => i.image_url),
  }), [items]);

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(() => setOpenIndex((i) => (i === null ? null : (i + 1) % items.length)), [items.length]);
  const prev = useCallback(() => setOpenIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length)), [items.length]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIndex, next, prev, close]);

  const active = openIndex !== null ? items[openIndex] : null;

  return (
    <div className="space-y-0">
      <SEO
        title="Photo Gallery — iVintage College"
        description="Explore campus facilities, events, and student activities at iVintage College through our photo gallery."
        path="/website/gallery"
        jsonLd={jsonLd}
      />

      <PageHero
        eyebrow="Gallery"
        title="Moments from Campus"
        subtitle="A visual journey through the life, learning and celebrations at iVintage College."
        crumbs={[{ label: 'Gallery' }]}
      />

      <section className="py-8 border-b border-border">
        <div className="container mx-auto px-4 flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((c) => (
            <Button key={c} size="sm" variant={cat === c ? 'default' : 'outline'} onClick={() => setCat(c)} className="capitalize">
              {c}
            </Button>
          ))}
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No photos in this category yet"
              description="We publish new photos after each event and term. Try another category or explore our facilities."
              actionLabel="View facilities"
              actionHref="/website/facilities"
            />
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]">
              {items.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setOpenIndex(idx)}
                  className="mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border border-border bg-card group focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <img
                    src={item.image_url}
                    alt={item.alt_text || item.title || 'iVintage gallery photo'}
                    loading="lazy"
                    className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                  {(item.title || item.description) && (
                    <div className="p-3 text-left">
                      {item.title && <p className="font-semibold text-foreground text-sm line-clamp-1">{item.title}</p>}
                      {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={openIndex !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-5xl bg-black/95 border-none p-0 overflow-hidden">
          {active && (
            <div className="relative">
              <button onClick={close} aria-label="Close" className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                <X className="h-5 w-5" />
              </button>
              <button onClick={prev} aria-label="Previous" className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button onClick={next} aria-label="Next" className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                <ChevronRight className="h-6 w-6" />
              </button>
              <img
                src={active.image_url}
                alt={active.alt_text || active.title || 'iVintage gallery photo'}
                className="w-full max-h-[85vh] object-contain bg-black"
              />
              {(active.title || active.description) && (
                <div className="p-4 text-white bg-black/70">
                  {active.title && <p className="font-semibold">{active.title}</p>}
                  {active.description && <p className="text-sm text-white/80">{active.description}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GalleryPage;