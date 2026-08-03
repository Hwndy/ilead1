import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/website/SEO';
import { Compass } from 'lucide-react';

const SUGGESTIONS = [
  { label: 'Admissions', href: '/website/admissions' },
  { label: 'About Us', href: '/website/about' },
  { label: 'School Life', href: '/website/school-life' },
  { label: 'News & Events', href: '/website/news' },
  { label: 'Portals', href: '/website/portals' },
];

export const NotFoundPage: React.FC = () => {
  const location = useLocation();
  return (
    <div className="container mx-auto px-4 py-24">
      <SEO
        title="Page Not Found — iVintage College"
        description="The page you were looking for could not be found on the iVintage College website."
        path={location.pathname}
        noindex
      />
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Compass className="h-8 w-8 text-primary" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Error 404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">We couldn't find that page</h1>
        <p className="mt-4 text-muted-foreground">
          The link may be out of date or mistyped. Try one of the sections below, or head back to the homepage.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild className="rounded-full px-6">
            <Link to="/website">Back to homepage</Link>
          </Button>
          <Button variant="outline" asChild className="rounded-full px-6">
            <Link to="/website/admissions/apply">Apply now</Link>
          </Button>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <Link
              key={s.href}
              to={s.href}
              className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;