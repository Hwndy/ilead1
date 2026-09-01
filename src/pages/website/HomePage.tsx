import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Pause, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PrincipalWelcome } from '@/components/website/home/PrincipalWelcome';
import { Accreditations } from '@/components/website/home/Accreditations';
import { LatestNews } from '@/components/website/home/LatestNews';
import { Testimonials } from '@/components/website/home/Testimonials';
import { HowToApply } from '@/components/website/home/HowToApply';
import { Newsletter } from '@/components/website/home/Newsletter';
import { WhatsAppFloat } from '@/components/website/home/WhatsAppFloat';
import { GalleryHighlights } from '@/components/website/home/GalleryHighlights';
import { Programmes } from '@/components/website/home/Programmes';
import { AdmissionsGlance } from '@/components/website/home/AdmissionsGlance';
import { Achievements } from '@/components/website/home/Achievements';
import { VisitUs } from '@/components/website/home/VisitUs';
import { WhyChooseUs } from '@/components/website/home/WhyChooseUs';
import { usePrefersReducedMotion } from '@/components/website/Reveal';
import { useWebsiteSettings, useSchoolInfo, settingValue } from '@/hooks/useCms';

// Fallback hero image slideshow when nothing is configured in the CMS.
const DEFAULT_HERO_IMAGES = [
  '/campus.png',      // Your cleaned up campus image
  '/img1.png',       // Placeholder: Add your second image here
  '/img2.png',
  '/img3.png',        // Placeholder: Add your third image here
];

