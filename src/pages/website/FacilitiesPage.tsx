import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, Microscope, Monitor, Trophy, Utensils, Bus, Home, Building2, Users, GraduationCap, School } from 'lucide-react';
import { useWebsiteSettings, useGallery, settingValue } from '@/hooks/useCms';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { SectionBand, SectionHeading } from '@/components/website/Section';
import { Reveal } from '@/components/website/Reveal';

// Rotating campus imagery so each facility card is photo-led rather than icon-led.
const CARD_IMAGES = ['/campus.png', '/img1.png', '/img2.png', '/img3.png'];

const ICONS: Record<string, React.ComponentType<any>> = {
  BookOpen, Microscope, Monitor, Trophy, Utensils, Bus, Home, Building2, Users, GraduationCap, School,
};

interface Facility { title: string; description: string; icon?: string }

const DEFAULT_FACILITIES: Facility[] = [
  { title: 'iLead Vintage College (Day School)', description: 'Purpose-built classrooms on the Akinsanya Estate campus, with small class sizes and dedicated subject teachers.', icon: 'School' },
  { title: 'iLead Vintage Boarding House', description: 'Supervised boarding with structured prep, morning and evening prayers, and full-time house parents.', icon: 'Home' },
  { title: 'iLead Tahfeedh School', description: 'Dedicated Qur’an memorisation and Arabic programme running alongside the academic curriculum.', icon: 'BookOpen' },
  { title: 'ICT and Coding Laboratory', description: 'Networked computer lab where every student learns digital literacy, coding and problem solving.', icon: 'Monitor' },
  { title: 'Science Laboratories', description: 'Equipped Biology, Chemistry and Physics laboratories for practical work and WAEC/NECO preparation.', icon: 'Microscope' },
  { title: 'Library and Resource Centre', description: 'Reference books, past questions and quiet study space for private and supervised reading.', icon: 'BookOpen' },
  { title: 'Sports and Recreation', description: 'Football, basketball, athletics and table tennis, with inter-house competitions each session.', icon: 'Trophy' },
  { title: 'Kitchen and Dining', description: 'Hygienic kitchen serving balanced meals for boarders and day students.', icon: 'Utensils' },
];
export const FacilitiesPage = () => {
  const { settings } = useWebsiteSettings();
  const intro = settingValue<string>(settings, 'facilities_intro', 'Modern infrastructure designed to support effective teaching, learning, and character development');
  const facilities = settingValue<Facility[]>(settings, 'facilities', DEFAULT_FACILITIES);
  const { data: photos = [] } = useGallery({ category: 'facilities', limit: 12 });

  return (
    <div className="space-y-0">
      <SEO
        title="Facilities  iVintage College"
        description="Explore iVintage's world-class facilities: modern classrooms, science labs, library, computer lab, sports complex, cafeteria, and safe transportation."
        path="/website/facilities"
      />
      <PageHero
        eyebrow="Campus"
        title="World-Class Facilities"
        subtitle={intro}
        crumbs={[{ label: 'Facilities' }]}
      />

      <SectionBand>
        <SectionHeading
          eyebrow="Facilities"
          title="Built for how children actually learn"
          intro="Every space on campus is there for a reason  study, science, sport, safety and rest."
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {facilities.map((facility, index) => {
            const Icon = (facility.icon && ICONS[facility.icon]) || BookOpen;
            const photo = photos[index]?.image_url || CARD_IMAGES[index % CARD_IMAGES.length];
            return (
              <Reveal key={facility.title} delay={(index % 3) * 90}>
                <article className="group relative h-full min-h-[300px] overflow-hidden rounded-2xl border border-border shadow-sm">
                  <img
                    src={photo}
                    alt={facility.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/10" />
                  <div className="relative flex h-full flex-col justify-end p-6">
                    <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-white backdrop-blur-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-xl font-semibold text-white">{facility.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-200">{facility.description}</p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </SectionBand>

      {photos.length > 0 && (
        <SectionBand tone="muted">
          <SectionHeading
            eyebrow="Gallery"
            title="Around the campus"
            intro="A closer look at the classrooms, labs and grounds your child will use every day."
          />
          <div className="columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
            {photos.map((p) => (
              <div key={p.id} className="group relative break-inside-avoid overflow-hidden rounded-xl border border-border">
                <img
                  src={p.image_url}
                  alt={p.alt_text || p.title || 'Facility'}
                  loading="lazy"
                  className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {p.title && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                    <p className="truncate text-sm font-medium text-white">{p.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button variant="outline" className="rounded-full px-6" asChild>
              <Link to="/website/gallery">View the full gallery</Link>
            </Button>
          </div>
        </SectionBand>
      )}

      <SectionBand tone="accent" size="sm">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Book a campus tour</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Photos only go so far. Come and walk the grounds, meet the teachers and see a lesson in progress.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="rounded-full px-7" asChild>
              <Link to="/website/admissions/apply">Start an application</Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-7" asChild>
              <Link to="/website/about">About the school</Link>
            </Button>
          </div>
        </div>
      </SectionBand>
    </div>
  );
};
