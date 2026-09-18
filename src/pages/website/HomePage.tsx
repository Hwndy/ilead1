import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { ArrowRight, Pause, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PrincipalWelcome } from '@/components/website/home/PrincipalWelcome';
// import { Accreditations } from '@/components/website/home/Accreditations';
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
        <link rel="canonical" href="https://ivintage.vercel.app/" />
        <meta property="og:title" content="iVintage College  Day School, Boarding & Tahfeedh, Ikorodu" />
        <meta
          property="og:description"
          content="Nursery, primary and secondary education with a strong tradition of academic excellence, character and faith."
        />
        <meta property="og:url" content="https://ivintage.vercel.app/" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "iVintage College",
          alternateName: "iVintage College",
          url: "https://ivintage.vercel.app/",
          logo: "https://ivintage.vercel.app/ivintage_logo.png",
          
          description:
            "iVintage College provides nursery, primary and secondary education in Nigeria with a focus on academic excellence, character and faith.",
          address: {
            "@type": "PostalAddress",
            addressCountry: "NG"
          },
          sameAs: ["https://ivintage.vercel.app/"]
        })}</script>
      </Helmet>

      <section className="overflow-hidden bg-muted/55">
        <div className="site-container grid min-h-[42rem] p-0 lg:grid-cols-[.9fr_1.1fr] lg:pr-0">
          <div className="relative z-10 flex flex-col justify-center px-5 py-14 md:px-12 lg:px-0 lg:py-20 lg:pr-16">
            <p className="site-kicker">{heroBadge}</p>
            <h1 className="mt-5 max-w-[14ch] text-4xl font-bold leading-[1.06] text-foreground sm:text-5xl lg:text-6xl">
              {heroTitle}
              <span className="mt-1 block text-steel">{heroTitleHighlight}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{heroSubtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" variant="secondary" className="px-7" asChild>
                <Link to="/website/admissions/apply">{heroCtaPrimary} <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button variant="outline" size="lg" className="px-7" asChild>
                <Link to="/website/about">{heroCtaSecondary}</Link>
              </Button>
            </div>
          </div>

          <div className="relative min-h-[24rem] overflow-hidden lg:min-h-[42rem]">
            {heroImages.map((imageSrc, index) => (
              <img
                key={imageSrc}
                src={imageSrc}
                alt={`Life at iVintage College ${index + 1}`}
                className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
            <div className="pointer-events-none absolute -left-36 -top-16 hidden h-[42rem] w-80 rounded-t-full bg-muted lg:block" />
            <div className="pointer-events-none absolute -left-28 -top-8 hidden h-[36rem] w-64 rounded-tl-full border-l-[12px] border-t-[12px] border-gold lg:block" />
            <div className="absolute bottom-6 left-5 right-5 border-l-4 border-gold bg-primary p-5 text-primary-foreground md:left-auto md:right-8 md:w-80">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold">The iVintage difference</p>
              <p className="mt-2 font-bold leading-snug">Academic excellence rooted in faith and character.</p>
            </div>
          </div>
        </div>

        {/* Slide controls */}
        {heroImages.length > 1 && (
          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-3 rounded-full border border-primary-foreground/15 bg-primary/60 px-3 py-2 backdrop-blur-sm lg:bottom-6 lg:right-6">
            <div className="flex space-x-2">
              {heroImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    index === currentSlide ? 'w-6 bg-gold' : 'w-2 bg-primary-foreground/50 hover:bg-primary-foreground'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={index === currentSlide}
                />
              ))}
            </div>
            <button
              onClick={() => setPaused((p) => !p)}
              className="text-primary-foreground/80 transition-colors hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
              aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </section>

      <nav aria-label="Explore iVintage" className="bg-primary text-primary-foreground">
        <div className="site-container grid grid-cols-2 p-0 lg:grid-cols-4">
          {['Day School', 'Boarding', 'Tahfeedh', 'ICT & Coding'].map((label) => (
            <Link key={label} to="/website/school-life" className="flex items-center justify-between border-b border-r border-primary-foreground/10 px-5 py-5 text-sm font-bold transition-colors hover:bg-steel">
              {label}<ArrowRight className="h-4 w-4 text-gold" />
            </Link>
          ))}
        </div>
      </nav>

      {/* Accreditations strip */}
      {/* <Accreditations /> */}

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
      <section className="border-y border-border bg-gold-soft/45 py-16">
        <div className="site-container text-center">
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