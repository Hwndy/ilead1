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
  { label: 'Enquiry lines', value: '+234 818 803 2057, +234 805 317 1279', icon: 'CalendarDays' },
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
    <section className="border-y border-border bg-muted/40 py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Admissions</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">{heading}</h2>
            <p className="mt-4 text-muted-foreground">{note}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Button asChild className="rounded-full px-6">
                <Link to="/website/admissions/apply">Start an application</Link>
              </Button>
              <Button variant="outline" asChild className="rounded-full px-6">
                <Link to="/website/track-application">Track application</Link>
              </Button>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
            {dates.map((d, i) => {
              const Icon = (d.icon && ICONS[d.icon]) || CalendarDays;
              return (
                <Reveal key={d.label} delay={i * 70}>
                  <div className="flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{d.label}</div>
                      <div className="mt-1 font-semibold text-foreground">{d.value}</div>
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