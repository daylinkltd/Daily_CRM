// ============================================================
// JSON-LD structured data.
//
// WHY THIS FILE CARRIES WEIGHT BEYOND CLASSIC SEO
//
// Search engines use this for rich results. Generative engines — the
// assistants people now ask "what's a good all-in-one CRM for an Indian
// SMB?" — use it differently: they need to resolve the page to an ENTITY
// with unambiguous attributes (what it is, who makes it, what it costs,
// what it does) and they strongly prefer facts they can attribute.
//
// Three rules follow from that, and they are the reason this file exists
// rather than JSON-LD being sprinkled inline:
//
//   1. ONE SOURCE. Price, name and capability lists come from
//      src/config/brand.ts and src/config/modules-content.ts — the same
//      constants the visible page renders. Structured data that disagrees
//      with the visible page is treated as spam by search engines and
//      quoted wrongly by assistants.
//   2. NO CLAIM WITHOUT A BASIS. No aggregateRating, no review markup,
//      no invented counts. Fabricated ratings are a manual-action risk
//      with Google and, worse, get repeated as fact.
//   3. ANSWER THE ACTUAL QUESTION. FAQPage entries are written as the
//      questions buyers really ask, with answers short enough to be
//      lifted verbatim. That is the unit an assistant quotes.
// ============================================================

import { BRAND, absoluteUrl } from '@/config/brand';
import { MODULES, allCapabilities } from '@/config/modules-content';
import { BUSINESS_PLAN } from '@/config/plans';

type Json = Record<string, unknown>;

/** Stable @id so every graph node points at the same organisation. */
const ORG_ID = `${BRAND.url}/#organization`;
const SITE_ID = `${BRAND.url}/#website`;
const APP_ID = `${BRAND.url}/#software`;

export function organizationSchema(): Json {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: BRAND.url,
    description: BRAND.description,
    foundingDate: String(BRAND.foundingYear),
    address: {
      '@type': 'PostalAddress',
      addressLocality: BRAND.address.city,
      addressRegion: BRAND.address.region,
      addressCountry: BRAND.address.country,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: BRAND.contact.sales,
        areaServed: 'IN',
        availableLanguage: ['en', 'hi'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: BRAND.contact.support,
        areaServed: 'IN',
        availableLanguage: ['en', 'hi'],
      },
    ],
    sameAs: Object.values(BRAND.social),
  };
}

export function websiteSchema(): Json {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: BRAND.url,
    name: BRAND.name,
    description: BRAND.description,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-IN',
  };
}

/**
 * The product itself.
 *
 * `offers` carries the real per-seat price so an assistant asked "how
 * much is Dailybuz?" has a number to quote instead of guessing from
 * scraped copy. UnitPriceSpecification with referenceQuantity is how you
 * say "per user, per month" in a way that parses.
 */
export function softwareApplicationSchema(): Json {
  return {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: BRAND.name,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'CRM, ERP, HR and Accounting software',
    operatingSystem: 'Web browser',
    url: BRAND.url,
    description: BRAND.description,
    publisher: { '@id': ORG_ID },
    featureList: allCapabilities(),
    offers: {
      '@type': 'Offer',
      category: 'SaaS subscription',
      price: BUSINESS_PLAN.pricePerSeatMonthly,
      priceCurrency: BRAND.currency,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: BUSINESS_PLAN.pricePerSeatMonthly,
        priceCurrency: BRAND.currency,
        unitText: 'user per month',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: 1,
          unitCode: 'C62', // UN/CEFACT: "one" — i.e. one user
        },
      },
      availability: 'https://schema.org/InStock',
      url: absoluteUrl('/pricing'),
    },
    // Deliberately no aggregateRating: we have no verified review corpus,
    // and inventing one is both a policy violation and a lie an assistant
    // would repeat.
  };
}

/** One node per module, so "does it do payroll?" resolves cleanly. */
export function moduleSchemas(): Json[] {
  return MODULES.map((m) => ({
    '@type': 'SoftwareApplication',
    '@id': `${BRAND.url}/modules/${m.slug}#software`,
    name: `${BRAND.name} ${m.name}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    url: absoluteUrl(`/modules/${m.slug}`),
    description: m.summary,
    publisher: { '@id': ORG_ID },
    // Shipped capabilities only — roadmap items are excluded on purpose.
    featureList: m.capabilities,
    isPartOf: { '@id': APP_ID },
  }));
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export function faqSchema(entries: FaqEntry[]): Json {
  return {
    '@type': 'FAQPage',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    })),
  };
}

export function breadcrumbSchema(
  trail: { name: string; path: string }[],
): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Wrap nodes in a single @graph.
 *
 * One graph per page rather than several script tags: it lets nodes
 * cross-reference by @id (the app points at its publisher, breadcrumbs
 * point at the page) instead of repeating the organisation three times
 * and risking the copies disagreeing.
 */
export function jsonLdGraph(nodes: Json[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}
