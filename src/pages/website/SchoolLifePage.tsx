import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Microscope, Calculator, Globe, Palette, Trophy } from 'lucide-react';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { SectionBand, SectionHeading } from '@/components/website/Section';
import { Reveal } from '@/components/website/Reveal';
import { useSiteFields, useSectionControls } from '@/hooks/useCms';

const PROGRAMME_ICONS = [Microscope, Calculator, Palette, BookOpen];
const FACILITY_ICONS = [BookOpen, Microscope, Globe, Trophy];

export const SchoolLifePage = () => {
  const { field, list } = useSiteFields();
  const { isVisible } = useSectionControls('school-life');

  const academicPrograms = list<{ title: string; description: string; subjects?: string }>('school_life.programmes');
  const facilities = list<{ title: string; description: string }>('facilities').slice(0, 4);
  const extracurricular = list<string>('school_life.clubs');
  const classStructure = list<{ level: string; title: string; description: string }>('school_life.structure');
  const schedule = list<{ time: string; activity: string }>('school_life.schedule');


  return (
    <div className="space-y-0">
      <SEO
        title="School Life  iVintage College"
        description="Discover academic tracks, clubs, sports, and student life experiences that shape well-rounded scholars at iVintage College."
        path="/website/school-life"
      />
      {/* Hero Section */}
      <PageHero
        eyebrow="School Life at iVintage"
        title="Academic Excellence &"
        highlight="Holistic Development"
        subtitle="Experience a vibrant school life that combines rigorous academics with character development, extracurricular activities, and a supportive community environment."
        crumbs={[{ label: 'School Life' }]}
      />

      {/* Academic programmes */}
      <SectionBand>
        <SectionHeading
          eyebrow="Curriculum"
          title="Academic programmes"
          intro="Comprehensive tracks designed to prepare students for higher education and career success."
        />
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {academicPrograms.map((program, index) => (
            <Reveal key={program.title} delay={index * 90}>
              <article className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <span className="absolute right-6 top-5 text-5xl font-bold leading-none text-primary/10">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <program.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-foreground">{program.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{program.description}</p>
                <div className="mt-5 border-t border-border pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Core subjects
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {program.subjects.map((subject) => (
                      <Badge key={subject} variant="secondary" className="rounded-full text-xs font-normal">
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </SectionBand>

      {/* Class structure */}
      <SectionBand tone="muted">
        <SectionHeading
          eyebrow="Structure"
          title="From Junior to senior secondary"
          intro="Two campuses, one continuous journey  with small classes at every stage."
        />
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {classStructure.map((c, i) => (
            <Reveal key={c.level} delay={(i % 3) * 80}>
              <article className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{c.level}</p>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </SectionBand>

      {/* Facilities */}
      <SectionBand>
        <SectionHeading
          eyebrow="Campus"
          title="World-class facilities"
          intro="Modern infrastructure supporting effective teaching and learning."
        />
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
          {facilities.map((facility, index) => (
            <Reveal key={facility.title} delay={(index % 2) * 90}>
              <article className="flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <facility.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{facility.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{facility.description}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button variant="outline" className="rounded-full px-6" asChild>
            <Link to="/website/facilities">See all facilities</Link>
          </Button>
        </div>
      </SectionBand>

      {/* Extracurricular */}
      <SectionBand tone="muted">
        <SectionHeading
          eyebrow="Beyond the classroom"
          title="Clubs, sport and culture"
          intro="Developing talents, leadership skills and personal interests alongside academics."
        />
        <Reveal className="mx-auto max-w-4xl">
          <div className="flex flex-wrap justify-center gap-3">
            {extracurricular.map((activity) => (
              <span
                key={activity}
                className="rounded-full border border-border bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
              >
                {activity}
              </span>
            ))}
          </div>
        </Reveal>
      </SectionBand>

      {/* Daily schedule */}
      <SectionBand>
        <SectionHeading
          eyebrow="A day at iVintage"
          title="Typical school day"
          intro="A structured day that balances academics, worship, rest and play."
        />
        <Reveal className="mx-auto max-w-3xl">
          <ol className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {schedule.map((s, i) => (
              <li
                key={s.time}
                className={`flex flex-col gap-1 px-6 py-5 sm:flex-row sm:items-center sm:justify-between ${
                  i % 2 === 1 ? 'bg-muted/40' : ''
                }`}
              >
                <span className="text-sm font-semibold text-primary">{s.time}</span>
                <span className="text-muted-foreground">{s.activity}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </SectionBand>

      <SectionBand tone="accent" size="sm">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Give your child this school day</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Applications are open across Junior and Senior Secondary, day and boarding.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="rounded-full px-7" asChild>
              <Link to="/website/admissions/apply">Apply now</Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-7" asChild>
              <Link to="/website/admissions">Admissions info</Link>
            </Button>
          </div>
        </div>
      </SectionBand>
    </div>
  );
};
