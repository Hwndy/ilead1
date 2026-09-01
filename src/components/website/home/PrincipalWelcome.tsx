import React from 'react';
import { Quote } from 'lucide-react';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';

export const PrincipalWelcome: React.FC = () => {
  const { settings } = useWebsiteSettings();
  const name = settingValue<string>(settings, 'principal_name', 'The Principal');
  const title = settingValue<string>(settings, 'principal_title', 'iVintage College');

  const photo = settingValue<string>(settings, 'principal_photo_url', '');
  const message = settingValue<string>(
    settings,
    'principal_message',
    "At iVintage College, bright minds are nurtured into principled leaders  in the classroom, in the boarding house and in the Tahfeedh school."
  );
  const paragraphs = message.split(/\n{2,}/);
  return (
    <section className="py-20 bg-gradient-to-b from-background to-accent/30">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Portrait */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/5] max-w-md mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-br from-gold/40 via-primary/20 to-primary/40 rounded-2xl blur-2xl opacity-60" />
              <div className="relative h-full w-full rounded-2xl overflow-hidden border-4 border-gold/30 shadow-2xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center">
                <img
                  src={photo}
                  alt={`${name}  ${title}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              {/* Floating signature card */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border shadow-xl rounded-xl px-6 py-3 text-center min-w-[220px]">
                <p className="font-serif italic text-primary text-lg leading-tight">{name}</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{title}</p>
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              <span className="h-px w-8 bg-gold" />
              A Word From the Principal
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground leading-tight">
              Where character meets <span className="text-primary">academic mastery</span>.
            </h2>
            <div className="relative pl-8">
              <Quote className="absolute -left-1 top-0 h-10 w-10 text-gold/40" />
              {paragraphs.map((p, i) => (
                <p key={i} className={`text-lg text-muted-foreground leading-relaxed ${i > 0 ? 'mt-4' : ''}`}>
                  {p}
                </p>
              ))}
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="h-1 w-12 bg-gold rounded-full" />
              <p className="text-sm text-muted-foreground">
                Day school, boarding house and Tahfeedh school on one campus in Ikorodu, Lagos.
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};