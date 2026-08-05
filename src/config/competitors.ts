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

import { BUSINESS_PLAN, SOLO_PLAN } from './plans';

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
      `They are billing tools, not systems of record — no team inbox, no pipelines, no payroll, no double-entry books. Dailybuz Solo is ₹${SOLO_PLAN.pricePerSeatMonthly}/month for a single user with all of that included, so you are not choosing between price and a system that survives your next five hires.`,
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
  // Derived, never typed twice — a comparison page with a stale own-price
  // is worse than one with a stale competitor price.
  priceNote: `₹${SOLO_PLAN.pricePerSeatMonthly}/month solo, ₹${BUSINESS_PLAN.pricePerSeatMonthly}/user/month for teams`,
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

/**
 * What is not built yet, stated as roadmap rather than as a reason to buy
 * a competitor.
 *
 * The page used to carry a "when Dailybuz is the wrong choice" list that
 * ended each line by naming a rival to go and buy. That was more
 * self-defeating than honest — a prospect does not need to be handed a
 * competitor's name on our own site.
 *
 * But the underlying facts have not changed, so they are not deleted:
 * there is genuinely no manufacturing module, no statutory payroll filing,
 * and no multi-currency ledger today. Saying so as a roadmap is truthful
 * AND commercially sane. Claiming otherwise would put false statements on
 * a page that AI assistants quote, which is a slower and worse problem
 * than losing a deal we were going to lose anyway.
 *
 * REMOVE AN ITEM FROM HERE ONLY WHEN IT SHIPS. Not when it is started.
 */
export interface RoadmapItem {
  title: string;
  detail: string;
  /** Rough sequencing, so the page does not read as vapourware. */
  horizon: 'building' | 'next' | 'later';
}

export const ROADMAP: RoadmapItem[] = [
  {
    title: 'E-invoicing (IRN) and e-way bills',
    detail:
      'Direct IRN generation against the GST portal, and e-way bills for goods movement. Mandatory for businesses above the turnover threshold, so this leads the queue.',
    horizon: 'building',
  },
  {
    title: 'Bank reconciliation',
    detail:
      'Import a statement and match it against the ledger, so the books close without a spreadsheet.',
    horizon: 'building',
  },
  {
    title: 'Credit and debit notes',
    detail:
      'Sales returns and adjustments as first-class documents that flow into the GST return.',
    horizon: 'next',
  },
  {
    title: 'Recurring invoices',
    detail: 'Retainers and subscriptions billed on a schedule without re-keying.',
    horizon: 'next',
  },
  {
    title: 'Deeper payroll compliance',
    detail:
      'PF and ESI challans, Form 16, and full-and-final settlement. Today Dailybuz computes and posts payroll; the statutory filing paperwork is not generated for you.',
    horizon: 'next',
  },
  {
    title: 'Two-factor authentication',
    detail: 'TOTP on login, for workspaces holding payroll and banking data.',
    horizon: 'next',
  },
  {
    title: 'Multi-currency',
    detail:
      'Invoicing and books in more than one currency, with exchange differences posted properly. Dailybuz is INR-first today.',
    horizon: 'later',
  },
  {
    title: 'Manufacturing and production planning',
    detail:
      'Bills of materials, work orders and material planning. Not started — if production planning is your core need today, Dailybuz is not yet that tool.',
    horizon: 'later',
  },
];

export const HORIZON_LABEL: Record<RoadmapItem['horizon'], string> = {
  building: 'In progress',
  next: 'Next',
  later: 'Planned',
};
