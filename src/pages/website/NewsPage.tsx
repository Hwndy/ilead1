import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, Clock, ArrowLeft, Search, Share2, Facebook, Twitter, MessageCircle, Link as LinkIcon, CalendarPlus, Newspaper } from 'lucide-react';
import { useNews, useNewsArticle, type NewsItem } from '@/hooks/useCms';
import { SEO, SITE_URL } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { Reveal } from '@/components/website/Reveal';
import { EmptyState } from '@/components/website/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = ['all', 'news', 'events', 'announcements'] as const;
type Cat = typeof CATEGORIES[number];

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

function buildIcs(item: NewsItem): string {
  const start = item.event_date ? new Date(item.event_date) : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => (s || '').replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//iVintage//Events//EN',
    'BEGIN:VEVENT',
    `UID:${item.id}@ivintage.vercel.app`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(item.title)}`,
    `DESCRIPTION:${esc(item.excerpt || '')}`,
    `URL:${SITE_URL}/website/news/${item.slug}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcs(item: NewsItem) {
  const blob = new Blob([buildIcs(item)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${item.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const NewsList: React.FC = () => {
  const [tab, setTab] = useState<'news' | 'events'>('news');
  const [cat, setCat] = useState<Cat>('all');
  const [q, setQ] = useState('');
  const newsFilter = tab === 'events' ? { category: 'events' } : (cat === 'all' ? {} : { category: cat });
  const { data: items = [], isLoading } = useNews(newsFilter);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.toLowerCase();
    return items.filter((i) =>
      i.title.toLowerCase().includes(needle) ||
      (i.excerpt || '').toLowerCase().includes(needle)
    );
  }, [items, q]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const u: NewsItem[] = []; const p: NewsItem[] = [];
    filtered.forEach((i) => {
      const d = i.event_date ? new Date(i.event_date).getTime() : 0;
      if (d && d >= now) u.push(i); else p.push(i);
    });
    u.sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime());
    return { upcoming: u, past: p };
  }, [filtered]);

  return (
    <div className="space-y-0">
      <SEO
        title="News & Events  iVintage College"
        description="Latest news, events, and announcements from iVintage College."
        path="/website/news"
      />

      <PageHero
        eyebrow="News & Events"
        title="Stay Updated"
        highlight="Latest News"
        subtitle="Keep up with the latest happenings, events, and announcements at iVintage College."
        crumbs={[{ label: 'News & Events' }]}
      />

      <section className="bg-muted/40 py-8">
        <div className="container mx-auto px-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <TabsList>
                <TabsTrigger value="news">All News</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles..." className="pl-9" />
              </div>
            </div>

            <TabsContent value="news" className="mt-6">
              <div className="mb-6 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Button key={c} size="sm" variant={cat === c ? 'default' : 'outline'} onClick={() => setCat(c)} className="rounded-full px-5 capitalize">
                    {c}
                  </Button>
                ))}
              </div>
              {isLoading ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-72 w-full rounded-xl" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Newspaper}
                  title="No articles found"
                  description="Nothing matches this filter yet. Try another category or clear your search."
                />
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((item, i) => (
                    <Reveal key={item.id} delay={(i % 3) * 80}>
                      <Link to={`/website/news/${item.slug}`} className="group block h-full">
                        <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
                          <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
                            {item.featured_image ? (
                              <img
                                src={item.featured_image}
                                alt={item.title}
                                loading="lazy"
                                width={800}
                                height={450}
                                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                              />
                            ) : (
                              <Calendar className="h-12 w-12 text-primary" />
                            )}
                            <Badge className="absolute left-4 top-4 capitalize shadow-sm">{item.category}</Badge>
                          </div>
                          <div className="flex flex-1 flex-col p-6">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(item.event_date || item.published_at)}
                            </span>
                            <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                              {item.title}
                            </h3>
                            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.excerpt}</p>
                            <div className="mt-auto flex items-center pt-5 text-xs text-muted-foreground">
                              <Clock className="mr-1.5 h-3.5 w-3.5" />
                              <span>{formatDate(item.created_at)}</span>
                            </div>
                          </div>
                        </article>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="events" className="mt-6 space-y-10">
              <div>
                <h2 className="text-xl font-semibold mb-4">Upcoming events</h2>
                {upcoming.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No upcoming events scheduled.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {upcoming.map((item) => <EventCard key={item.id} item={item} />)}
                  </div>
                )}
              </div>
              {past.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Past events</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-80">
                    {past.map((item) => <EventCard key={item.id} item={item} />)}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
};

