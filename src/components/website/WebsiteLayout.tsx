import React, { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { Phone, Mail, MapPin, Clock, Facebook, Twitter, Instagram, Youtube, Menu, X, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useSchoolInfo } from '@/hooks/useCms';

interface WebsiteLayoutProps {
  children: ReactNode;
}

const primaryNav = [
  { name: 'Home', href: '/website' },
  { name: 'About Us', href: '/website/about' },
  { name: 'Admissions', href: '/website/admissions' },
  { name: 'School Life', href: '/website/school-life' },
  { name: 'News & Events', href: '/website/news' },
  { name: 'Portals', href: '/website/portals' },
];

const moreNav = [
  { name: 'Gallery', href: '/website/gallery' },
  { name: 'Testimonials', href: '/website/testimonials' },
  { name: 'Facilities', href: '/website/facilities' },
  { name: 'Careers', href: '/website/careers' },
];

const navigation = [...primaryNav, ...moreNav];

export const WebsiteLayout: React.FC<WebsiteLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { info } = useSchoolInfo();

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 backdrop-blur-xl ${
          scrolled ? 'bg-background/90 border-b border-border shadow-sm' : 'bg-background/70 border-b border-transparent'
        }`}
      >
        {/* Top bar with contact info */}
        <div className="hidden md:block border-b border-border/40 bg-primary/[0.04]">
          <div className="container mx-auto px-4 py-1.5">
            <div className="flex flex-wrap justify-between items-center gap-y-1 gap-x-4 text-xs">
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-muted-foreground min-w-0">
                {info.contact_phone && (
                  <a href={`tel:${info.contact_phone.replace(/\s+/g, '')}`} className="flex items-center gap-1 min-w-0 hover:text-primary transition-colors">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="truncate">{info.contact_phone}</span>
                  </a>
                )}
                {info.contact_email && (
                  <a href={`mailto:${info.contact_email}`} className="hidden sm:flex items-center gap-1 min-w-0 hover:text-primary transition-colors">
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
                  <a key={label} href={url} aria-label={label} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <Icon className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main navigation */}
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-3">
            <Link to="/website" className="flex items-center gap-3 min-w-0 shrink-0">
              <Logo size="md" showText={false} />
              <div className="min-w-0 hidden sm:block">
                <span className="block text-[15px] font-bold text-foreground leading-tight whitespace-nowrap">{info.name || 'iVintage College'}</span>
                <span className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground leading-tight truncate">{info.motto || 'Excellence in Education'}</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {primaryNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActivePath(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/75 hover:text-primary hover:bg-muted'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors outline-none ${
                  moreNav.some(i => isActivePath(i.href)) ? 'bg-primary/10 text-primary' : 'text-foreground/75 hover:text-primary hover:bg-muted'
                }`}>
                  More <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover">
                  {moreNav.map((item) => (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link to={item.href} className={isActivePath(item.href) ? 'text-primary' : ''}>{item.name}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <Button asChild size="sm" className="hidden sm:inline-flex rounded-full px-5">
                <Link to="/website/admissions/apply">Apply Now</Link>
              </Button>

              {/* Mobile menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] max-w-sm p-0 flex flex-col">
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
                    <Button asChild className="w-full rounded-full">
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
      <footer className="bg-card border-t border-border mt-16">
        {/* Pre-footer CTA */}
        <div className="border-b border-border bg-primary/[0.05]">
          <div className="container mx-auto flex flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h3 className="text-lg font-bold text-foreground">Admissions are open for the new session</h3>
              <p className="text-sm text-muted-foreground">Apply online in minutes and track your application at every stage.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="rounded-full px-6">
                <Link to="/website/admissions/apply">Apply Now</Link>
              </Button>
              <Button variant="outline" asChild className="rounded-full px-6">
                <Link to="/website/track-application">Track Application</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-5">
            {/* School Info */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-4 mb-4">
                <Logo size="md" />
                <div>
                  <h3 className="text-lg font-bold text-foreground">{info.name}</h3>
                  <p className="text-sm text-muted-foreground">{info.motto}</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-4">
                {info.name} is committed to providing quality education that nurtures the intellectual,
                moral, and social development of our students, preparing them for success in an ever-changing world.
              </p>
              <div className="flex space-x-4">
                {socials.filter(([url]) => !!url).map(([url, label, Icon]) => (
                  <a key={label} href={url} aria-label={label} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><Link to="/website/about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
                <li><Link to="/website/admissions" className="text-muted-foreground hover:text-primary transition-colors">Admissions</Link></li>
                <li><Link to="/website/school-life" className="text-muted-foreground hover:text-primary transition-colors">Academics</Link></li>
                <li><Link to="/website/news" className="text-muted-foreground hover:text-primary transition-colors">News & Events</Link></li>
                <li><Link to="/website/gallery" className="text-muted-foreground hover:text-primary transition-colors">Gallery</Link></li>
                <li><Link to="/website/testimonials" className="text-muted-foreground hover:text-primary transition-colors">Testimonials</Link></li>
                <li><Link to="/website/portals" className="text-muted-foreground hover:text-primary transition-colors">Portals</Link></li>
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
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{info.address}</span>
                  </div>
                )}
                {info.address_alt && (
                  <div className="flex items-start space-x-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{info.address_alt}</span>
                  </div>
                )}
                {info.contact_phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>{[info.contact_phone, info.contact_phone_alt].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {info.contact_email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="break-all">{info.contact_email}</span>
                  </div>
                )}
                {info.contact_email_alt && (
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="break-all">{info.contact_email_alt}</span>
                  </div>
                )}

                <div className="flex items-start space-x-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Mon – Fri, 8:00am – 4:00pm</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-8 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
            <p>&copy; {new Date().getFullYear()} {info.name}. All rights reserved.</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <Link to="/website/about" className="hover:text-primary transition-colors">About</Link>
              <Link to="/website/careers" className="hover:text-primary transition-colors">Careers</Link>
              <Link to="/website/news" className="hover:text-primary transition-colors">News</Link>
              {info.contact_email && (
                <a href={`mailto:${info.contact_email}`} className="hover:text-primary transition-colors">Contact</a>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};