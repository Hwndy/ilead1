import React from 'react';
import { Reveal } from '@/components/website/Reveal';

interface SectionBandProps {
  children: React.ReactNode;
  /** Alternating surface tone so pages have vertical rhythm. */
  tone?: 'default' | 'muted' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
}

const TONES: Record<NonNullable<SectionBandProps['tone']>, string> = {
  default: 'bg-background',
  muted: 'border-y border-border bg-muted/55',
  accent: 'border-y border-border bg-gold-soft/45',
};

const SIZES: Record<NonNullable<SectionBandProps['size']>, string> = {
  sm: 'py-12',
  md: 'py-16 sm:py-20',
  lg: 'py-20 sm:py-24',
};

export const SectionBand: React.FC<SectionBandProps> = ({
  children,
  tone = 'default',
  size = 'md',
  className = '',
  id,
}) => (
  <section id={id} className={`${TONES[tone]} ${SIZES[size]} ${className}`}>
    <div className="site-container">{children}</div>
  </section>
);

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: string;
  align?: 'center' | 'left';
  className?: string;
}

/** The single heading treatment used by every section across the site. */
export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  title,
  intro,
  align = 'center',
  className = '',
}) => (
  <Reveal
    className={`mb-12 ${align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl text-left'} ${className}`}
  >
    {eyebrow && (
      <p className={align === 'center' ? 'text-xs font-extrabold uppercase tracking-[0.18em] text-steel' : 'site-kicker'}>{eyebrow}</p>
    )}
    <h2 className="mt-4 text-3xl font-bold leading-tight text-foreground lg:text-4xl">{title}</h2>
    {intro && <p className="mt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">{intro}</p>}
  </Reveal>
);

export default SectionBand;
