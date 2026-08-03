import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNews } from '@/hooks/useCms';

export const LatestNews: React.FC = () => {
  const { data: items = [], isLoading: loading } = useNews({ limit: 3 });
  if (!loading && items.length === 0) return null;

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              <span className="h-px w-8 bg-gold" />
              Latest from Campus
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">News & Events</h2>
            <p className="text-muted-foreground max-w-xl">
              Announcements, achievements and moments from the iVintage community.
            </p>
          </div>
          <Button variant="outline" asChild className="self-start md:self-auto border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
            <Link to="/website/news">View all news <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(loading ? (Array.from({ length: 3 }) as any[]) : items).map((item: any, i: number) => (
            <Link
              to={item?.slug ? `/website/news/${item.slug}` : '/website/news'}
              key={item?.id || i}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card hover:shadow-xl transition-all duration-300"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary/10 to-gold/10">
                {item?.featured_image ? (
                  <img
                    src={item.featured_image}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-primary/20 font-serif text-6xl">
                    AB
                  </div>
                )}
                {item?.category && (
                  <span className="absolute top-4 left-4 bg-gold text-gold-foreground text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                    {item.category}
                  </span>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center text-xs text-muted-foreground mb-3">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  {item?.event_date || item?.published_at
                    ? new Date(item.event_date || item.published_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '\u00a0'}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {item?.title || <span className="block h-5 bg-muted rounded animate-pulse" />}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {item?.excerpt || (loading ? '' : '')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};