const EventCard: React.FC<{ item: NewsItem }> = ({ item }) => {
  const date = item.event_date ? new Date(item.event_date) : null;
  return (
    <Card className="overflow-hidden border-0 shadow-md">
      <div className="flex">
        {date && (
          <div className="w-24 shrink-0 bg-primary text-primary-foreground flex flex-col items-center justify-center py-4">
            <span className="text-xs uppercase tracking-wide">{date.toLocaleString('en-NG', { month: 'short' })}</span>
            <span className="text-3xl font-bold">{date.getDate()}</span>
            <span className="text-xs">{date.getFullYear()}</span>
          </div>
        )}
        <div className="p-4 flex-1">
          <Link to={`/website/news/${item.slug}`} className="block">
            <h3 className="font-semibold text-foreground hover:text-primary line-clamp-2">{item.title}</h3>
          </Link>
          {item.excerpt && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.excerpt}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => downloadIcs(item)}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Add to calendar
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to={`/website/news/${item.slug}`}>Details</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

const NewsDetail: React.FC<{ slug: string }> = ({ slug }) => {
  const { data: article, isLoading } = useNewsArticle(slug);
  const { data: related = [] } = useNews({ limit: 3 });
  const { toast } = useToast();

  if (isLoading) return <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">Loading...</div>;
  if (!article) {
    return (
      <div className="container mx-auto px-4 py-24 text-center space-y-4">
        <SEO title="Article not found  iVintage" description="The requested article was not found." path={`/website/news/${slug}`} noindex />
        <h1 className="text-3xl font-bold">Article not found</h1>
        <Button asChild><Link to="/website/news"><ArrowLeft className="mr-2 h-4 w-4" />Back to news</Link></Button>
      </div>
    );
  }

  const url = `${SITE_URL}/website/news/${article.slug}`;
  const safeHtml = article.content ? DOMPurify.sanitize(article.content) : '';
  const shareTitle = encodeURIComponent(article.title);
  const shareUrl = encodeURIComponent(url);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <article className="space-y-0">
      <SEO
        title={`${article.title}  iVintage College`}
        description={article.excerpt || article.title}
        path={`/website/news/${article.slug}`}
        image={article.featured_image || undefined}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': article.category === 'events' ? 'Event' : 'Article',
          headline: article.title,
          description: article.excerpt || undefined,
          image: article.featured_image || undefined,
          datePublished: article.published_at || article.created_at,
          ...(article.event_date ? { startDate: article.event_date } : {}),
          url,
          publisher: {
            '@type': 'Organization',
            name: 'iVintage College',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/ivintage_logo.png` },
          },
        }}
      />
      <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/website/news"><ArrowLeft className="mr-2 h-4 w-4" />All news</Link>
          </Button>
          <Badge className="mb-4 capitalize">{article.category}</Badge>
          <h1 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">{article.title}</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> {formatDate(article.event_date || article.published_at)}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> Share:</span>
            <a href={`https://wa.me/?text=${shareTitle}%20${shareUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"
               className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
              <MessageCircle className="h-4 w-4" />
            </a>
            <a href={`https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X"
               className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
              <Twitter className="h-4 w-4" />
            </a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"
               className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
              <Facebook className="h-4 w-4" />
            </a>
            <button onClick={copyLink} aria-label="Copy link"
               className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
              <LinkIcon className="h-4 w-4" />
            </button>
            {article.category === 'events' && article.event_date && (
              <Button size="sm" variant="outline" className="ml-2" onClick={() => downloadIcs(article)}>
                <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Add to calendar
              </Button>
            )}
          </div>
        </div>
      </section>

      {article.featured_image && (
        <section className="container mx-auto px-4 -mt-6">
          <div className="max-w-4xl mx-auto aspect-video overflow-hidden rounded-2xl border border-border shadow-lg">
            <img src={article.featured_image} alt={article.title} className="h-full w-full object-cover" />
          </div>
        </section>
      )}

      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl prose prose-neutral dark:prose-invert">
          {article.excerpt && <p className="lead text-lg text-muted-foreground">{article.excerpt}</p>}
          {safeHtml && (
            <div className="mt-6 whitespace-pre-wrap text-foreground/90 leading-relaxed"
                 dangerouslySetInnerHTML={{ __html: safeHtml }} />
          )}
        </div>
      </section>

      {related.filter((r) => r.id !== article.id).length > 0 && (
        <section className="py-12 bg-card/30 border-t border-border">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">Related</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.filter((r) => r.id !== article.id).slice(0, 3).map((r) => (
                <Link key={r.id} to={`/website/news/${r.slug}`} className="block rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
                  <Badge variant="secondary" className="capitalize mb-2">{r.category}</Badge>
                  <p className="font-semibold text-foreground line-clamp-2">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-2">{formatDate(r.published_at)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
};

export const NewsPage = () => {
  const { slug } = useParams();
  return slug ? <NewsDetail slug={slug} /> : <NewsList />;
};
