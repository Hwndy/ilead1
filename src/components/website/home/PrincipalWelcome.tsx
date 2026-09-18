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
    <section className="bg-background py-20">
      <div className="site-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Portrait */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/5] max-w-md mx-auto">
               <div className="absolute -inset-3 rounded-t-full border-2 border-gold" />
               <div className="site-arch-image relative flex h-full w-full items-center justify-center overflow-hidden bg-primary">
                <img
                   src={photo || '/campus.png'}
                  alt={`${name}  ${title}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                   onError={(e) => { e.currentTarget.src = '/campus.png'; }}
                />
              </div>
              {/* Floating signature card */}
               <div className="absolute -bottom-6 left-6 right-6 border-l-4 border-gold bg-primary px-6 py-4 text-center text-primary-foreground shadow-xl">
                 <p className="text-lg font-bold leading-tight">{name}</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{title}</p>
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="lg:col-span-7 space-y-6">
             <div className="site-kicker">A Word From the Principal</div>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground leading-tight">
               Where character meets <span className="text-steel">academic mastery</span>.
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