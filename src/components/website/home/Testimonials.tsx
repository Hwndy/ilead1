import React from 'react';
import { Star, Quote } from 'lucide-react';
import { useTestimonials } from '@/hooks/useCms';

export const Testimonials: React.FC = () => {
  const { data: items = [] } = useTestimonials({ limit: 6 });
  if (items.length === 0) return null;

  return (
    <section className="border-y border-border bg-muted/55 py-20">
      <div className="site-container">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-steel">Voices of iVintage</div>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            Trusted by families, championed by alumni
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.slice(0, 3).map((t) => (
            <figure
              key={t.id}
               className="relative border-l-4 border-l-gold bg-card p-8 shadow-sm transition-shadow hover:shadow-lg"
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
                 <div className="flex h-10 w-10 items-center justify-center overflow-hidden bg-primary font-semibold text-primary-foreground">
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