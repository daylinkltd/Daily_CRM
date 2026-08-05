// ============================================================
// Competitor comparison data.
//
// HONESTY IS THE STRATEGY HERE, not a constraint on it.
//
// Comparison pages are the most-linked and most-quoted pages a B2B site
// has, and they are read by three audiences who all punish exaggeration:
// buyers who are actively evaluating the competitor, the competitor
// themselves, and AI assistants that increasingly answer "X vs Y"
// directly. A page claiming Dailybuz beats Odoo on manufacturing depth
// would be trivially falsifiable and would cost more credibility than the
// win is worth.
//
// So every entry carries a `whereTheyWin` that is real, and the pitch is
// positional rather than absolute: Dailybuz is cheaper, simpler and
// India-first; the incumbents are deeper and more configurable. Both are
// true, and buyers who need depth should go and buy depth.
//
// PRICES ARE INDICATIVE AND DATED. Public list pricing as researched in
// August 2026, converted at roughly ₹83/USD where the vendor quotes USD.
// Anyone updating this must re-check the source, not adjust from memory —
// a stale price on a comparison page is the fastest way to lose trust.
// ============================================================

export interface Competitor {
  slug: string;
  name: string;
  /** What they actually are, in one line. */
  category: string;
  /** Indicative list price, already in rupees-per-user-per-month terms. */
  priceNote: string;
  /** The honest case for choosing them instead. */
  whereTheyWin: string;
  /** The gap Dailybuz fills, stated without hyperbole. */
  whereWeDiffer: string;
  /** Coverage of the five things Dailybuz does, as shipped by them. */
  coverage: {
    crm: Coverage;
    hr: Coverage;
    accounting: Coverage;
    retail: Coverage;
    projects: Coverage;
    whatsapp: Coverage;
  };
}

/** `partial` is used honestly — it means "has it, but not comparably". */
export type Coverage = 'full' | 'partial' | 'addon' | 'none';

export const COVERAGE_LABEL: Record<Coverage, string> = {
  full: 'Included',
  partial: 'Limited',
  addon: 'Costs extra',
  none: 'Not offered',
};

