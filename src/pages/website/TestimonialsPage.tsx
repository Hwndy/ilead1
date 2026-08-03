import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star, Quote, MessageSquareQuote } from 'lucide-react';
import { useTestimonials } from '@/hooks/useCms';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { SectionBand } from '@/components/website/Section';
import { Reveal } from '@/components/website/Reveal';
import { EmptyState } from '@/components/website/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

const ROLES = ['all', 'student', 'parent', 'alumni', 'staff'] as const;
type Role = typeof ROLES[number];

export const TestimonialsPage: React.FC = () => {
  const [role, setRole] = useState<Role>('all');
  const { data: items = [], isLoading } = useTestimonials();
  const filtered = role === 'all' ? items : items.filter((t) => t.role === role);

  return (
    <div className="space-y-0">
      <SEO
        title="Testimonials — iVintage College"
        description="Read what students, parents, alumni and staff say about their experience at iVintage College."
        path="/website/testimonials"
      />

      <PageHero
        eyebrow="Voices of iVintage"
        title="What Our Community Says"
        subtitle="Real stories from the students, families and educators who call iVintage home."
        crumbs={[{ label: 'Testimonials' }]}
      />

      <section className="border-b border-border bg-muted/40 py-6">
        <div className="container mx-auto flex flex-wrap justify-center gap-2 px-4">
          {ROLES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={role === r ? 'default' : 'outline'}
              onClick={() => setRole(r)}
              className="rounded-full px-5 capitalize"
            >
              {r}
            </Button>
          ))}
        </div>
      </section>

      <SectionBand>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-56 w-full rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={MessageSquareQuote}
              title="No testimonials here yet"
              description="We are collecting stories from our community. Check back soon, or read more about the school in the meantime."
              actionLabel="About the school"
              actionHref="/website/about"
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t, i) => (
                <Reveal key={t.id} delay={(i % 3) * 80}>
                <figure className="relative h-full rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <Quote className="absolute top-6 right-6 h-8 w-8 text-gold/30" />
                  {t.rating ? (
                    <div className="flex gap-0.5 mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < (t.rating || 0) ? 'fill-gold text-gold' : 'text-muted'}`} />
                      ))}
                    </div>
                  ) : null}
                  <blockquote className="text-foreground leading-relaxed mb-6">"{t.content}"</blockquote>
                  <figcaption className="flex items-center gap-3 pt-4 border-t border-border">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-primary-foreground font-semibold overflow-hidden">
                      {t.image_url ? (
                        <img src={t.image_url} alt={t.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{t.role}</p>
                    </div>
                  </figcaption>
                </figure>
                </Reveal>
              ))}
            </div>
          )}
      </SectionBand>
    </div>
  );
};

export default TestimonialsPage;