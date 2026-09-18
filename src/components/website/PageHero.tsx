import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SITE_URL } from '@/components/website/SEO';

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeroProps {
  eyebrow?: string;
  title: React.ReactNode;
  highlight?: string;
  subtitle?: string;
  image?: string;
  crumbs?: Crumb[];
  children?: React.ReactNode;
}

/**
 * Single page-header shell used by every inner website page so the site reads
 * as one design system instead of a set of separately styled pages.
 */
export const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  title,
  highlight,
  subtitle,
  image,
  crumbs = [],
  children,
}) => {
  const trail: Crumb[] = [{ label: 'Home', href: '/website' }, ...crumbs];
  const onImage = Boolean(image);

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${SITE_URL}${c.href}` } : {}),
    })),
  };

  return (
    <section
      className={`relative overflow-hidden ${
        onImage ? 'py-20 sm:py-24' : 'bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 sm:py-20'
      }`}
    >
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>

      {onImage && (
        <div className="absolute inset-0 z-0">
          <img src={image} alt="" aria-hidden="true" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
        </div>
      )}

      <div className="container relative z-10 mx-auto px-4">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6 flex justify-center">
          <ol className={`flex flex-wrap items-center justify-center gap-1 text-xs sm:text-sm ${onImage ? 'text-white/70' : 'text-muted-foreground'}`}>
            {trail.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                {c.href && i < trail.length - 1 ? (
                  <Link to={c.href} className="transition-colors hover:text-primary">
                    {c.label}
                  </Link>
                ) : (
                  <span className={onImage ? 'text-white' : 'text-foreground'} aria-current="page">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="mx-auto max-w-3xl text-center">
          {eyebrow && (
            <Badge className="mb-5 border-none bg-primary px-3 py-1 text-primary-foreground shadow-sm">{eyebrow}</Badge>
          )}
          <h1
            className={`text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl ${
              onImage ? 'text-white' : 'text-foreground'
            }`}
          >
            {title}
            {highlight && <span className="mt-1 block text-primary">{highlight}</span>}
          </h1>
          {subtitle && (
            <p className={`mt-5 text-base leading-relaxed sm:text-lg ${onImage ? 'text-slate-200' : 'text-muted-foreground'}`}>
              {subtitle}
            </p>
          )}
          {children && <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">{children}</div>}
        </div>
      </div>
    </section>
  );
};

export default PageHero;