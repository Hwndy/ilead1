import React from 'react';
import { Helmet } from 'react-helmet-async';

export const SITE_URL = 'https://ilead1.lovable.app';

interface SEOProps {
  title: string;
  description: string;
  path: string; // e.g. "/website/about"
  image?: string;
  type?: 'website' | 'article';
  jsonLd?: Record<string, any> | Record<string, any>[];
  noindex?: boolean;
}

export const SEO: React.FC<SEOProps> = ({ title, description, path, image, type = 'website', jsonLd, noindex }) => {
  const url = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const img = image || `${SITE_URL}/ivintage_logo.png`;
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={img} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
};

export default SEO;