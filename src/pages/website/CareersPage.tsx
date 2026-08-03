import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';
import { EmptyState } from '@/components/website/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Briefcase } from 'lucide-react';

export const CareersPage: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('job_openings')
      .select('*')
      .eq('is_open', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setJobs(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-0">
      <SEO
        title="Careers — iVintage College"
        description="Join our team. Explore teaching and support staff opportunities at iVintage College."
        path="/website/careers"
      />
      <PageHero
        eyebrow="Work with us"
        title="Careers at iVintage"
        subtitle="Passionate educators and dedicated staff make iVintage what it is. Explore current openings below."
        crumbs={[{ label: 'Careers' }]}
      />

      <div className="container mx-auto max-w-4xl px-4 py-16">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No open positions at the moment"
            description="New roles are posted here as soon as they open. In the meantime, you are welcome to send us a speculative application."
          >
            <Button asChild className="rounded-full px-6">
              <a href="mailto:careers@ilead1.lovable.app?subject=Speculative%20application">Email careers@ilead1.lovable.app</a>
            </Button>
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{job.title}</CardTitle>
                      <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground items-center">
                        {job.department && <Badge variant="outline">{job.department}</Badge>}
                        <Badge variant="secondary" className="capitalize">{job.employment_type.replace('_', ' ')}</Badge>
                        {job.location && <span>{job.location}</span>}
                      </div>
                    </div>
                    {job.closes_on && (
                      <span className="text-sm text-muted-foreground">
                        Closes {format(new Date(job.closes_on), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-line text-sm leading-relaxed">{job.description}</p>
                  {job.requirements && (
                    <div>
                      <h3 className="font-semibold mb-1">Requirements</h3>
                      <p className="whitespace-pre-line text-sm text-muted-foreground">{job.requirements}</p>
                    </div>
                  )}
                  <Button asChild>
                    <a href={`mailto:${job.apply_email}?subject=Application: ${encodeURIComponent(job.title)}`}>
                      Apply via Email
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CareersPage;