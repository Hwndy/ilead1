import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, CreditCard, GraduationCap, ArrowRight, ClipboardList, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';

const ICONS: Record<string, React.ComponentType<any>> = {
  FileText, CreditCard, GraduationCap, ClipboardList, CheckCircle2,
};

interface Step { n: string; icon?: string; title: string; body: string }

const DEFAULTS: Step[] = [
  { n: '01', icon: 'FileText', title: 'Submit Application', body: "Complete the online application with your child's details and upload required documents." },
  { n: '02', icon: 'CreditCard', title: 'Entrance Assessment', body: 'Pay the application fee and attend the scheduled entrance examination and interview.' },
  { n: '03', icon: 'GraduationCap', title: 'Accept Your Offer', body: 'Receive your offer letter, pay acceptance fees and join the iVintage family.' },
];

export const HowToApply: React.FC = () => {
  const { settings } = useWebsiteSettings();
  const steps = settingValue<Step[]>(settings, 'how_to_apply_steps', DEFAULTS);
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            <span className="h-px w-8 bg-gold" />
            Admissions, Made Simple
            <span className="h-px w-8 bg-gold" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            Three steps to becoming an iVintage Student
          </h2>
        </div>
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          {steps.map(({ n, icon, title, body }) => {
            const Icon = (icon && ICONS[icon]) || FileText;
            return (
              <div key={n} className="relative text-center group">
                <div className="relative mx-auto mb-6 h-24 w-24">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-primary-hover shadow-lg group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-2 rounded-full bg-card flex items-center justify-center">
                    <Icon className="h-9 w-9 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-9 w-9 rounded-full bg-gold text-gold-foreground font-bold flex items-center justify-center text-sm shadow-md">
                    {n}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{body}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-12 text-center">
          <Button size="lg" asChild className="shadow-lg">
            <Link to="/website/admissions">
              Start Your Application <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
