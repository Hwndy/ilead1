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
    <section className="py-16 sm:py-24">
      <div className="site-container">
        <Reveal className="mb-12 grid items-end gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <div>
            <p className="site-kicker">Programmes</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight text-foreground lg:text-5xl">{heading}</h2>
          </div>
          <p className="text-base leading-relaxed text-muted-foreground">{intro}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {programmes.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <Link
                to={p.href || '/website/school-life'}
                className="group relative flex min-h-[23rem] overflow-hidden rounded-lg bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={p.image || '/campus.png'}
                    alt={`${p.title} at iVintage College`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/25 to-transparent" />
                </div>
                <div className="relative z-10 mt-auto p-6 text-primary-foreground">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gold">{p.ages}</p>
                  <h3 className="mt-2 text-2xl font-bold">{p.title}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-primary-foreground/75">{p.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-gold">
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