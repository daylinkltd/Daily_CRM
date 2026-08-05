// ============================================================
// Module content for the marketing site.
//
// EVERY CAPABILITY LISTED HERE EXISTS. The bullets were written against
// src/lib/auth/resources.ts (the RBAC catalog that drives the real
// permission matrix and the generated RLS policies) and the routes under
// src/app/(dashboard), not from a wishlist.
//
// That matters more than usual now: this content is fed to search engines
// AND to AI assistants as structured data. An invented feature does not
// just disappoint a visitor who signs up — it gets repeated confidently
// by an assistant to people who never visit the site at all, and there is
// no erratum for that. If something is planned but not shipped, it goes
// in `roadmap`, which is rendered as "coming soon" and excluded from the
// structured-data feature list.
// ============================================================

import {
  MessageSquare,
  Users,
  Landmark,
  Store,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';

export interface ModuleFeature {
  title: string;
  body: string;
}

export interface ModuleContent {
  /** URL slug under /modules. */
  slug: string;
  name: string;
  /** Matches ModuleKey in src/lib/auth/modules.ts. */
  moduleKey: 'crm' | 'hr' | 'accounting' | 'retail' | 'projects';
  icon: LucideIcon;
  /** One sentence. Doubles as the meta description for the module page. */
  summary: string;
  /** The job this module does, in the customer's words. */
  problem: string;
  features: ModuleFeature[];
  /** Short capability names — used in structured data and comparison lists. */
  capabilities: string[];
  /** Honest about what is not built yet. Never shown as shipped. */
  roadmap?: string[];
}

export const MODULES: ModuleContent[] = [
  {
    slug: 'crm',
    name: 'CRM & Shared Inbox',
    moduleKey: 'crm',
    icon: MessageSquare,
    summary:
      'One shared inbox for WhatsApp, Instagram, Messenger and email, with contacts, pipelines, quotations and invoices attached to every conversation.',
    problem:
      'Customer messages arrive on four channels and live on one person’s phone. Nobody else can see the history, and when that person is away the thread goes cold.',
    features: [
      {
        title: 'Shared team inbox',
        body: 'WhatsApp, Instagram, Messenger and email land in one place. Assign a conversation to a colleague and the whole history goes with it.',
      },
      {
        title: 'Contacts that stay clean',
        body: 'Numbers are matched on digits, so +91 99023 19132 and 919902319132 resolve to the same person instead of creating a duplicate.',
      },
      {
        title: 'Pipelines and deals',
        body: 'Drag deals between stages on a board, or switch to a sortable list when you want to see value, close date and owner at once.',
      },
      {
        title: 'Quotations and invoices',
        body: 'Build a quotation from your catalogue, convert it to an invoice, and record the payment — all against the same contact.',
      },
      {
        title: 'Automations and broadcasts',
        body: 'Trigger follow-ups from a reply, a stage change or a form submission. Send approved WhatsApp templates to a segment.',
      },
      {
        title: 'Forms',
        body: 'Publish a form, and every submission creates or updates a contact and can start an automation.',
      },
    ],
    capabilities: [
      'Shared WhatsApp inbox',
      'Instagram and Messenger inbox',
      'Contact management',
      'Sales pipelines',
      'Quotations',
      'Invoicing',
      'Marketing automation',
      'WhatsApp broadcasts',
      'Web forms',
    ],
  },
  {
    slug: 'hr',
    name: 'HR & Payroll',
    moduleKey: 'hr',
    icon: Users,
    summary:
      'Attendance with GPS punch-in, leave, payroll, documents, policies and recruitment — with an employee view that only shows people what they need.',
    problem:
      'Attendance is on paper, leave is over WhatsApp, and payslips are built in a spreadsheet each month. Nothing reconciles.',
    features: [
      {
        title: 'Attendance and punch-in',
        body: 'Staff punch in and out from any device, with optional GPS and geofencing. HR can log or correct a record by hand, and the hours recalculate from the punch times.',
      },
      {
        title: 'Leave and requests',
        body: 'Employees submit leave and attendance corrections; everything lands with HR to approve. Staff see a submit form, not a status board.',
      },
      {
        title: 'Payroll',
        body: 'Salary structures compute earnings and statutory deductions. Run a cycle, generate payslips, and post the expense straight to the ledger.',
      },
      {
        title: 'Documents and letters',
        body: 'Issue offer letters, confirmations and certificates from templates with your letterhead and signatory. Employees see their own copies.',
      },
      {
        title: 'Policies and handbook',
        body: 'Publish policies with versions and mandatory sign-off, and see who has acknowledged which version.',
      },
      {
        title: 'Recruitment',
        body: 'Track candidates through a hiring pipeline you can drag in either direction, as a board or a list.',
      },
    ],
    capabilities: [
      'Attendance tracking',
      'GPS punch-in and geofencing',
      'Leave management',
      'Payroll processing',
      'Payslip generation',
      'Employee documents',
      'HR policy management',
      'Applicant tracking',
      'Timesheets',
    ],
    roadmap: [
      'Shift-based late-arrival scoring',
      'Automatic unpaid-leave deduction in payroll',
    ],
  },
  {
    slug: 'accounting',
    name: 'Accounting',
    moduleKey: 'accounting',
    icon: Landmark,
    summary:
      'Double-entry books that balance by construction — ledgers, day book, trial balance, P&L, balance sheet and GST reports.',
    problem:
      'Sales sit in one tool, expenses in another, and the books are reconstructed by your accountant at the end of the quarter.',
    features: [
      {
        title: 'Real double-entry',
        body: 'Every money event posts through one engine, and a database trigger rejects an unbalanced entry at commit. The books cannot silently drift.',
      },
      {
        title: 'Statements that build themselves',
        body: 'Trial balance, profit and loss, and balance sheet come from the same journal your invoices and payroll already write to.',
      },
      {
        title: 'GST reports',
        body: 'Output and input tax summarised from real transactions, ready for filing.',
      },
      {
        title: 'Receivables and khata',
        body: 'See who owes what, with the running account per customer.',
      },
      {
        title: 'Chart of accounts',
        body: 'Ledgers grouped the way your accountant expects, with manual journal entries when you need them.',
      },
    ],
    capabilities: [
      'Double-entry bookkeeping',
      'Chart of accounts',
      'Trial balance',
      'Profit and loss statement',
      'Balance sheet',
      'GST reporting',
      'Accounts receivable',
      'Journal entries',
    ],
    roadmap: ['Payroll statutory dues posted as separate liabilities'],
  },
  {
    slug: 'retail',
    name: 'Retail & POS',
    moduleKey: 'retail',
    icon: Store,
    summary:
      'Point of sale, products with barcodes and variants, multi-warehouse inventory, purchasing and supplier management.',
    problem:
      'The billing counter does not know what is in the warehouse, and stock is counted once a month with a clipboard.',
    features: [
      {
        title: 'Point of sale',
        body: 'Fast counter billing with barcode scanning, held bills and cash register sessions.',
      },
      {
        title: 'Products and pricing',
        body: 'Variants, batches, multiple barcodes, HSN codes and per-channel price lists.',
      },
      {
        title: 'Inventory across locations',
        body: 'Stock by warehouse, transfers between them, and audits that record the variance.',
      },
      {
        title: 'Purchasing',
        body: 'Raise purchase orders, receive goods against them, and keep supplier balances.',
      },
      {
        title: 'Sales flow into the books',
        body: 'A POS sale posts to the ledger as it happens — no end-of-day export.',
      },
    ],
    capabilities: [
      'Point of sale',
      'Barcode scanning',
      'Inventory management',
      'Multi-warehouse stock',
      'Purchase orders',
      'Supplier management',
      'Price lists',
      'Stock audits',
    ],
  },
  {
    slug: 'projects',
    name: 'Projects & Tasks',
    moduleKey: 'projects',
    icon: Briefcase,
    summary:
      'Boards, sprints, epics and timesheets, with billable time that turns into a project invoice.',
    problem:
      'Client work is tracked in a spreadsheet, hours are remembered at invoicing time, and nobody knows what anyone is working on.',
    features: [
      {
        title: 'Boards and lists',
        body: 'Tasks on a drag-and-drop board with custom statuses, or as a list when you need to scan everything at once.',
      },
      {
        title: 'Sprints and epics',
        body: 'Group work into sprints and epics, with a timeline view of what lands when.',
      },
      {
        title: 'Timesheets',
        body: 'Log time against tasks, optionally required at punch-out, with templates that decide what gets asked.',
      },
      {
        title: 'Billable time to invoice',
        body: 'Turn approved billable hours into a project invoice without re-keying anything.',
      },
      {
        title: 'Client portal',
        body: 'Share a read-only board or timeline with a client over a private link.',
      },
    ],
    capabilities: [
      'Kanban task boards',
      'Sprint planning',
      'Epics',
      'Timesheets',
      'Billable time tracking',
      'Project invoicing',
      'Client portal',
      'Workload view',
    ],
  },
];

/** Shared line explaining the all-inclusive model. Used on the home page. */
export const INCLUDED_MODULES_NOTE =
  'Most suites sell you CRM, then charge again for HR, then put reporting behind an enterprise tier. Every module below is in every seat, at the same price, from day one.';

export function moduleBySlug(slug: string): ModuleContent | undefined {
  return MODULES.find((m) => m.slug === slug);
}

/** Every shipped capability across every module — for structured data. */
export function allCapabilities(): string[] {
  return MODULES.flatMap((m) => m.capabilities);
}
