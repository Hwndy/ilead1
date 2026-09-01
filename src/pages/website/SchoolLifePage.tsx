import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Microscope, Calculator, Globe, Palette, Trophy } from 'lucide-react';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { SectionBand, SectionHeading } from '@/components/website/Section';
import { Reveal } from '@/components/website/Reveal';

export const SchoolLifePage = () => {
  const academicPrograms = [
    {
      title: "Science Track",
      description: "Comprehensive science education preparing students for medical and engineering careers",
      icon: Microscope,
      subjects: ["Biology", "Chemistry", "Physics", "Mathematics", "English"]
    },
    {
      title: "Commercial Track", 
      description: "Business-focused curriculum developing entrepreneurial and financial skills",
      icon: Calculator,
      subjects: ["Accounting", "Economics", "Commerce", "Mathematics", "English"]
    },
    {
      title: "Arts Track",
      description: "Liberal arts program fostering critical thinking and cultural awareness",
      icon: Palette,
      subjects: ["Literature", "Government", "History", "Islamic Studies", "Arabic"]
    }
  ];

  const facilities = [
    {
      title: "Modern Library",
      description: "Extensive collection of books, digital resources, and quiet study spaces",
      icon: BookOpen
    },
    {
      title: "Science Laboratories", 
      description: "Fully equipped labs for Biology, Chemistry, and Physics practical sessions",
      icon: Microscope
    },
    {
      title: "Computer Lab",
      description: "State-of-the-art computers with internet access for digital literacy",
      icon: Globe
    },
    {
      title: "Sports Complex",
      description: "Indoor and outdoor facilities for various sports and physical activities",
      icon: Trophy
    }
  ];

  const extracurricular = [
    "Debate Club", "Science Club", "Literature Society", "Mathematics Club",
    "Football Team", "Basketball Team", "Athletics", "Table Tennis",
    "Quranic Recitation", "Arabic Calligraphy"
  ];

  const classStructure = [
    { level: 'JSS 1 – 3', title: 'Junior Secondary', description: 'Broad curriculum leading to BECE, with early subject guidance.' },
    { level: 'SSS 1 – 3', title: 'Senior Secondary', description: 'Specialised tracks preparing students for WAEC, NECO and JAMB.' },
    { level: '20–25', title: 'Class size', description: 'Small classes so every child is known, tracked and supported.' },
  ];

  const schedule = [
    { time: '7:30 – 8:00 AM', activity: 'Morning assembly & prayers' },
    { time: '8:00 – 11:30 AM', activity: 'First academic session' },
    { time: '11:30 – 12:00 PM', activity: 'Break & refreshments' },
    { time: '12:00 – 1:00 PM', activity: 'Second academic session' },
    { time: '1:00 – 2:00 PM', activity: 'Lunch break & prayers' },
    { time: '2:00 – 4:00 PM', activity: 'Madrasah & study period' },
  ];

  return (
    <div className="space-y-0">
      <SEO
        title="School Life — iVintage College"
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
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
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
          intro="Two campus, one continuous journey — with small classes at every stage."
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
            Applications are open across Nursery, Primary and Secondary.
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
