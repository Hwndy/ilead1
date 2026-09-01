import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/website/Reveal';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';

interface Programme {
  title: string;
  ages: string;
  description: string;
  image?: string;
  href?: string;
}

const DEFAULT_PROGRAMMES: Programme[] = [
  {
    title: 'Junior Secondary',
    ages: 'JSS 1 – 3',
    description: 'Core academics, sciences and vocational exposure preparing every student for the BECE and senior school.',
    image: '/img3.png',
  },
  {
    title: 'Senior Secondary',
    ages: 'SSS 1 – 3',
    description: 'Science, Commercial and Arts tracks with focused WAEC, NECO and university-entrance preparation.',
    image: '/campus.png',
  },
];

export const Programmes: React.FC = () => {
  const { settings } = useWebsiteSettings();
  const programmes = settingValue<Programme[]>(settings, 'home_programmes', DEFAULT_PROGRAMMES);
  const heading = settingValue<string>(settings, 'home_programmes_heading', 'Our Academic Programmes');
  const intro = settingValue<string>(
    settings,
    'home_programmes_intro',
    'One school, one standard  from the first day to the final senior secondary examination.',
  );

  if (!programmes?.length) return null;

  return (
    <section className="py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Programmes</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">{heading}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{intro}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {programmes.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <Link
                to={p.href || '/website/school-life'}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={p.image || '/campus.png'}
                    alt={`${p.title} at iVintage College`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-lg font-bold text-white">{p.title}</h3>
                    <p className="text-xs uppercase tracking-wide text-white/80">{p.ages}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};