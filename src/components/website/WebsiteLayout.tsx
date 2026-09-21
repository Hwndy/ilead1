import React, { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { Phone, Mail, MapPin, Clock, Facebook, Twitter, Instagram, Youtube, Menu, ChevronDown, ArrowRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useSchoolInfo, useSiteMenu, useSiteFields } from '@/hooks/useCms';

interface WebsiteLayoutProps {
  children: ReactNode;
}

const DEFAULT_PRIMARY_NAV = [
  { name: 'Home', href: '/website' },
  { name: 'About Us', href: '/website/about' },
  { name: 'Admissions', href: '/website/admissions' },
  { name: 'School Life', href: '/website/school-life' },
  { name: 'News & Events', href: '/website/news' },
  { name: 'Portals', href: '/website/portals' },
];

const DEFAULT_MORE_NAV = [
  { name: 'Gallery', href: '/website/gallery' },
  { name: 'Testimonials', href: '/website/testimonials' },
  { name: 'Facilities', href: '/website/facilities' },
  { name: 'Careers', href: '/website/careers' },
];

const DEFAULT_NAV = [...DEFAULT_PRIMARY_NAV, ...DEFAULT_MORE_NAV];

export const WebsiteLayout: React.FC<WebsiteLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { info } = useSchoolInfo();
  const { visible } = useSiteMenu();
  const { field } = useSiteFields();

  const toNav = (rows: { label: string; href: string }[], fallback: { name: string; href: string }[]) =>
    rows.length ? rows.map((r) => ({ name: r.label, href: r.href })) : fallback;

  const primaryNav = toNav(visible('primary'), DEFAULT_PRIMARY_NAV);
  const moreNav = toNav(visible('more'), DEFAULT_MORE_NAV);
  const navigation = [...primaryNav, ...moreNav];
  const footerNav = visible('footer').map((r) => ({ name: r.label, href: r.href }));
  const announcement = field<boolean>('global.announcement_enabled');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const socials: Array<[string, string, React.ComponentType<any>]> = [
    [info.facebook_url, 'Facebook', Facebook],
    [info.twitter_url, 'Twitter', Twitter],
    [info.instagram_url, 'Instagram', Instagram],
    [info.youtube_url, 'YouTube', Youtube],
  ];

  const isActivePath = (path: string) => {
    if (path === '/website' && location.pathname === '/website') return true;
    if (path !== '/website' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="site-theme min-h-screen bg-background text-foreground">
      {announcement ? (
        <Link
          to={field('global.announcement_link')}
          className="block bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
        >
          {field('global.announcement_text')}
        </Link>
      ) : null}
      {/* Header */}
      <header
        className={`sticky top-0 z-50 border-b transition-all duration-300 backdrop-blur-xl ${
          scrolled ? 'border-border bg-background/95 shadow-sm' : 'border-border/70 bg-background/95'
        }`}
      >
        {/* Top bar with contact info */}
        <div className="hidden bg-primary text-primary-foreground sm:block">
          <div className="site-container py-2">
            <div className="flex flex-wrap justify-between items-center gap-y-1 gap-x-4 text-xs">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-primary-foreground/75">
                {info.contact_phone && (
                  <a href={`tel:${info.contact_phone.replace(/\s+/g, '')}`} className="flex min-w-0 items-center gap-1 transition-colors hover:text-gold">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="truncate">{info.contact_phone}</span>
                  </a>
                )}
                {info.contact_email && (
                  <a href={`mailto:${info.contact_email}`} className="hidden min-w-0 items-center gap-1 transition-colors hover:text-gold sm:flex">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{info.contact_email}</span>
                  </a>
                )}
                {info.address && (
                  <div className="hidden lg:flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{info.address}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                {socials.filter(([url]) => !!url).map(([url, label, Icon]) => (
                    <a key={label} href={url} aria-label={label} target="_blank" rel="noopener noreferrer" className="text-primary-foreground/70 transition-colors hover:text-gold">
                    <Icon className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main navigation */}
        <div className="site-container">
            <div className="flex h-[4.5rem] items-center justify-between gap-3 sm:h-[5.25rem]">
            <Link to="/website" className="flex items-center gap-3 min-w-0 shrink-0">
              <Logo size="md" showText={false} />
              <div className="hidden min-w-0 sm:block">
                <span className="block text-[15px] font-bold text-foreground leading-tight whitespace-nowrap">{info.name || 'iVintage College'}</span>
                 <span className="block max-w-[16rem] truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground leading-tight lg:max-w-[20rem]">{info.motto || 'Knowledge. Character. Excellence.'}</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden xl:flex items-center gap-1">
              {primaryNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`relative px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                    isActivePath(item.href)
                      ? 'text-primary after:absolute after:inset-x-3 after:-bottom-[1.15rem] after:h-0.5 after:bg-gold'
                      : 'text-foreground/75 hover:text-primary'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger className={`flex items-center gap-1 px-3 py-2 text-sm font-bold transition-colors outline-none ${
                  moreNav.some(i => isActivePath(i.href)) ? 'text-primary' : 'text-foreground/75 hover:text-primary'
                }`}>
                  More <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="site-theme w-48 bg-popover">
                  {moreNav.map((item) => (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link to={item.href} className={isActivePath(item.href) ? 'text-primary' : ''}>{item.name}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <Button asChild size="sm" className="hidden px-5 sm:inline-flex">
                <Link to={field('global.header_cta_href')}>{field('global.header_cta_label')} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>

              {/* Mobile menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="site-theme w-[85vw] max-w-sm p-0 flex flex-col bg-background text-foreground">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                    <Logo size="sm" showText={false} />
                    <span className="text-sm font-bold text-foreground leading-tight">{info.name || 'iVintage College'}</span>
                  </div>
                  <nav className="flex-1 overflow-y-auto px-3 py-3">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`block rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                          isActivePath(item.href) ? 'bg-primary/10 text-primary' : 'text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </nav>
                  <div className="border-t border-border p-4 space-y-3">
                    <Button asChild className="w-full">
                      <Link to="/website/admissions/apply" onClick={() => setIsMobileMenuOpen(false)}>Apply Now</Link>
                    </Button>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {info.contact_phone && (
                        <a href={`tel:${info.contact_phone.replace(/\s+/g, '')}`} className="flex items-center gap-2"><Phone className="h-3 w-3" />{info.contact_phone}</a>
                      )}
                      {info.contact_email && (
                        <a href={`mailto:${info.contact_email}`} className="flex items-center gap-2"><Mail className="h-3 w-3" /><span className="truncate">{info.contact_email}</span></a>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-0 border-t border-primary bg-primary text-primary-foreground">
        {/* Pre-footer CTA */}
        <div className="border-b border-primary-foreground/10 bg-steel">
          <div className="site-container flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h3 className="text-lg font-bold text-primary-foreground">Admissions are open for the new session</h3>
              <p className="text-sm text-primary-foreground/70">Apply online in minutes and track your application at every stage.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="secondary" className="px-6">
                <Link to="/website/admissions/apply">Apply Now</Link>
              </Button>
              <Button variant="outline" asChild className="border-primary-foreground/30 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/website/track-application">Track Application</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="site-container py-14 [&_h3]:text-primary-foreground [&_p]:text-primary-foreground/65 [&_li_a]:text-primary-foreground/65 [&_li_a:hover]:text-gold">
          <div className="grid min-w-0 grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {/* School Info */}
            <div className="min-w-0 sm:col-span-2">
              <div className="flex items-center space-x-4 mb-4">
                <Logo size="md" />
                <div>
                  <h3 className="text-lg font-bold text-foreground">{info.name}</h3>
                  <p className="text-sm text-muted-foreground">{info.motto}</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-4">{field('global.footer_tagline')}</p>
              <div className="flex space-x-4">
                {socials.filter(([url]) => !!url).map(([url, label, Icon]) => (
                   <a key={label} href={url} aria-label={label} target="_blank" rel="noopener noreferrer" className="text-primary-foreground/65 transition-colors hover:text-gold">
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Quick Links</h3>
              <ul className="space-y-2">
                {footerNav.map((item) => (
                  <li key={item.href + item.name}>
                    <Link to={item.href} className="text-muted-foreground hover:text-primary transition-colors">{item.name}</Link>
                  </li>
                ))}
                {footerNav.length ? null : (<>
                <li><Link to="/website/about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
                <li><Link to="/website/admissions" className="text-muted-foreground hover:text-primary transition-colors">Admissions</Link></li>
                <li><Link to="/website/school-life" className="text-muted-foreground hover:text-primary transition-colors">Academics</Link></li>
                <li><Link to="/website/news" className="text-muted-foreground hover:text-primary transition-colors">News & Events</Link></li>
                <li><Link to="/website/gallery" className="text-muted-foreground hover:text-primary transition-colors">Gallery</Link></li>
                <li><Link to="/website/testimonials" className="text-muted-foreground hover:text-primary transition-colors">Testimonials</Link></li>
                <li><Link to="/website/portals" className="text-muted-foreground hover:text-primary transition-colors">Portals</Link></li>
                </>)}
              </ul>
            </div>

            {/* For families */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">For Families</h3>
              <ul className="space-y-2">
                <li><Link to="/website/admissions/apply" className="text-muted-foreground hover:text-primary transition-colors">Apply Online</Link></li>
                <li><Link to="/website/track-application" className="text-muted-foreground hover:text-primary transition-colors">Track Application</Link></li>
                <li><Link to="/website/portals" className="text-muted-foreground hover:text-primary transition-colors">Parent Portal</Link></li>
                <li><Link to="/website/portals" className="text-muted-foreground hover:text-primary transition-colors">Student Portal</Link></li>
                <li><Link to="/website/facilities" className="text-muted-foreground hover:text-primary transition-colors">Facilities</Link></li>
                <li><Link to="/website/careers" className="text-muted-foreground hover:text-primary transition-colors">Careers</Link></li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Contact Info</h3>
              <div className="space-y-3 text-muted-foreground">
                {info.address && (
                  <div className="flex items-start space-x-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <span>{info.address}</span>
                  </div>
                )}
                {info.contact_phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gold" />
                    <span>{info.contact_phone}</span>
                  </div>
                )}
                {info.contact_email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gold" />
                    <span className="break-all">{info.contact_email}</span>
                  </div>
                )}
                <div className="flex items-start space-x-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <span>{field('office_hours')}</span>
                </div>
              </div>
            </div>
          </div>

           <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-primary-foreground/10 pt-8 text-center text-sm text-primary-foreground/55 sm:flex-row sm:text-left">
            <p>&copy; {new Date().getFullYear()} {info.name}. All rights reserved.</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <Link to="/website/about" className="transition-colors hover:text-gold">About</Link>
              <Link to="/website/careers" className="transition-colors hover:text-gold">Careers</Link>
              <Link to="/website/news" className="transition-colors hover:text-gold">News</Link>
              {info.contact_email && (
                <a href={`mailto:${info.contact_email}`} className="transition-colors hover:text-gold">Contact</a>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};