import React from 'react';
import { Reveal, CountUp } from '@/components/website/Reveal';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';
import { Award, Medal, School, TrendingUp } from 'lucide-react';

interface Achievement {
  value: string;
  label: string;
  detail?: string;
  icon?: string;
}

const ICONS: Record<string, React.ComponentType<any>> = { Award, Medal, School, TrendingUp };

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { value: '98%', label: 'WAEC credit passes', detail: 'Five credits including English and Mathematics', icon: 'TrendingUp' },
  { value: '100%', label: 'BECE pass rate', detail: 'Every junior candidate progressed to senior school', icon: 'School' },
  { value: '30+', label: 'Competition awards', detail: 'Debate, spelling, mathematics and Qur\u2019anic contests', icon: 'Medal' },
  { value: '20+', label: 'Universities placed', detail: 'Alumni admitted into Nigerian and overseas universities', icon: 'Award' },
];

export const Achievements: React.FC = () => {
  const { settings } = useWebsiteSettings();
  const items = settingValue<Achievement[]>(settings, 'home_achievements', DEFAULT_ACHIEVEMENTS);
  const heading = settingValue<string>(settings, 'home_achievements_heading', 'Results that speak for themselves');
  const intro = settingValue<string>(
    settings,
    'home_achievements_intro',
    'Our record in national examinations and competitions is the clearest measure of what our students achieve.',
  );

  if (!items?.length) return null;

  return (
    <section className="py-16 sm:py-20">
      <div className="site-container">
        <Reveal className="mb-12 max-w-3xl">
          <p className="site-kicker">Achievements</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-foreground lg:text-4xl">{heading}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{intro}</p>
        </Reveal>

        <div className="grid grid-cols-1 border-y border-border sm:grid-cols-2 lg:grid-cols-4">
          {items.map((a, i) => {
            const Icon = (a.icon && ICONS[a.icon]) || Award;
            return (
              <Reveal key={a.label} delay={i * 70}>
                <div className="h-full border-b border-r border-border p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center bg-gold-soft">
                    <Icon className="h-5 w-5 text-steel" />
                  </div>
                  <div className="text-3xl font-bold text-steel">
                    <CountUp value={a.value} />
                  </div>
                  <div className="mt-1 font-semibold text-foreground">{a.label}</div>
                  {a.detail && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.detail}</p>}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};