import React, { useState } from 'react';
import { Mail, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWebsiteSettings, settingValue } from '@/hooks/useCms';

export const Newsletter: React.FC = () => {
  const { settings } = useWebsiteSettings();
  const enabled = settingValue<boolean>(settings, 'newsletter_enabled', true);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  if (!enabled) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <section className="relative overflow-hidden bg-steel py-16 text-primary-foreground">
      <div className="site-container relative">
        <div className="max-w-3xl mx-auto text-center space-y-6">
           <div className="inline-flex h-14 w-14 items-center justify-center border border-gold/40 bg-gold/15">
            <Mail className="h-6 w-6 text-gold" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold">
            Stay close to the iVintage community
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            Termly newsletters with academic highlights, upcoming events and admission deadlines 
            delivered to your inbox.
          </p>

          {submitted ? (
             <div className="inline-flex items-center gap-2 border border-gold/40 bg-gold/15 px-6 py-3">
              <CheckCircle2 className="h-5 w-5 text-gold" />
              <span className="font-medium">Thank you  you\u2019re subscribed.</span>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto pt-2"
            >
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-gold h-12"
              />
              <Button
                type="submit"
                size="lg"
                className="bg-gold text-gold-foreground hover:bg-gold/90 font-semibold shadow-lg"
              >
                Subscribe
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};