export const HomePage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const { settings } = useWebsiteSettings();
  const { info } = useSchoolInfo();
  const reducedMotion = usePrefersReducedMotion();

  const heroImages = useMemo(() => {
    const raw = settingValue<string[]>(settings, 'hero_images', DEFAULT_HERO_IMAGES);
    return Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_HERO_IMAGES;
  }, [settings]);

  const heroBadge = settingValue<string>(settings, 'hero_badge', 'Day School | Boarding | Tahfeedh');
  const heroTitle = settingValue<string>(settings, 'hero_title', '\u2026redefining western and');
  const heroTitleHighlight = settingValue<string>(settings, 'hero_title_highlight', 'Islamic intellectualism');
  const heroSubtitle = settingValue<string>(settings, 'hero_subtitle',
    'We deliver a perfect blend of western and Islamic education as well as proficiency in ICT, with coding being a major component.');

  const heroCtaPrimary = settingValue<string>(settings, 'hero_cta_primary_label', 'Apply Now');
  const heroCtaSecondary = settingValue<string>(settings, 'hero_cta_secondary_label', 'Learn More');

  // Advance the background automatically unless paused or motion is reduced.
  useEffect(() => {
    if (paused || reducedMotion || heroImages.length < 2) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroImages.length, paused, reducedMotion]);

  return (
    <div className="space-y-0">
      <Helmet>
        <title>iVintage College  Day School, Boarding & Tahfeedh, Ikorodu</title>
        <meta
          name="description"
          content="iVintage College offers nursery, primary and secondary education in Nigeria, nurturing future leaders through academic excellence and character building."
        />
        <link rel="canonical" href="https://ilead1.lovable.app/" />
        <meta property="og:title" content="iVintage College  Day School, Boarding & Tahfeedh, Ikorodu" />
        <meta
          property="og:description"
          content="Nursery, primary and secondary education with a strong tradition of academic excellence, character and faith."
        />
        <meta property="og:url" content="https://ilead1.lovable.app/" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "iVintage College",
          alternateName: "iVintage College",
          url: "https://ilead1.lovable.app/",
          logo: "https://ilead1.lovable.app/ivintage_logo.png",
          
          description:
            "iVintage College provides nursery, primary and secondary education in Nigeria with a focus on academic excellence, character and faith.",
          address: {
            "@type": "PostalAddress",
            addressCountry: "NG"
          },
          sameAs: ["https://ilead1.lovable.app/"]
        })}</script>
      </Helmet>

      {/* Hero Section with Slideshow Background */}
      <section className="relative min-h-[600px] lg:min-h-[680px] flex items-center py-20 lg:py-28 overflow-hidden">
        
        {/* Background Slideshow Layer */}
        <div className="absolute inset-0 z-0">
          {heroImages.map((imageSrc, index) => (
            <img
              key={imageSrc}
              src={imageSrc}
              alt={`iVintage College Slideshow Background ${index + 1}`}
              className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out ${
                index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
          
          {/* Directional scrim: dark on the left for text contrast, lighter on the right */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
        </div>

        {/* Content Layer */}
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <Badge className="w-fit bg-primary text-primary-foreground border-none px-3 py-1 text-sm shadow-md">
              {heroBadge}
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight max-w-[15ch]">
              {heroTitle}
              <span className="block mt-1 text-accent drop-shadow-sm">{heroTitleHighlight}</span>
            </h1>
            
            <p className="text-base sm:text-lg text-slate-200/90 max-w-xl leading-relaxed">
              {heroSubtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button size="lg" className="rounded-full px-7 shadow-lg text-base" asChild>
                <Link to="/website/admissions/apply">
                  {heroCtaPrimary} <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-full px-7 bg-white/10 hover:bg-white/20 hover:text-white text-white border-white/30 backdrop-blur-sm text-base"
                asChild
              >
                <Link to="/website/about">{heroCtaSecondary}</Link>
              </Button>
            </div>
          </div>

            {/* Highlight card balances the composition on desktop */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-6 sm:p-7 shadow-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  Admissions open
                </div>
                <p className="mt-3 text-white/90 text-sm leading-relaxed">
                  Applications for the new session are now being accepted across Nursery, Primary and Secondary.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {[
                    { value: info.stat_students, label: 'Students' },
                    { value: info.stat_teachers, label: 'Teachers' },
                    { value: info.stat_success_rate, label: 'Success rate' },
                    { value: info.stat_years, label: 'Years of excellence' },
                  ].filter((s) => !!s.value).map((s) => (

                    <div key={s.label} className="rounded-xl bg-white/10 border border-white/10 px-4 py-3">
                      <div className="text-2xl font-bold text-white leading-none">{s.value}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-white/70">{s.label}</div>
                    </div>
                  ))}
                </div>
                <Button variant="secondary" className="mt-6 w-full rounded-full" asChild>
                  <Link to="/website/track-application">Track your application</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Slide controls */}
        {heroImages.length > 1 && (
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
            <div className="flex space-x-2">
              {heroImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    index === currentSlide ? 'w-6 bg-primary' : 'w-2 bg-white/50 hover:bg-white'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={index === currentSlide}
                />
              ))}
            </div>
            <button
              onClick={() => setPaused((p) => !p)}
              className="text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </section>

      {/* Accreditations strip */}
      <Accreditations />

      {/* Academic programmes */}
      <Programmes />

      {/* Admissions key dates */}
      <AdmissionsGlance />

      {/* Principal's Welcome */}
      <PrincipalWelcome />

      {/* Why families choose us  photo led */}
      <WhyChooseUs />

      {/* Results and achievements */}
      <Achievements />

      {/* Latest News from CMS */}
      <LatestNews />

      {/* Gallery Highlights */}
      <GalleryHighlights />

      {/* Testimonials */}
      <Testimonials />

      {/* How to Apply */}
      <HowToApply />

      {/* Visit us / location */}
      <VisitUs />

      {/* Newsletter */}
      <Newsletter />

      {/* Call to Action */}
      <section className="py-16 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Ready to Join iVintage College?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Take the first step towards an exceptional education. Apply now and become part of our 
            growing community of future leaders.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/website/admissions">
                Start Your Application <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/website/portals">Access Portals</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Floating WhatsApp */}
      <WhatsAppFloat />
    </div>
  );
};