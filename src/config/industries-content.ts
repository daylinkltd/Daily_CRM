import { Store, Briefcase, Truck, Scissors, type LucideIcon } from 'lucide-react';

// ============================================================
// Industry pages — GEO's favourite content.
//
// "CRM for a retail store in India" and "software to run my agency" are
// how real buyers phrase the problem, and how they phrase it to AI
// assistants. A generic feature list cannot answer those questions; a
// page that maps the modules onto ONE business's actual day can. Each
// entry below is written from the operator's point of view — their
// morning, their pain, which modules carry which part of it.
//
// Same honesty contract as the rest of the marketing config: nothing
// promised here that the product does not ship today. Roadmap items stay
// on /compare and the module pages, not here.
// ============================================================

export interface IndustryContent {
  slug: string;
  name: string;
  /** The buyer, in their own words. Used in titles and H1. */
  audience: string;
  icon: LucideIcon;
  summary: string;
  /** The operating pain, told concretely. */
  problem: string;
  /** How the day actually runs on Dailybuz. */
  day: { title: string; body: string }[];
  /** Modules that carry this vertical, in order of importance. */
  moduleSlugs: string[];
  faq: { question: string; answer: string }[];
}

export const INDUSTRIES: IndustryContent[] = [
  {
    slug: 'retail-stores',
    name: 'Retail & D2C stores',
    audience: 'shops, boutiques and D2C brands',
    icon: Store,
    summary:
      'POS billing, live inventory, WhatsApp reorders and books that write themselves — one system from the counter to the balance sheet.',
    problem:
      'The counter runs on one app, stock is counted on paper, customer numbers live in a personal phone, and the accountant reconstructs everything at month end. Every handoff between those is a place money quietly leaks.',
    day: [
      {
        title: 'Billing at the counter',
        body: 'Scan barcodes, take UPI or cash, print the GST invoice. The sale posts to the ledger and decrements stock the moment it happens — no end-of-day export, no sync.',
      },
      {
        title: 'Stock that matches the shelf',
        body: 'Multi-warehouse inventory with batches, purchase orders and goods receipt. When the audit count disagrees with the system, the stock audit workflow reconciles it with a paper trail.',
      },
      {
        title: 'Customers on WhatsApp',
        body: 'The number that bought from you is a contact with history. Broadcast a new arrival to past buyers, and answer replies from a shared inbox the whole shop can see.',
      },
      {
        title: 'Books your CA will accept',
        body: 'Double-entry ledgers, GST summaries and P&L come from the same rows the POS wrote. Khata tracking covers the customers who pay next week.',
      },
    ],
    moduleSlugs: ['retail', 'crm', 'accounting', 'hr'],
    faq: [
      {
        question: 'Can Dailybuz replace my billing software and khata app together?',
        answer:
          'Yes — that is the design. The POS raises GST invoices and takes payments, the khata ledger tracks customers who pay later, and both post into the same double-entry books, so there is no separate billing app to reconcile against.',
      },
      {
        question: 'Does it work for more than one shop?',
        answer:
          'Inventory supports multiple warehouses and stock transfers between them, and each shop can bill against its own stock. Branch-wise profit reporting is on the public roadmap.',
      },
    ],
  },
  {
    slug: 'agencies',
    name: 'Agencies & service firms',
    audience: 'marketing, design, IT and consulting teams',
    icon: Briefcase,
    summary:
      'Pipeline to proposal to project to invoice — with timesheets, a client portal and payroll in the same login your team already has open.',
    problem:
      'Leads live in a CRM, work lives in a project tool, hours live in a spreadsheet, and invoices live in an accounting app. Four subscriptions, and the answer to "was that project profitable?" still takes an afternoon.',
    day: [
      {
        title: 'Win the work',
        body: 'Pipelines with deals, quotations and a shared team inbox across WhatsApp, Instagram and email — the client conversation attaches to the deal, not to whoever answered.',
      },
      {
        title: 'Run the work',
        body: 'Kanban boards, sprints, epics and workload views. Timesheets record billable hours against the project as they happen, not in a Friday memory exercise.',
      },
      {
        title: 'Bill the work',
        body: 'Project invoices pull logged hours in. The invoice posts to receivables the moment it is raised, and the client sees status through their own portal.',
      },
      {
        title: 'Pay the team',
        body: 'Attendance, leave and payroll for the same people whose hours you just billed — the payroll cost posts to the P&L against the revenue it produced.',
      },
    ],
    moduleSlugs: ['projects', 'crm', 'accounting', 'hr'],
    faq: [
      {
        question: 'Can clients see their projects?',
        answer:
          'Yes. The client portal shows each client their own projects, tasks and invoices — nothing else — without a paid seat.',
      },
      {
        question: 'Do timesheet hours flow into invoices?',
        answer:
          'Yes. Hours are logged against tasks with billable flags, and project invoices are built from those logs, so billing disputes come with a line-by-line answer.',
      },
    ],
  },
  {
    slug: 'distributors',
    name: 'Distributors & wholesalers',
    audience: 'traders, stockists and B2B suppliers',
    icon: Truck,
    summary:
      'Party-wise khata, purchase-to-sale stock control, GST invoicing and receivables that chase themselves over WhatsApp.',
    problem:
      'A hundred parties, running balances in a physical khata, stock across a godown and a shop, and GST filing built from three different registers. The business runs on memory, and memory does not scale past one owner.',
    day: [
      {
        title: 'Party accounts that stay current',
        body: 'Every customer is a khata with a running balance. A sale increases it, a collection clears it, and both are ledger entries — the khata IS the books, not a copy of them.',
      },
      {
        title: 'Purchases and stock in one motion',
        body: 'Raise purchase orders, receive goods against them, and let inventory batches carry cost. Suppliers have balances too.',
      },
      {
        title: 'GST without the register-merging',
        body: 'Output and input tax accumulate from real invoices, ready for filing — CGST, SGST and IGST split by the buyer’s state automatically.',
      },
      {
        title: 'Collections over WhatsApp',
        body: 'Receivables show who owes what and for how long. Reminders go from the shared inbox, on the number the party actually answers.',
      },
    ],
    moduleSlugs: ['retail', 'accounting', 'crm'],
    faq: [
      {
        question: 'Does Dailybuz handle credit sales and partial payments?',
        answer:
          'Yes. Invoices carry an outstanding balance, payments can be partial, and the party’s khata reflects the running position after every transaction.',
      },
      {
        question: 'Can my accountant still use Tally?',
        answer:
          'Many customers hand their CA an export at year end and keep Tally for filing. Dailybuz keeps the operational books — sales, purchases, stock, receivables — in one live system during the year.',
      },
    ],
  },
  {
    slug: 'clinics-salons',
    name: 'Clinics, salons & local services',
    audience: 'clinics, salons, gyms and appointment-led businesses',
    icon: Scissors,
    summary:
      'WhatsApp bookings, customer history, staff attendance and daily billing — the front desk, the back office and the owner’s phone, unified.',
    problem:
      'Bookings arrive on WhatsApp, get copied to a diary, and die there. Staff hours are tracked by trust. The owner knows revenue by checking the cash drawer, and repeat customers are whoever the receptionist remembers.',
    day: [
      {
        title: 'The WhatsApp front desk',
        body: 'Booking messages land in a shared inbox with the customer’s full visit history attached. Broadcasts bring lapsed customers back without buying ads.',
      },
      {
        title: 'Billing at the desk',
        body: 'Services and retail products on one bill, UPI or cash, GST where it applies — posted straight into the books.',
      },
      {
        title: 'Staff without spreadsheets',
        body: 'GPS punch-in attendance, shift schedules, leave requests and payroll runs — commissions and advances handled as salary components.',
      },
      {
        title: 'The owner’s view',
        body: 'Daily takings, outstanding dues and staff costs on one dashboard, from anywhere — not from the cash drawer at closing time.',
      },
    ],
    moduleSlugs: ['crm', 'retail', 'hr', 'accounting'],
    faq: [
      {
        question: 'My whole business runs on WhatsApp. How does that work here?',
        answer:
          'Dailybuz connects your WhatsApp Business number to a shared inbox, so every staff member sees and answers from one place, every conversation is attached to the customer’s record, and broadcasts go out with templates — while you keep the same number your customers already have.',
      },
      {
        question: 'Is it overkill for a six-person salon?',
        answer:
          'The trial is the honest answer: every module is on, priced per seat, and a six-person team pays for six seats. Most salons start with the inbox and billing and grow into attendance and payroll in the second month.',
      },
    ],
  },
];

export function industryBySlug(slug: string): IndustryContent | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}
