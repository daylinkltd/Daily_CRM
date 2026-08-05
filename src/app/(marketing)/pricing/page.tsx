import type { Metadata } from "next";

import { BRAND, absoluteUrl, pageTitle } from "@/config/brand";
import { BUSINESS_PLAN, SOLO_PLAN } from "@/config/plans";
import { PricingContent } from "./pricing-content";
import { jsonLdGraph, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";

const DESCRIPTION = `${BRAND.name} costs ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month (₹${BUSINESS_PLAN.pricePerSeatAnnual} billed annually), excluding GST. Every module — CRM, HR, accounting, retail and projects — is included. 14-day free trial, no card required.`;

export const metadata: Metadata = {
  title: { absolute: pageTitle("Pricing") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/pricing") },
  openGraph: {
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
    answer: `A single user pays ₹${SOLO_PLAN.pricePerSeatMonthly} per month on Solo (₹${SOLO_PLAN.pricePerSeatAnnual} billed annually). Teams pay ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month, or ₹${BUSINESS_PLAN.pricePerSeatAnnual} per user per month billed annually. Prices exclude GST, and every module is included on both.`,
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
      <PricingContent faq={FAQ} />
    </>
  );
}
