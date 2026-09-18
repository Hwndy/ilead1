import React from 'react';
import { ApplicationTracker } from '@/components/website/ApplicationTracker';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';

export const TrackApplicationPage = () => {
  return (
    <div className="space-y-0">
      <SEO
        title="Track Application — iVintage College"
        description="Check the current status of an iVintage College admission application."
        path="/website/track-application"
      />
      <PageHero
        eyebrow="Admissions"
        title="Track your application"
        subtitle="Use your application number and email address to see the latest admission status."
        crumbs={[{ label: 'Track Application' }]}
      />
      <section className="bg-muted/55 py-12 sm:py-16">
        <ApplicationTracker />
      </section>
    </div>
  );
};