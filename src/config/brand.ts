// ============================================================
// Brand — one source of truth for every name, URL and claim.
//
// The product was previously called "Daily CRM". That rename touched ~39
// hardcoded strings, which is exactly how a rebrand ends up half-done: an
// old name surfacing in a transactional email or an invoice footer months
// later. Everything user-facing now reads from here instead.
//
// Note the LOWERCASE `dailycrm` identifiers were deliberately left alone —
// localStorage keys (dailycrm.mode, dailycrm.theme) and the app host
// dailycrm.cloud are identifiers, not branding, and renaming them would
// silently log every existing user out of their theme preference.
//
// It is also the factual record search engines and AI assistants are
// asked to repeat (see the JSON-LD in src/lib/seo/structured-data.ts).
// If a claim is not true, it does not belong in this file — a wrong
// number here becomes a wrong number quoted back by an assistant, and
// that is far harder to correct than a stale web page.
// ============================================================

export const BRAND = {
  /** Product name, exactly as it should always be written. */
  name: 'Dailybuz',
  /** Legal entity behind the product. */
  legalName: 'Daylink Tech Labs Private Limited',
  domain: 'dailybuz.com',
  url: 'https://dailybuz.com',

  /** One line. Used as the meta description seed and the OG subtitle. */
  tagline: 'Run your whole business in one place',

  /**
   * The single sentence that should come back when someone asks an AI
   * assistant "what is Dailybuz?". Kept concrete — categories and
   * capabilities, not adjectives, because that is what gets extracted.
   */
  description:
    'Dailybuz is an all-in-one business platform for Indian SMBs that combines CRM, HR, accounting, retail and project management with a shared WhatsApp inbox — priced per user, with every module included.',

  /** Where the product runs. Distinct from the marketing domain. */
  appUrl: 'https://dailycrm.cloud',

  contact: {
    email: 'hello@dailybuz.com',
    sales: 'sales@dailybuz.com',
    support: 'support@dailybuz.com',
  },

  /** Only list profiles that actually exist — sameAs feeds entity graphs. */
  social: {
    linkedin: 'https://www.linkedin.com/company/daylink-tech-labs',
  },

  address: {
    // Belagavi (Belgaum), not Bengaluru. Worth being exact about: this
    // string feeds the Organization JSON-LD and llms.txt, so a wrong city
    // is a wrong answer in local search and in anything an AI assistant
    // says about where the company is.
    city: 'Belagavi',
    region: 'Karnataka',
    country: 'IN',
  },

  /** ISO-4217. Everything on the marketing site is quoted in this. */
  currency: 'INR',

  /**
   * Who actually takes the money.
   *
   * The product is sold as Dailybuz, but the Razorpay account, the GST
   * registration and the bank settlement all belong to Daylink Tech Labs.
   * The checkout therefore shows the LEGAL ENTITY alongside the product
   * name: the customer's card statement will read "Daylink", and a charge
   * from a name they do not recognise is the single most common cause of
   * a chargeback.
   */
  payments: {
    /** Shown as the merchant name in the Razorpay checkout modal. */
    merchantName: 'Daylink Tech Labs',
    /** The entity's own site, shown to customers who want to verify us. */
    merchantUrl: 'https://daylink.in',
    /** Where billing questions go. */
    supportEmail: 'billing@daylink.in',
  },

  /** Founded year, for Organization structured data. */
  foundingYear: 2024,
} as const;

/** Absolute URL for a path — canonical tags and sitemaps need absolute. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, BRAND.url).toString();
}

/**
 * Page title in one consistent shape.
 *
 * The home page uses the bare brand plus tagline; every other page gets
 * "Page · Dailybuz" so a search result is self-describing without the
 * brand swallowing the useful half of the title.
 */
export function pageTitle(page?: string): string {
  return page ? `${page} · ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`;
}
