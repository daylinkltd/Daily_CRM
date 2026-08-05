import type { MetadataRoute } from 'next';

import { BRAND, absoluteUrl } from '@/config/brand';
import { MODULES } from '@/config/modules-content';

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
      url: absoluteUrl('/pricing'),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  const moduleRoutes: MetadataRoute.Sitemap = MODULES.map((m) => ({
    url: absoluteUrl(`/modules/${m.slug}`),
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...moduleRoutes];
}
