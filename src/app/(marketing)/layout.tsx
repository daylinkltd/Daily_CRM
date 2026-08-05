import type { ReactNode } from "react";

import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
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
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
