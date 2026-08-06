import type { MetadataRoute } from 'next';

import { BRAND, absoluteUrl } from '@/config/brand';
import { MODULES } from '@/config/modules-content';
import { COMPETITORS } from '@/config/competitors';
import { INDUSTRIES } from '@/config/industries-content';

/**
 * Generated from the same module registry the pages render, so a new
 * module cannot ship with a page that nothing links to and no crawler
 * finds. A hand-maintained sitemap always drifts.
 *
 * Only PUBLIC marketing routes belong here. The app itself sits behind
 * auth and is disallowed in robots.ts — listing it would spend crawl
 * budget on pages that only ever return a redirect.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // A fixed date rather than new Date(): a lastModified that changes on
  // every build tells crawlers everything changed every deploy, which
  // trains them to ignore the signal.
  const lastModified = new Date('2026-08-06');

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BRAND.url, lastModified, changeFrequency: 'weekly', priority: 1 },
    {
      url: absoluteUrl('/modules'),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/compare'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/pricing'),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/industries'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    { url: absoluteUrl('/faq'), lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: absoluteUrl('/about'), lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/contact'), lastModified, changeFrequency: 'yearly', priority: 0.6 },
    { url: absoluteUrl('/security'), lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/privacy'), lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/terms'), lastModified, changeFrequency: 'yearly', priority: 0.3 },
    {
      url: absoluteUrl('/refund-policy'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  const moduleRoutes: MetadataRoute.Sitemap = MODULES.map((m) => ({
    url: absoluteUrl(`/modules/${m.slug}`),
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  // Per-competitor pages: "X alternative" queries have a buyer attached,
  // and each page's title/H1/FAQ speak about exactly one rival.
  const competitorRoutes: MetadataRoute.Sitemap = COMPETITORS.map((c) => ({
    url: absoluteUrl(`/compare/${c.slug}`),
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const industryRoutes: MetadataRoute.Sitemap = INDUSTRIES.map((i) => ({
    url: absoluteUrl(`/industries/${i.slug}`),
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...moduleRoutes, ...competitorRoutes, ...industryRoutes];
}
