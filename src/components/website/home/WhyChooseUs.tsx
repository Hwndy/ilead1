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
    description: 'Sound, highly qualitative western education, with distinction scores maintained in both internal and external examinations.',
    image: '/img1.png',
  },
  {
    title: 'ICT and coding',
    description: 'Proficiency in Microsoft Office (Word, Excel, PowerPoint, Access), basic programming and coding, and robotics.',
    image: '/img3.png',
  },
  {
    title: 'Hifdhul Qur\u2019an, Islamic education and Arabic',
    description: 'Qur\u2019an memorisation  at least a quarter of the whole Qur\u2019an  Arabic literacy and proficiency, very sound morals, and a high level of understanding of Islamic beliefs and values.',
    image: '/img2.png',
  },
  {
    title: 'Leadership development',
    description: 'Leadership training classes, mentoring and coaching programmes, clubs and associations (literacy and debating, book readers, karate and more), plus guidance and counselling.',
    image: '/campus.png',
  },
];

export const WhyChooseUs: React.FC = () => {
  const { settings } = useWebsiteSettings();
  const pillars = settingValue<Pillar[]>(settings, 'home_pillars', DEFAULT_PILLARS);
  const heading = settingValue<string>(settings, 'home_pillars_heading', 'A perfect blend of western and Islamic education');
  const intro = settingValue<string>(
    settings,
    'home_pillars_intro',
    'Four pillars shape every child who passes through iVintage College  with coding a major component.',
  );


  if (!pillars?.length) return null;

  return (
    <section className="border-y border-border bg-muted/55 py-16 sm:py-24">
      <div className="site-container">
        <Reveal className="mb-12 max-w-3xl">
          <p className="site-kicker">The iVintage foundation</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-foreground lg:text-5xl">{heading}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{intro}</p>
        </Reveal>

        <div className="grid grid-cols-1 border-t border-border sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 90}>
              <article className="h-full border-b border-border p-6 sm:border-r lg:p-7">
                <div className="text-sm font-extrabold text-gold">{String(i + 1).padStart(2, '0')}</div>
                <div className="pt-4">
                  <h3 className="text-lg font-bold leading-snug text-foreground">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
                </div>
              </article>

            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};