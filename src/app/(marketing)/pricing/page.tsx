import type { Metadata } from "next";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { BUSINESS_PLAN, PRICING_ON_REQUEST, SHOW_PUBLIC_PRICING } from "@/config/plans";
import { PricingContent } from "./pricing-content";
import { jsonLdGraph, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";

const DESCRIPTION = SHOW_PUBLIC_PRICING
  ? `${BRAND.name} costs ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month (₹${BUSINESS_PLAN.pricePerSeatAnnual} billed annually), excluding GST. Every module — CRM, HR, accounting, retail and projects — is included. 14-day free trial, no card required.`
  : `${BRAND.name} pricing: one per-user price with every module — CRM, HR, accounting, retail and projects — included. ${PRICING_ON_REQUEST} 14-day free trial, no card required.`;

export const metadata: Metadata = {
  title: { absolute: pageTitle("Pricing") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/pricing") },
  openGraph: {
    images: OG_IMAGES,
    title: pageTitle("Pricing"),
    description: DESCRIPTION,
    url: absoluteUrl("/pricing"),
    type: "website",
  },
};

/**
 * Pricing answers, written so a quoted fragment is still correct.
 *
 * "Excluding GST" appears in the answer rather than only in a footnote:
 * an extracted snippet will not carry the footnote, and a price quoted
 * without that qualifier is wrong by 18%.
 */
const FAQ = [
  {
    question: `How much does ${BRAND.name} cost?`,
    answer: SHOW_PUBLIC_PRICING
      ? `${BRAND.name} costs ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month billed monthly, or ₹${BUSINESS_PLAN.pricePerSeatAnnual} per user per month billed annually. Prices exclude GST. Every module is included at that price — there is no cheaper tier with fewer features, and no more expensive one that unlocks any.`
      : `${BRAND.name} is priced per user per month with every module included — there is no cheaper tier with fewer features, and no more expensive one that unlocks any. ${PRICING_ON_REQUEST}`,
  },
  {
    question: "Is there a free trial?",
    answer: `Yes — 14 days, no card required, with every module unlocked and up to 5 users. Your data carries over if you subscribe.`,
  },
  {
    question: "Are there extra charges for WhatsApp?",
    answer: `Each subscription includes ${BUSINESS_PLAN.monthlyMessageAllowance?.toLocaleString()} pooled WhatsApp conversations per month, shared across the whole workspace rather than divided per user. Meta charges per conversation beyond that, and those are passed through at cost.`,
  },
  {
    question: "Do I pay for modules I do not use?",
    answer: `No — there is one price and every module is in it. You can switch modules off per role so people only see what they need, but you are never asked to pay extra to unlock one.`,
  },
  {
    question: "What happens if my team grows?",
    answer: `You add seats and the price scales with them. There is no tier to jump and no feature you lose or gain by crossing a headcount threshold.`,
  },
];

export default function PricingPage() {
  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Pricing", path: "/pricing" },
    ]),
    faqSchema(FAQ),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />
      {SHOW_PUBLIC_PRICING ? <PricingContent faq={FAQ} /> : <PricingOnRequest faq={FAQ} />}
    </>
  );
}

/**
 * The pricing page while the table is hidden: same URL, same FAQ
 * structure, no numbers. The route stays alive so inbound links and
 * the sitemap don't break while pricing is being reworked.
 */
function PricingOnRequest({ faq }: { faq: { question: string; answer: string }[] }) {
  return (
    <div className="marketing">
      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
            Pricing
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--mkt-fg)] sm:text-4xl">
            One price. Every module.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--mkt-fg-muted)]">
            {PRICING_ON_REQUEST} Every workspace gets CRM, HR, accounting,
            retail, projects and the WhatsApp inbox — nothing is gated behind
            a higher tier, and the only variable is how many people you add.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/contact" className="mkt-btn mkt-btn-md mkt-btn-primary">
              Talk to us
            </a>
            <a href="/signup" className="mkt-btn mkt-btn-md mkt-btn-ghost">
              Start the 14-day free trial
            </a>
          </div>
        </div>
      </section>
      <div className="mkt-container"><div className="mkt-rule" /></div>
      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow">
          <h2 className="text-xl font-bold text-[var(--mkt-fg)]">Pricing questions</h2>
          <div className="mt-6 space-y-6">
            {faq.map((f) => (
              <div key={f.question}>
                <h3 className="text-sm font-semibold text-[var(--mkt-fg)]">{f.question}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">{f.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
