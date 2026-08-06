import type { ReactNode } from "react";

import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { absoluteUrl } from "@/config/brand";
import {
  jsonLdGraph,
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
} from "@/lib/seo/structured-data";

/**
 * Shell for every public marketing page.
 *
 * The `.marketing` class is what switches the neutral ramp and the squared
 * radii (src/styles/marketing.css). It is applied here rather than per
 * page so a new page cannot forget it and render app-coloured.
 *
 * The Organization / WebSite / SoftwareApplication graph is emitted once
 * for the whole section instead of per page: those three nodes are
 * identical everywhere, and repeating them risks copies that disagree.
 * Page-specific nodes (breadcrumbs, FAQ, per-module) are added by the
 * pages themselves and reference these by @id.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  const graph = jsonLdGraph([
    organizationSchema(),
    websiteSchema(),
    softwareApplicationSchema(),
  ]);

  return (
    <div className="marketing min-h-screen bg-[var(--mkt-canvas)] text-[var(--mkt-fg)]">
      <script
        type="application/ld+json"
        // Serialised from typed objects we construct, never from user
        // input, so there is no injection surface here.
        dangerouslySetInnerHTML={{ __html: graph }}
      />
      {/* Share image, hoisted to <head> by React rather than declared in
          metadata. Next's metadata merging dropped og:image on some
          routes when pages defined their own openGraph objects, and a
          share card that exists on most pages is indistinguishable from
          one that exists on none when the missing page is the one that
          gets shared. Scrapers take the first og:image; the pages where
          metadata also emits one just repeat the same URL. */}
      <meta property="og:image" content={absoluteUrl("/opengraph-image.png")} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={absoluteUrl("/opengraph-image.png")} />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
