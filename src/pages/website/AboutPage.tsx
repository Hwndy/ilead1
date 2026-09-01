import React from 'react';
import { Button } from '@/components/ui/button';
import { Award, Users, Target, Eye, ShieldCheck, GraduationCap, Landmark, BookOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { SectionBand, SectionHeading } from '@/components/website/Section';
import { Reveal } from '@/components/website/Reveal';

const ICONS: Record<string, React.ComponentType<any>> = {
  Award,
  Users,
  Target,
  Eye,
  BookOpen,
  ShieldCheck,
  GraduationCap,
  Landmark,
};

interface Leader { name: string; role: string; bio?: string; image?: string }
interface Value { title: string; description: string; icon?: string }

const DEFAULT_VALUES: Value[] = [
  { title: 'Excellence', description: 'We strive for the highest standards in all aspects of education, encouraging students to achieve their full potential.', icon: 'Award' },
  { title: 'Integrity', description: 'We uphold honesty, transparency, and ethical conduct in all our interactions and decision-making processes.', icon: 'ShieldCheck' },
  { title: 'Community', description: 'We foster a supportive and inclusive environment where every member feels valued and respected.', icon: 'Users' },
];

const DEFAULT_LEADERS: Leader[] = [];

export const AboutPage = () => {
  const { settings } = useWebsiteSettings();
  const heroImage = settingValue<string>(settings, 'about_hero_image', '/campus.png');
  const heroTitle = settingValue<string>(settings, 'about_hero_title', 'Excellence in Education');
  const heroHighlight = settingValue<string>(settings, 'about_hero_highlight', 'Ikorodu, Lagos');
  const heroSubtitle = settingValue<string>(settings, 'about_hero_subtitle',
    'iVintage College brings together a day school, a boarding house and the iLead Tahfeedh School on one campus in Ikorodu \u2014 redefining western and Islamic intellectualism, with ICT and coding at the core.');
  const historyParagraphs = settingValue<string[]>(settings, 'about_history_paragraphs', [
    'iVintage College was established to deliver a perfect blend of western and Islamic education, as well as proficiency in ICT with coding as a major component, serving families across Ikorodu and the wider Lagos area.',
    'Our pupils combine a sound, highly qualitative western curriculum with Hifdhul Qur\u2019an, Arabic literacy and Islamic education \u2014 memorising at least a quarter of the Qur\u2019an while maintaining distinction scores in internal and external examinations.',
    'Alongside academics, we run leadership training classes, mentoring and coaching, clubs and associations, and guidance and counselling, so every child leaves with character as well as certificates.',
  ]);
  const historyImage = settingValue<string>(settings, 'about_history_image', '/ivintage_logo.png');
  const yearsBadge = settingValue<string>(settings, 'about_years_badge', '');
  // Keep the badge honest: only show a years figure when the CMS supplies a founding year.
  const foundingYear = Number(settingValue<string>(settings, 'about_founding_year', '')) || 0;
  const yearsLabel = yearsBadge || (foundingYear ? `${Math.max(1, new Date().getFullYear() - foundingYear)}+ Years` : 'Ikorodu, Lagos');

  const vision = settingValue<string>(settings, 'about_vision',
    'To be the largest network of Neighbourhood Schools of Choice in Nigeria.');
  const mission = settingValue<string>(settings, 'about_mission',
    'To nurture leaders who are committed to excellence and imbued with a perfect blend of Western and Islamic education with a solid foundation in ICT.');
  const target = settingValue<string>(settings, 'about_target',
    'To establish a network of schools with branches in all 20 Local Governments in Lagos, and all 774 Local Governments in Nigeria.');
  const values = settingValue<Value[]>(settings, 'about_values', DEFAULT_VALUES);
  const leaders = settingValue<Leader[]>(settings, 'about_leaders', DEFAULT_LEADERS);


  return (
    <div className="space-y-0">
      <SEO
        title="About Us  iVintage College"
        description="Learn about iVintage College: our vision, mission, core values, and leadership team shaping the next generation of Nigerian leaders."
        path="/website/about"
      />
      <PageHero
        eyebrow="About iVintage College"
        title={heroTitle}
        highlight={heroHighlight}
        subtitle={heroSubtitle}
        image={heroImage}
        crumbs={[{ label: 'About Us' }]}
      />

      {/* History  asymmetric image + text */}
      <SectionBand>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Our story</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Our rich history</h2>
            <div className="mt-6 space-y-5 text-muted-foreground">
              {historyParagraphs.map((p, i) => (
                <p key={i} className={i === 0 ? 'text-lg leading-relaxed' : 'leading-relaxed'}>{p}</p>
              ))}
            </div>
            <Button className="mt-8 rounded-full px-6" asChild>
              <Link to="/website/admissions">
                Join our legacy <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Reveal>

          <Reveal className="lg:col-span-5" delay={120}>
            <div className="relative">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border shadow-xl">
                <img
                  src={historyImage}
                  alt="iVintage College campus"
                  loading="lazy"
                  className="h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-6 left-6 right-6 rounded-2xl border border-border bg-card p-5 shadow-lg">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="text-2xl font-bold leading-none text-foreground">{yearsLabel}</div>
                    <div className="mt-1 text-sm text-muted-foreground">of educational excellence</div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </SectionBand>

      {/* Vision & Mission  contrasting panels */}
      <SectionBand tone="muted" className="pt-24">
        <SectionHeading
          eyebrow="Direction"
          title="Our vision, mission & target"
          intro="Guiding principles that drive our commitment to educational excellence."
        />
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2">
          <Reveal>
            <article className="h-full rounded-2xl border border-primary/20 bg-primary/5 p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Eye className="h-6 w-6" />
              </span>
              <h3 className="mt-6 text-2xl font-bold text-foreground">Our vision</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{vision}</p>
            </article>
          </Reveal>
          <Reveal delay={100}>
            <article className="h-full rounded-2xl border border-border bg-foreground p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/15 text-background">
                <Target className="h-6 w-6" />
              </span>
              <h3 className="mt-6 text-2xl font-bold text-background">Our mission</h3>
              <p className="mt-3 leading-relaxed text-background/75">{mission}</p>
            </article>
          </Reveal>
          {target && (
            <Reveal delay={160} className="md:col-span-2">
              <article className="h-full rounded-2xl border border-border bg-card p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Landmark className="h-6 w-6" />
                </span>
                <h3 className="mt-6 text-2xl font-bold text-foreground">Our target</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{target}</p>
              </article>
            </Reveal>
          )}
        </div>

      </SectionBand>

      {/* Core values */}
      <SectionBand>
        <SectionHeading
          eyebrow="What we stand for"
          title="Our core values"
          intro="The fundamental principles that shape our educational philosophy."
        />
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
          {values.map((v, i) => {
            const Icon = (v.icon && ICONS[v.icon]) || Award;
            return (
              <Reveal key={v.title} delay={i * 90}>
                <article className="h-full rounded-2xl border border-border bg-card p-7 shadow-sm transition-shadow duration-300 hover:shadow-lg">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.description}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </SectionBand>

      {/* Leadership */}
      <SectionBand tone="muted">
        <SectionHeading
          eyebrow="Leadership"
          title="The people behind the school"
          intro="Experienced educators leading iVintage College towards excellence."
        />
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
          {leaders.map((l, i) => (
            <Reveal key={l.name} delay={i * 100}>
              <article className="group h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  {l.image ? (
                    <img
                      src={l.image}
                      alt={l.name}
                      loading="lazy"
                      className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Users className="h-12 w-12 text-primary" />
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{l.role}</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">{l.name}</h3>
                  {l.bio && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.bio}</p>}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </SectionBand>

      {/* Closing CTA */}
      <SectionBand tone="accent" size="sm">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Come and see the school for yourself</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Book a campus tour or start an application  we would love to meet your family.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="rounded-full px-7" asChild>
              <Link to="/website/admissions/apply">Apply now</Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-7" asChild>
              <Link to="/website/facilities">Explore the campus</Link>
            </Button>
          </div>
        </div>
      </SectionBand>
    </div>
  );
};
