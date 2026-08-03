import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Camera } from 'lucide-react';
import { useGallery } from '@/hooks/useCms';

export const GalleryHighlights: React.FC = () => {
  const { data: items = [] } = useGallery({ featured: true, limit: 6 });
  if (items.length === 0) return null;

  return (
    <section className="py-20 bg-card/30">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              <span className="h-px w-8 bg-gold" /> Campus Snapshots
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground flex items-center gap-3">
              <Camera className="h-8 w-8 text-primary" /> From the Gallery
            </h2>
            <p className="text-muted-foreground max-w-xl">Featured moments captured across our classrooms, events, and activities.</p>
          </div>
          <Button variant="outline" asChild className="self-start md:self-auto border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
            <Link to="/website/gallery">Browse gallery <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {items.map((it, i) => (
            <Link
              key={it.id}
              to="/website/gallery"
              className={`relative block overflow-hidden rounded-xl border border-border bg-muted group ${i === 0 ? 'row-span-2 col-span-2 md:col-span-1 md:row-span-2 aspect-square md:aspect-auto' : 'aspect-square'}`}
            >
              <img
                src={it.image_url}
                alt={it.alt_text || it.title || 'iVintage gallery photo'}
                loading="lazy"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {it.title && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3">
                  <p className="text-white text-xs font-semibold line-clamp-1">{it.title}</p>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};