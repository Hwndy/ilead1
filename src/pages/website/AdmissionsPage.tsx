import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, CreditCard, Calendar, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { SectionBand, SectionHeading } from '@/components/website/Section';
import { Reveal } from '@/components/website/Reveal';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';

export const AdmissionsPage = () => {
  const { settings } = useWebsiteSettings();
  const brochureUrl = settingValue<string>(settings, 'prospectus_url', '');
  const admissionSteps = [
    {
      step: 1,
      title: "Submit Application",
      description: "Complete and submit the online admission form with required documents",
      icon: FileText
    },
    {
      step: 2,
      title: "Entrance Examination",
      description: "Attend the scheduled entrance examination and interview",
      icon: Users
    },
    {
      step: 3,
      title: "Payment of Fees",
      description: "Pay admission and first term fees upon acceptance",
      icon: CreditCard
    },
    {
      step: 4,
      title: "Resume Classes",
      description: "Join your assigned class and begin your iVintage journey",
      icon: CheckCircle
    }
  ];

  const requirements = [
    "Birth Certificate or Age Declaration",
    "Previous School Report Card/Transcript", 
    "Passport Photographs (4 copies)",
    "Medical Certificate of Fitness",
    "Primary Six Leaving Certificate (for JSS1)",
    "JSS3 Certificate (for SSS1)",
    "Letter of Good Conduct from Previous School"
  ];

  const highlights = [
    { title: 'Strong exam results', description: 'Consistent performance in WAEC, NECO and JAMB examinations.', icon: CheckCircle },
    { title: 'Small class sizes', description: 'Around 25 students per class, so every child is known and supported.', icon: Users },
    { title: 'Modern curriculum', description: 'Technology, critical thinking and 21st-century skills woven throughout.', icon: FileText },
    { title: 'Qualified teachers', description: 'Experienced, certified educators committed to academics and character.', icon: CheckCircle },
    { title: 'Holistic development', description: 'A balance of academics, faith, sport and extracurricular life.', icon: Calendar },
    { title: 'Affordable fees', description: 'Competitive rates with flexible payment options available.', icon: CreditCard },
  ];

  return (
    <div className="space-y-0">
      <SEO
        title="Admissions — iVintage College"
        description="Admission requirements, process, and important dates for iVintage College. Apply online for nursery, primary, and secondary placement."
        path="/website/admissions"
      />
      {/* Hero Section */}
      <PageHero
        eyebrow="Join iVintage College"
        title="Begin Your Journey to"
        highlight="Academic Excellence"
        subtitle="We welcome bright, motivated students who are ready to embrace our culture of excellence, integrity, and character development. Start your application today."
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
      <SectionBand>
        <SectionHeading
          eyebrow="Why iVintage"
          title="Why families choose us"
          intro="The advantages that make us a preferred choice for quality education."
        />
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {highlights.map((h, i) => (
            <Reveal key={h.title} delay={(i % 3) * 80}>
              <article className="flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <h.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{h.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{h.description}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </SectionBand>

      {/* Admission process */}
      <SectionBand tone="muted">
        <SectionHeading
          eyebrow="Process"
          title="Four steps to admission"
          intro="A simple, transparent process designed for your convenience."
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {admissionSteps.map((step, index) => (
            <Reveal key={step.step} delay={index * 90}>
              <article className="relative h-full rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {step.step}
                </span>
                <step.icon className="mx-auto mt-5 h-6 w-6 text-primary" />
                <h3 className="mt-3 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                {index < admissionSteps.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-muted-foreground lg:block" />
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </SectionBand>

      {/* Requirements */}
      <SectionBand>
        <SectionHeading
          eyebrow="Checklist"
          title="What you need to apply"
          intro="Have these documents ready before you start the online form."
        />
        <Reveal className="mx-auto max-w-4xl">
          <ul className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm md:grid-cols-2">
            {requirements.map((requirement) => (
              <li key={requirement} className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm text-muted-foreground">{requirement}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </SectionBand>

      {/* Ready to apply */}
      <SectionBand tone="accent">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Ready to apply?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Take the first step towards joining our community of excellence. Our admissions team is ready to guide you
            through the process.
          </p>

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
            {[
              { label: 'Admissions office', value: '+234 813 418 7710' },
              { label: 'Email', value: 'admissions@ivintagecollege.com' },
              { label: 'Office hours', value: 'Mon – Fri, 8AM – 4PM' },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{c.label}</p>
                <p className="mt-2 font-medium text-foreground">{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionBand>
    </div>
  );
};
