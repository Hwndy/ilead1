import React from 'react';
import { AdmissionForm } from '@/components/website/AdmissionForm';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SEO } from '@/components/website/SEO';
import { PageHero } from '@/components/website/PageHero';

export const ApplyPage = () => {
  return (
    <div className="min-h-screen bg-muted/55">
      <SEO
        title="Apply Online  iVintage College Admissions"
        description="Start your child's iVintage journey. Complete the online admission form to apply for nursery, primary or secondary school placement."
        path="/website/admissions/apply"
      />
      <PageHero
        eyebrow="Admission Application"
        title="Apply to iVintage College"
        subtitle="Complete the form to begin your child's admission journey. Fields marked with an asterisk are required."
        crumbs={[{ label: 'Admissions', href: '/website/admissions' }, { label: 'Apply' }]}
      />
      <div className="site-container py-10 sm:py-14">
        <div className="mx-auto max-w-5xl">

          {/* Important Notice */}
          <Alert className="mb-6 border-l-4 border-l-gold bg-background sm:mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Please ensure all information provided is accurate. You will receive an application number upon successful submission, 
              which you can use to track your application status.
            </AlertDescription>
          </Alert>

          {/* Admission Form (provides its own card shell) */}
          <AdmissionForm />

          {/* Help Text */}
          <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-muted-foreground px-2">
            <p>
              Need help? Contact our admissions office at{' '}
              <a href="mailto:ivintagecollege@gmail.com" className="text-primary hover:underline break-all">
                ivintagecollege@gmail.com
              </a>
              {' '}or call{' '}
              <a href="tel:+2348134197710" className="text-primary hover:underline whitespace-nowrap">
                +234 813 419 7710
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
