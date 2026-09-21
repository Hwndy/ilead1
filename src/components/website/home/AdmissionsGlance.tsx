import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CalendarDays, ClipboardList, FileCheck2, GraduationCap } from 'lucide-react';
import { Reveal } from '@/components/website/Reveal';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';

interface KeyDate {
  label: string;
  value: string;
  icon?: string;
}

const ICONS: Record<string, React.ComponentType<any>> = {
  CalendarDays,
  ClipboardList,
  FileCheck2,
  GraduationCap,
};

const DEFAULT_DATES: KeyDate[] = [
  { label: 'Applications', value: 'Now open', icon: 'ClipboardList' },
  { label: 'Entrance examination', value: 'Every Saturday, 10am prompt', icon: 'FileCheck2' },
  { label: 'Enquiry line', value: '+234 813 419 7710', icon: 'CalendarDays' },
  { label: 'New session begins', value: 'September', icon: 'GraduationCap' },
];

export const AdmissionsGlance: React.FC = () => {
  const { settings } = useWebsiteSettings();
  const dates = settingValue<KeyDate[]>(settings, 'home_key_dates', DEFAULT_DATES);
  const heading = settingValue<string>(settings, 'home_key_dates_heading', 'Admissions at a glance');
  const note = settingValue<string>(
    settings,
    'home_key_dates_note',
    'Entrance examinations hold every Saturday at 10am prompt. Apply early  places in each class are limited.',
  );


  if (!dates?.length) return null;

  return (
    <section className="bg-primary py-16 text-primary-foreground sm:py-20">
      <div className="site-container">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="site-kicker [&]:text-gold">Admissions</p>
            <h2 className="mt-4 text-3xl font-bold text-primary-foreground lg:text-4xl">{heading}</h2>
            <p className="mt-4 text-primary-foreground/70">{note}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Button asChild variant="secondary" className="px-6">
                <Link to="/website/admissions/apply">Start an application</Link>
              </Button>
              <Button variant="outline" asChild className="border-primary-foreground/25 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/website/track-application">Track application</Link>
              </Button>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
            {dates.map((d, i) => {
              const Icon = (d.icon && ICONS[d.icon]) || CalendarDays;
              return (
                <Reveal key={d.label} delay={i * 70}>
                  <div className="flex h-full items-start gap-4 border border-primary-foreground/15 bg-primary-foreground/[0.04] p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-gold text-gold-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wide text-primary-foreground/55">{d.label}</div>
                      <div className="mt-1 font-semibold text-primary-foreground">{d.value}</div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};