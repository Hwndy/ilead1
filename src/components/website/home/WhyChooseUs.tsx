import React from 'react';
import { Reveal } from '@/components/website/Reveal';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';

interface Pillar {
  title: string;
  description: string;
  image?: string;
}

const DEFAULT_PILLARS: Pillar[] = [
  {
    title: 'Academic excellence',
    description: 'Small classes, continuous assessment and consistent credit passes in WAEC, NECO and BECE.',
    image: '/img1.png',
  },
  {
    title: 'Character and faith',
    description: 'Qur\u2019anic and moral instruction woven into daily school life, not treated as an add-on.',
    image: '/img2.png',
  },
  {
    title: 'Teachers who know your child',
    description: 'Qualified, long-serving staff with termly parent conferences and open reporting through the parent portal.',
    image: '/img3.png',
  },
];

export const WhyChooseUs: React.FC = () => {
  const { settings } = useWebsiteSettings();
  const pillars = settingValue<Pillar[]>(settings, 'home_pillars', DEFAULT_PILLARS);
  const heading = settingValue<string>(settings, 'home_pillars_heading', 'Why families choose iVintage');
  const intro = settingValue<string>(
    settings,
    'home_pillars_intro',
    'Three things parents tell us keep them here \u2014 and keep them recommending us.',
  );

  if (!pillars?.length) return null;

  return (
    <section className="py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Why us</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">{heading}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{intro}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 90}>
              <article className="group relative h-full min-h-[320px] overflow-hidden rounded-2xl border border-border shadow-sm">
                <img
                  src={p.image || '/campus.png'}
                  alt={p.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
                <div className="relative flex h-full flex-col justify-end p-6">
                  <h3 className="text-xl font-bold text-white">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">{p.description}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};