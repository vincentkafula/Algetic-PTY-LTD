import type { MetadataRoute } from 'next';

// ---------------------------------------------------------------------------
// Deliberately excludes /blog, /blog-details, /project, /project-details,
// /service-details — these still hold the original template's placeholder
// content (fake post titles, stock categories), not linked from the nav,
// and submitting them for search engine indexing would actively hurt SEO
// quality rather than help it. Add them back here once they have real
// content, not before.
// ---------------------------------------------------------------------------

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.altegic.co.za';
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/service`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/business-registration`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/domains`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/team`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.7 },
  ];
}
