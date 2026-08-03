import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Clock, ExternalLink } from 'lucide-react';
import { Reveal } from '@/components/website/Reveal';
import { useSchoolInfo, useWebsiteSettings, settingValue } from '@/hooks/useCms';

export const VisitUs: React.FC = () => {
  const { info } = useSchoolInfo();
  const { settings } = useWebsiteSettings();

  const address = info.address || 'Akinsanya Estate, Owode-Ibeshe Road, beside Ansar-Ud-Deen (ADS) Mosque, Ikorodu, Lagos';
  const hours = settingValue<string>(settings, 'office_hours', 'Monday – Friday, 8:00am – 4:00pm');
  const mapQuery = encodeURIComponent(`${info.name || 'iVintage College'} ${address}`);
  const heading = settingValue<string>(settings, 'home_visit_heading', 'Come and see the school');
  const intro = settingValue<string>(
    settings,
    'home_visit_intro',
    'Prospective parents are welcome on campus during office hours. Book a tour and meet the teachers who will be teaching your child.',
  );

  return (
    <section className="border-y border-border bg-muted/40 py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="grid items-stretch gap-8 lg:grid-cols-2">
          <Reveal className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Visit us</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">{heading}</h2>
            <p className="mt-4 text-muted-foreground">{intro}</p>

            <ul className="mt-7 space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-foreground">{address}</span>
              </li>
              {info.contact_phone && (
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <a href={`tel:${info.contact_phone.replace(/\s+/g, '')}`} className="text-foreground hover:text-primary">
                    {info.contact_phone}
                  </a>
                </li>
              )}
              {info.contact_email && (
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <a href={`mailto:${info.contact_email}`} className="break-all text-foreground hover:text-primary">
                    {info.contact_email}
                  </a>
                </li>
              )}
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-foreground">{hours}</span>
              </li>
            </ul>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full px-6">
                <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer">
                  Get directions <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              {info.whatsapp_number && (
                <Button variant="outline" asChild className="rounded-full px-6">
                  <a
                    href={`https://wa.me/${info.whatsapp_number}?text=${encodeURIComponent('Hello, I would like to book a school tour.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book a tour on WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </Reveal>

          <Reveal delay={100} className="min-h-[320px]">
            <div className="h-full overflow-hidden rounded-2xl border border-border shadow-sm">
              <iframe
                title={`Map showing ${info.name || 'iVintage College'}`}
                src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full min-h-[320px] w-full border-0"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};