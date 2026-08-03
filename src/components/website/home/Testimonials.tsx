import React from 'react';
import { Star, Quote } from 'lucide-react';
import { useTestimonials } from '@/hooks/useCms';

export const Testimonials: React.FC = () => {
  const { data: items = [] } = useTestimonials({ limit: 6 });
  if (items.length === 0) return null;

  return (
    <section className="py-20 bg-gradient-to-br from-primary/5 via-background to-gold/5">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            <span className="h-px w-8 bg-gold" />
            Voices of iVintage
            <span className="h-px w-8 bg-gold" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            Trusted by families, championed by alumni
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.slice(0, 3).map((t) => (
            <figure
              key={t.id}
              className="relative rounded-2xl bg-card border border-border p-8 shadow-sm hover:shadow-lg transition-shadow"
            >
              <Quote className="absolute top-6 right-6 h-8 w-8 text-gold/30" />
              {t.rating ? (
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < (t.rating || 0) ? 'fill-gold text-gold' : 'text-muted'}`}
                    />
                  ))}
                </div>
              ) : null}
              <blockquote className="text-foreground leading-relaxed mb-6">
                "{t.content}"
              </blockquote>
              <figcaption className="flex items-center gap-3 pt-4 border-t border-border">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-primary-foreground font-semibold overflow-hidden">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    t.name.charAt(0)
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};