export const COMPETITORS: Competitor[] = [
  {
    slug: 'zoho-one',
    name: 'Zoho One',
    category: 'Bundle of 40+ separate applications',
    priceNote: '≈ ₹3,700/user/month (US$45) on the all-employee plan',
    whereTheyWin:
      'Enormous breadth — 40+ apps covering things Dailybuz does not attempt, like expense travel, e-signature and a full BI suite. Mature marketplace and a large partner network in India.',
    whereWeDiffer:
      'Zoho One is a bundle of separate products that each keep their own data and are joined by integrations. Dailybuz is one database, so a POS sale posts to the ledger without a sync step — and costs roughly a fifth as much per user.',
    coverage: {
      crm: 'full',
      hr: 'full',
      accounting: 'full',
      retail: 'partial',
      projects: 'full',
      whatsapp: 'partial',
    },
  },
  {
    slug: 'odoo',
    name: 'Odoo',
    category: 'Open-source ERP, unified database',
    priceNote: '≈ ₹2,100–2,600/user/month (US$25–31) Standard, plus implementation',
    whereTheyWin:
      'Genuinely deeper. Manufacturing, MRP, field service, ecommerce and a huge module ecosystem, all on one database. If you need production planning or heavy customisation, Odoo is the better tool and we would say so.',
    whereWeDiffer:
      'Odoo generally needs a partner to implement and someone to maintain it. Dailybuz is opinionated and ready on signup, WhatsApp-first, and priced without an implementation project attached.',
    coverage: {
      crm: 'full',
      hr: 'full',
      accounting: 'full',
      retail: 'full',
      projects: 'full',
      whatsapp: 'addon',
    },
  },
  {
    slug: 'tally',
    name: 'TallyPrime + a separate CRM',
    category: 'The Indian status quo — desktop accounting plus something else',
    priceNote: '≈ ₹18,000 one-time per licence, plus whatever CRM you add',
    whereTheyWin:
      'Every accountant in India already knows Tally. Statutory compliance is battle-tested over decades, and your CA will not ask you to explain it.',
    whereWeDiffer:
      'Tally is accounting only and desktop-first, so sales, staff and stock live somewhere else and are reconciled by hand. Dailybuz keeps them in one place, in the browser, with the same GST outputs.',
    coverage: {
      crm: 'none',
      hr: 'partial',
      accounting: 'full',
      retail: 'partial',
      projects: 'none',
      whatsapp: 'none',
    },
  },
  {
    slug: 'freshworks',
    name: 'Freshsales / Freshworks',
    category: 'CRM and support suite',
    priceNote: '≈ ₹1,000–4,000/user/month depending on tier',
    whereTheyWin:
      'A polished, well-supported CRM with strong telephony and support-desk tooling, built in India with local sales coverage.',
    whereWeDiffer:
      'Freshworks is a sales and support product. It has no payroll, no ledger and no POS, so books and staff still need separate tools. Dailybuz includes them at one price.',
    coverage: {
      crm: 'full',
      hr: 'none',
      accounting: 'none',
      retail: 'none',
      projects: 'partial',
      whatsapp: 'addon',
    },
  },
  {
    slug: 'keka-greythr',
    name: 'Keka / greytHR',
    category: 'HR and payroll platforms',
    priceNote: '≈ ₹100–200/employee/month, typically with a monthly minimum',
    whereTheyWin:
      'Deeper HR than Dailybuz: statutory filings, Form 16, full-and-final settlement and compliance workflows refined over years. If payroll compliance is your main pain, start there.',
    whereWeDiffer:
      'They are HR-only, so customers, invoices and stock live elsewhere. Dailybuz covers HR alongside the rest — and is honest that its payroll is younger.',
    coverage: {
      crm: 'none',
      hr: 'full',
      accounting: 'partial',
      retail: 'none',
      projects: 'none',
      whatsapp: 'none',
    },
  },
  {
    slug: 'vyapar',
    name: 'Vyapar / Khatabook',
    category: 'Billing and khata apps for very small businesses',
    priceNote: '≈ ₹300–800/month per device or business',
    whereTheyWin:
      'Cheapest way to raise a GST invoice and track who owes you money. Excellent on mobile and genuinely easy for a one-person business.',
    whereWeDiffer:
      'They are billing tools, not systems of record — no team inbox, no pipelines, no payroll, no double-entry books. Businesses usually outgrow them at around five to ten people, which is where Dailybuz starts.',
    coverage: {
      crm: 'none',
      hr: 'none',
      accounting: 'partial',
      retail: 'partial',
      projects: 'none',
      whatsapp: 'partial',
    },
  },
];

/** Dailybuz's own row, so the table has a like-for-like first column. */
export const OURS = {
  name: 'Dailybuz',
  priceNote: '₹799/user/month, or ₹639 billed annually',
  coverage: {
    crm: 'full',
    hr: 'full',
    accounting: 'full',
    retail: 'full',
    projects: 'full',
    whatsapp: 'full',
  } satisfies Record<string, Coverage>,
};

export const COVERAGE_ROWS = [
  { key: 'crm', label: 'CRM & pipelines' },
  { key: 'whatsapp', label: 'Shared WhatsApp inbox' },
  { key: 'hr', label: 'HR & payroll' },
  { key: 'accounting', label: 'Double-entry accounting & GST' },
  { key: 'retail', label: 'Retail POS & inventory' },
  { key: 'projects', label: 'Projects & timesheets' },
] as const;

/** When Dailybuz is the wrong answer. Stated plainly, on the page. */
export const NOT_FOR_YOU = [
  'You need manufacturing or production planning — look at Odoo.',
  'Payroll compliance is your single biggest problem — Keka or greytHR go deeper.',
  'You are one person raising a few invoices a month — Vyapar is cheaper and enough.',
  'You operate outside India — GST and INR-first pricing are built in, not bolted on.',
];
