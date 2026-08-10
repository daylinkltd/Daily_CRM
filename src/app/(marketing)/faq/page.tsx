import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { BUSINESS_PLAN, GST_RATE } from "@/config/plans";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, breadcrumbSchema, faqSchema, type FaqEntry } from "@/lib/seo/structured-data";

const DESCRIPTION = `Every common question about ${BRAND.name} answered plainly: pricing and GST, the free trial, seats, WhatsApp, data ownership, security and cancellation.`;

export const metadata: Metadata = {
  title: { absolute: pageTitle("FAQ") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/faq") },
  openGraph: {
    images: OG_IMAGES,
    title: pageTitle("FAQ"),
    description: DESCRIPTION,
    url: absoluteUrl("/faq"),
    type: "website",
  },
};

/**
 * One page holding every question we actually get, grouped, with the
 * whole set published as FAQPage schema.
 *
 * This page is written to be QUOTED — by AI assistants asked "does
 * Dailybiz do X?" as much as by buyers. Every answer stands alone
 * (assistants extract one at a time), states numbers exactly, and admits
 * limits where they exist, because one verifiably wrong answer poisons
 * trust in all the others.
 */
const GROUPS: { title: string; items: FaqEntry[] }[] = [
  {
    title: "Pricing & billing",
    items: [
      {
        question: `How much does ${BRAND.name} cost?`,
        answer: `₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month, or ₹${BUSINESS_PLAN.pricePerSeatAnnual} per user per month billed annually. Every module — CRM, HR, accounting, retail, projects and the WhatsApp inbox — is included at that price; there is no higher tier that unlocks features. Prices exclude GST, and 18% GST is added at checkout with the split shown.`,
      },
      {
        question: "Is GST included in the price?",
        answer: `Per-seat prices are quoted excluding GST, which is the business convention in India. At checkout, ${Math.round(GST_RATE * 100)}% GST is added and the invoice shows base, GST and total separately, computed on the discounted base if a coupon was applied.`,
      },
      {
        question: "What is a seat?",
        answer: "One seat is one person who can sign in. You buy as many seats as you have people, and the system enforces it — a workspace cannot hold more members than its seats, and one login cannot be shared across devices (signing in on a second device signs the first out).",
      },
      {
        question: "Do you offer discounts or coupons?",
        answer: "Yes. Coupon codes are entered on the billing page at checkout and apply a percentage off the pre-GST amount. Annual billing is itself about 20% cheaper than monthly.",
      },
      {
        question: "Who actually charges my card?",
        answer: `Payments are processed by ${BRAND.legalName}, the company behind ${BRAND.name} — your card statement reads "Daylink". Checkout happens on daylink.in through Razorpay; card details are entered on Razorpay's PCI-DSS systems and are never seen by us.`,
      },
      {
        question: "Can I cancel anytime?",
        answer: "Yes, from Settings → Billing, in one click, owner-only. Because payments are one-off (nothing auto-charges), cancelling means we stop asking for money: access continues to the end of the period you already paid for, and you can resume until then. Trials can be cancelled the same way and are never charged.",
      },
    ],
  },
  {
    title: "The free trial",
    items: [
      {
        question: "How does the free trial work?",
        answer: "Fourteen days of the complete product — every module, the team size you choose at signup — with no card required. When the trial ends you pay to continue or your workspace pauses; your data stays intact either way and is waiting when you subscribe.",
      },
      {
        question: "What happens to my data if I don't subscribe?",
        answer: "Nothing is deleted when a trial expires — the workspace pauses behind a payment notice and reopens exactly as you left it when you subscribe. If you want your data removed instead, email support and we delete the workspace.",
      },
    ],
  },
  {
    title: "WhatsApp & channels",
    items: [
      {
        question: `How does WhatsApp work in ${BRAND.name}?`,
        answer: "You connect your WhatsApp Business number through Meta's official Cloud API. Every staff member answers from one shared inbox, each conversation attaches to the customer's record, and broadcasts use approved templates. You keep the number your customers already have.",
      },
      {
        question: "Are WhatsApp messages unlimited?",
        answer: `Each subscription includes ${BUSINESS_PLAN.monthlyMessageAllowance?.toLocaleString()} conversations per month, pooled across the whole workspace. Meta charges per conversation beyond that, and those charges are passed through at cost — we do not mark them up.`,
      },
      {
        question: "Which other channels are supported?",
        answer: "Instagram DMs, Facebook Messenger and email land in the same shared inbox as WhatsApp, attached to the same customer records.",
      },
    ],
  },
  {
    title: "Data, security & access",
    items: [
      {
        question: "Who owns the data I put in?",
        answer: "You do, without qualification. Contacts, invoices, books and documents export from the product, and if you leave we delete what you ask us to delete.",
      },
      {
        question: `How does ${BRAND.name} keep tenants separated?`,
        answer: "Every table is protected by database-level row security (Postgres RLS) keyed to your workspace, enforced in the database rather than in application code — so even an application bug cannot read another tenant's rows.",
      },
      {
        question: "Can one login be shared between people?",
        answer: "No, by design — seats are the pricing unit, so one account is one active device. Signing in on a second device signs the first one out immediately, and every sign-in is logged with device and IP for the workspace's audit trail.",
      },
      {
        question: "Can I control what each employee sees?",
        answer: "Yes. Role-based permissions control every module and action — an employee can be limited to punch-in, timesheets and their own requests, while HR sees the whole module. Custom roles are included on every plan.",
      },
    ],
  },
  {
    title: "Product & migration",
    items: [
      {
        question: "Can it really replace my CRM, HR tool, billing app and project tracker at once?",
        answer: "That is the design: one database where the sale, the payslip, the stock movement and the project invoice are rows in the same books. Most teams start with two modules and switch the rest on as subscriptions elsewhere lapse. The comparison page states honestly where specialist tools remain deeper.",
      },
      {
        question: "Which currencies does Dailybiz support?",
        answer:
          "Fourteen: INR, USD, EUR, GBP, AED, SGD, AUD, CAD, JPY, CNY, BRL, ZAR, NGN and MXN. Each workspace picks its operating currency in Settings and every deal, invoice, ledger and report renders in it. Two honest boundaries: a workspace runs in one currency at a time (multi-currency books with exchange differences are on the public roadmap), and the Dailybiz subscription itself is billed in INR.",
      },
      {
        question: "How do I get my existing data in?",
        answer: "Contacts, products and opening balances import from CSV. The 14-day trial is long enough to run both systems side by side before committing, and your accountant can keep receiving exports at year end.",
      },
      {
        question: "What is on the roadmap?",
        answer: "The public roadmap on the compare page lists what is in development — e-invoicing (IRN), e-way bills, bank reconciliation, credit notes, recurring invoices, deeper statutory payroll and multi-currency. Items leave that list only when they ship, never when they are merely started.",
      },
    ],
  },
];

export default function FaqPage() {
  const all = GROUPS.flatMap((g) => g.items);
  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "FAQ", path: "/faq" },
    ]),
    faqSchema(all),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <div data-enter className="mkt-eyebrow mb-5">
            Straight answers
          </div>
          <h1
            data-enter
            style={{ "--enter-delay": "80ms" } as React.CSSProperties}
            className="text-[2.25rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
          >
            Frequently asked questions
          </h1>
          <p
            data-enter
            style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            className="mkt-lead mt-5"
          >
            Everything a careful buyer asks before trusting a system with
            their business — numbers exact, limits admitted.
          </p>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      {GROUPS.map((group, gi) => (
        <section key={group.title} className={`mkt-section ${gi % 2 === 1 ? "mkt-band-surface" : ""}`}>
          <div className="mkt-container mkt-container-narrow">
            <Reveal className="mb-6">
              <h2 className="mkt-h2">{group.title}</h2>
            </Reveal>
            <div className="space-y-4">
              {group.items.map((f, i) => (
                <Reveal
                  key={f.question}
                  delay={Math.min(i * 40, 200)}
                  className="border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5"
                >
                  <h3 className="text-sm font-bold text-[var(--mkt-fg)]">{f.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">{f.answer}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <Reveal>
            <h2 className="mkt-h2 mb-4">Still deciding?</h2>
            <p className="mkt-lead mb-8">
              The trial answers questions faster than any FAQ. Fourteen days,
              every module, no card.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={`${BRAND.appUrl}/signup`} className="mkt-btn mkt-btn-md mkt-btn-primary">
                Start free trial <ArrowRight className="size-4" />
              </Link>
              <Link href="/contact" className="mkt-btn mkt-btn-md mkt-btn-secondary">
                Ask us directly
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
