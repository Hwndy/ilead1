import React from 'react';
import { Navigate, Routes, Route, useParams } from 'react-router-dom';
import { WebsiteLayout } from '@/components/website/WebsiteLayout';
import { ScrollToTop } from '@/components/website/ScrollToTop';
import { HomePage } from './HomePage';
import { AboutPage } from './AboutPage';
import { SchoolLifePage } from './SchoolLifePage';
import { AdmissionsPage } from './AdmissionsPage';
import { NewsPage } from './NewsPage';
import { FacilitiesPage } from './FacilitiesPage';
import { PortalsPage } from './PortalsPage';
import { TrackApplicationPage } from './TrackApplicationPage';
import { ApplyPage } from './ApplyPage';
import { AcceptOfferPage } from './AcceptOfferPage';
import { GalleryPage } from './GalleryPage';
import { TestimonialsPage } from './TestimonialsPage';
import { CareersPage } from './CareersPage';
import { NotFoundPage } from './NotFoundPage';

const OfferRedirect = () => {
  const { token = '' } = useParams();
  return <Navigate to={`/accept-offer/${encodeURIComponent(token)}`} replace />;
};

export const WebsiteRouter = () => {
  return (
    <WebsiteLayout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/school-life" element={<SchoolLifePage />} />
        <Route path="/admissions" element={<AdmissionsPage />} />
        <Route path="/admissions/apply" element={<ApplyPage />} />
        <Route path="/track-application" element={<TrackApplicationPage />} />
        <Route path="/accept-offer/:token" element={<OfferRedirect />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/testimonials" element={<TestimonialsPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/facilities" element={<FacilitiesPage />} />
        <Route path="/portals" element={<PortalsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </WebsiteLayout>
  );
};