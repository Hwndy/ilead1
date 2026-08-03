import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, GraduationCap, UserCheck, Shield, ArrowRight, Briefcase, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { SectionBand, SectionHeading } from '@/components/website/Section';
import { Reveal } from '@/components/website/Reveal';

const ICONS: Record<string, React.ComponentType<any>> = {
  Users, GraduationCap, UserCheck, Shield, Briefcase, BookOpen,
};

interface Portal {
  title: string;
  description: string;
  icon?: string;
  link: string;
  features: string[];
  enabled?: boolean;
}

const DEFAULTS: Portal[] = [
  { title: 'Student Portal', description: 'Access exam schedules, results, assignments, and academic resources', icon: 'GraduationCap', link: '/login', features: ['View Exam Results', 'Class Schedules', 'Assignments', 'Academic Calendar'], enabled: true },
  { title: 'Parent Portal', description: "Monitor your child's academic progress, attendance, and school activities", icon: 'Users', link: '/login', features: ["Child's Progress", 'Fee Payment', 'Communication', 'Events Updates'], enabled: true },
  { title: 'Teacher Portal', description: 'Manage classes, create exams, track student performance and communicate with parents', icon: 'UserCheck', link: '/login', features: ['Class Management', 'Exam Creation', 'Grade Reports', 'Student Records'], enabled: true },
  { title: 'Admin Portal', description: 'Comprehensive school management system for administrators and staff', icon: 'Shield', link: '/login', features: ['User Management', 'System Settings', 'Reports', 'School Analytics'], enabled: true },
];

export const PortalsPage = () => {
  const { settings } = useWebsiteSettings();
  const portals = settingValue<Portal[]>(settings, 'portals', DEFAULTS).filter((p) => p.enabled !== false);

  // Every portal card points at the plain sign-in route — no query parameters,
  // whatever the CMS has stored for the card link.
  const LOGIN_PATH = '/login';
  return (
    <div className="space-y-0">
      <SEO
        title="Portals — iVintage College"
        description="Sign in to the iVintage student, parent, teacher, or admin portal to access grades, results, fees, communications, and school resources."
        path="/website/portals"
      />
      <PageHero
        eyebrow="Portals"
        title="Access Your Portal"
        subtitle="Choose your portal to access personalised features and stay connected with iVintage College."
        crumbs={[{ label: 'Portals' }]}
      />

      <SectionBand>
        <SectionHeading
          eyebrow="Sign in"
          title="Four portals, one school"
          intro="Each portal gives you exactly what you need — nothing you don't."
        />
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
          {portals.map((portal, idx) => {
            const Icon = (portal.icon && ICONS[portal.icon]) || GraduationCap;
            return (
              <Reveal key={idx} delay={(idx % 2) * 90}>
                <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{portal.title}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{portal.description}</p>
                    </div>
                  </div>
                  <ul className="mb-7 mt-6 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    {portal.features?.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    <Button asChild className="w-full rounded-full">
                      <Link to={LOGIN_PATH}>
                        Enter portal <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    {portal.title.toLowerCase().includes('parent') && (
                      <p className="mt-3 text-center text-sm text-muted-foreground">
                        New parent?{' '}
                        <Link to="/login?mode=register&role=parent" className="font-medium text-primary hover:underline">
                          Create an account
                        </Link>
                      </p>
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          New parent?{' '}
          <Link to="/login?mode=register&role=parent" className="font-medium text-primary hover:underline">
            Create an account
          </Link>{' '}
          to link your children.
        </p>
      </SectionBand>
    </div>
  );
};
