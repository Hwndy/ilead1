import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronRight } from 'lucide-react';
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
    <section className={`relative overflow-hidden border-b border-border ${onImage ? 'min-h-[28rem]' : 'bg-muted/55 py-16 sm:py-24'}`}>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>

      {onImage && (
        <div className="absolute inset-0 z-0">
          <img src={image} alt="" aria-hidden="true" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/75 to-primary/20" />
          <div className="absolute inset-y-0 left-0 w-1 bg-gold" />
        </div>
      )}

      <div className={`site-container relative z-10 ${onImage ? 'flex min-h-[28rem] flex-col justify-center py-16' : ''}`}>
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-8 flex">
          <ol className={`flex flex-wrap items-center gap-1 text-xs sm:text-sm ${onImage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {trail.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                {c.href && i < trail.length - 1 ? (
                  <Link to={c.href} className="transition-colors hover:text-primary">
                    {c.label}
                  </Link>
                ) : (
                  <span className={onImage ? 'text-primary-foreground' : 'text-foreground'} aria-current="page">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="max-w-3xl text-left">
          {eyebrow && (
            <p className={`site-kicker mb-5 ${onImage ? '[&]:text-gold' : ''}`}>{eyebrow}</p>
          )}
          <h1
            className={`text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl ${
              onImage ? 'text-primary-foreground' : 'text-foreground'
            }`}
          >
            {title}
            {highlight && <span className={`mt-1 block ${onImage ? 'text-gold' : 'text-steel'}`}>{highlight}</span>}
          </h1>
          {subtitle && (
            <p className={`mt-6 max-w-2xl text-base leading-relaxed sm:text-lg ${onImage ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {subtitle}
            </p>
          )}
          {children && <div className="mt-8 flex flex-col gap-3 sm:flex-row">{children}</div>}
        </div>
      </div>
    </section>
  );
};

export default PageHero;