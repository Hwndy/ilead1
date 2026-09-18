import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, CreditCard, Calendar, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { SectionBand, SectionHeading } from '@/components/website/Section';
import { Reveal } from '@/components/website/Reveal';
import { useSiteFields, useSectionControls } from '@/hooks/useCms';

const HIGHLIGHT_ICONS = [CheckCircle, Users, FileText, CheckCircle, Calendar, CreditCard];
const STEP_ICONS = [FileText, Users, CreditCard, CheckCircle];

export const AdmissionsPage = () => {
  const { field, list } = useSiteFields();
  const { isVisible } = useSectionControls('admissions');
  const brochureUrl = field<string>('prospectus_url', '');

  const highlights = list<{ title: string; description: string }>('admissions.highlights');
  const admissionSteps = list<{ title: string; description: string }>('admissions.process_steps');
  const requirements = list<string>('admissions.requirements');
  const contacts = list<{ label: string; value: string }>('admissions.contacts');

  return (
    <div className="space-y-0">
      <SEO
        title="Admissions — iVintage College"
        description="Admission requirements, process, and important dates for iVintage College. Apply online for nursery, primary, and secondary placement."
        path="/website/admissions"
      />
      {/* Hero Section */}
      <PageHero
        eyebrow={field('admissions.hero_eyebrow')}
        title={field('admissions.hero_title')}
        highlight={field('admissions.hero_highlight')}
        subtitle={field('admissions.hero_subtitle')}
        crumbs={[{ label: 'Admissions' }]}
      >
        <Button size="lg" asChild className="w-full rounded-full px-7 sm:w-auto">
          <Link to="/website/admissions/apply">
            Start Application <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
        <Button variant="outline" size="lg" asChild className="w-full rounded-full px-7 sm:w-auto">
          <Link to="/website/track-application">Track Application</Link>
        </Button>
      </PageHero>

      {/* Why choose us */}
      {isVisible('highlights') && highlights.length ? (
        <SectionBand>
          <SectionHeading
            eyebrow="Why iVintage"
            title={field('admissions.highlights_title')}
            intro={field('admissions.highlights_intro')}
          />
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {highlights.map((h, i) => {
              const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
              return (
                <Reveal key={`${h.title}-${i}`} delay={(i % 3) * 80}>
                  <article className="flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{h.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{h.description}</p>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </SectionBand>
      ) : null}

      {/* Admission process */}
      {isVisible('process') && admissionSteps.length ? (
        <SectionBand tone="muted">
          <SectionHeading
            eyebrow="Process"
            title={field('admissions.process_title')}
            intro={field('admissions.process_intro')}
          />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {admissionSteps.map((step, index) => {
              const Icon = STEP_ICONS[index % STEP_ICONS.length];
              return (
                <Reveal key={`${step.title}-${index}`} delay={index * 90}>
                  <article className="relative h-full rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <Icon className="mx-auto mt-5 h-6 w-6 text-primary" />
                    <h3 className="mt-3 text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                    {index < admissionSteps.length - 1 && (
                      <ArrowRight className="absolute -right-4 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-muted-foreground lg:block" />
                    )}
                  </article>
                </Reveal>
              );
            })}
          </div>
        </SectionBand>
      ) : null}

      {/* Requirements */}
      {isVisible('requirements') && requirements.length ? (
        <SectionBand>
          <SectionHeading
            eyebrow="Checklist"
            title={field('admissions.requirements_title')}
            intro={field('admissions.requirements_intro')}
          />
          <Reveal className="mx-auto max-w-4xl">
            <ul className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm md:grid-cols-2">
              {requirements.map((requirement, i) => (
                <li key={`${requirement}-${i}`} className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">{requirement}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </SectionBand>
      ) : null}

      {/* Ready to apply */}
      {isVisible('cta') ? (
        <SectionBand tone="accent">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              {field('admissions.cta_title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{field('admissions.cta_text')}</p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="rounded-full px-7" asChild>
                <Link to="/website/admissions/apply">
                  Apply online <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-7" asChild>
                <Link to="/website/track-application">Track application</Link>
              </Button>
              {brochureUrl ? (
                <Button variant="outline" size="lg" className="rounded-full px-7" asChild>
                  <a href={brochureUrl} target="_blank" rel="noopener noreferrer">
                    Download brochure
                  </a>
                </Button>
              ) : null}
            </div>

            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
              {contacts.map((c) => (
                <div key={c.label} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{c.label}</p>
                  <p className="mt-2 font-medium text-foreground">{c.value}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionBand>
      ) : null}
    </div>
  );
};
