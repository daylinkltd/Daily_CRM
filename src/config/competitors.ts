// ============================================================
// Competitor comparison data.
//
// HONEST, BUT NOT NEUTRAL. This is our page.
//
// Comparison pages are the most-linked and most-quoted pages a B2B site
// has, read by buyers actively evaluating the competitor, by the
// competitor, and by AI assistants that answer "X vs Y" directly. All
// three punish exaggeration, so nothing here is false and every rival
// keeps a `whereTheyWin` that is genuinely true.
//
// But an earlier version confused honesty with even-handedness. It gave
// each competitor three sentences of praise, ended Odoo's with "and we
// would say so", called Vyapar "excellent", and closed FAQ answers with
// "choose Zoho if…". A visitor reading it came away better sold on the
// alternatives than on us — which is not integrity, it is just bad
// writing on our own website.
//
// The rule now:
//   - OUR CASE GOES FIRST, and is the longer, more specific one. It is
//     rendered in the first column, which is what gets read.
//   - `whereTheyWin` states the competitor's real advantage in one
//     sentence. Accurate, not enthusiastic. No superlatives, no
//     recommendation to go and buy it.
//   - Where an advantage of theirs comes with a cost — an implementation
//     partner, a second system, a per-app bill — that cost is named,
//     because leaving it out would itself be the misleading version.
//
// PRICES ARE INDICATIVE AND DATED. Public list pricing as researched in
// August 2026, converted at roughly ₹83/USD where the vendor quotes USD.
// Anyone updating this must re-check the source, not adjust from memory —
// a stale price on a comparison page is the fastest way to lose trust.
// ============================================================

import { BUSINESS_PLAN } from './plans';

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
      'More breadth: 40+ apps including expense travel, e-signature and a BI suite that Dailybuz does not attempt.',
    whereWeDiffer:
      'Zoho One is forty products, not one. Each keeps its own data and they are joined by integrations you configure and then maintain — so a sale in CRM reaches Books when a sync says so, and reconciling the two is somebody\'s job. Dailybuz is a single database: the POS sale, the ledger entry and the customer record are the same rows, so there is nothing to sync and nothing to reconcile. At roughly a fifth of the per-user price.',
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
      'Deeper in manufacturing, MRP and field service, with a large module ecosystem for heavy customisation.',
    whereWeDiffer:
      'Odoo is powerful and almost never bought alone — the list price is the start, and a partner-led implementation is typically a project in its own right before anyone logs in, plus someone technical to keep it upgraded. Dailybuz is opinionated on purpose: you sign up, your team is working the same afternoon, and the price on the page is the price. WhatsApp is the primary channel rather than a module you add.',
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
      'Decades of statutory depth, and every accountant in India already knows it.',
    whereWeDiffer:
      'Tally does accounting and nothing else, on a desktop in your office. Customers, staff, stock and conversations live in other tools, and the joining-up is done by hand, by you, every month. Dailybuz keeps real double-entry books with the same GST outputs your CA expects — and keeps them alongside the sale that created the entry, in a browser, from anywhere. Your accountant can still have their export.',
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
      'A more mature CRM, with stronger telephony and a full support desk.',
    whereWeDiffer:
      'Freshworks sells and supports; it does not run a business. No ledger, no payroll, no stock, no POS — so you buy it and then buy the rest, and pay per user for each. Dailybuz covers the same pipelines and shared inbox and then keeps going into books, staff and stock, on one bill and one login.',
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
      'Deeper statutory payroll: PF and ESI challans, Form 16 and full-and-final settlement, which Dailybuz has on its roadmap rather than shipped.',
    whereWeDiffer:
      'Dailybuz already does the HR most SMBs actually run on every day: attendance with GPS punch-in, leave, payroll runs, payslips, documents and hiring. What it adds is everything around them — the payroll cost posts straight to the P&L instead of being re-keyed, and the same seat covers your customers and your books. An HR-only tool is a second subscription, a second login and a second export.',
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
      'Cheaper, and enough if all you will ever need is a GST invoice and a list of who owes you.',
    whereWeDiffer:
      'These are billing apps, not systems of record — no team inbox, no pipelines, no payroll, no real double-entry books, and no way for two people to work in them properly. The usual story is that they work until the fifth or sixth hire and then everything moves to spreadsheets. Dailybuz is built for the business you are about to be, and the migration you avoid is worth more than the monthly difference.',
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
  priceNote: `₹${BUSINESS_PLAN.pricePerSeatMonthly}/user/month, or ₹${BUSINESS_PLAN.pricePerSeatAnnual} billed annually`,
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
