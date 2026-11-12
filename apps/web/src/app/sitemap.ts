import type { MetadataRoute } from 'next';

const BASE = 'https://www.moffu.pro';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/feature`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/faq`,     lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/about`,   lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/team`,    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blog`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${BASE}/help`,    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/refund`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/cookies`, lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/gdpr`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];

  return staticRoutes;
}
