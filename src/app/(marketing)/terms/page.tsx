import type { Metadata } from "next";

import { BRAND, absoluteUrl, pageTitle } from "@/config/brand";
import { BUSINESS_PLAN } from "@/config/plans";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: { absolute: pageTitle("Terms of Service") },
  description: `The terms under which ${BRAND.legalName} provides ${BRAND.name}: subscriptions, seats, acceptable use, data ownership and liability.`,
  alternates: { canonical: absoluteUrl("/terms") },
  robots: { index: true, follow: true },
};

/**
 * Matches how the product actually behaves — trial-first, prepaid
 * periods, cancel-runs-to-period-end, seat enforcement — so the terms and
 * the software never contradict each other. REVIEW BY A LAWYER BEFORE A
 * DISPUTE RELIES ON IT.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="6 August 2026"
      intro={`These terms govern the use of ${BRAND.name}, operated by ${BRAND.legalName} ("Daylink"). Creating an account means agreeing to them. They are deliberately short and written in plain language; the plain language is the agreement, not a summary of it.`}
      sections={[
        {
          heading: "The service",
          paragraphs: [
            `${BRAND.name} is a subscription business platform covering CRM, HR, accounting, retail and project management. Every subscription includes every module; capability differences between plans are limited to seats, workspaces and usage allowances as stated on the pricing page.`,
          ],
        },
        {
          heading: "Trials, subscriptions and seats",
          paragraphs: [
            "New workspaces begin with a 14-day free trial of the full product. No payment method is required, and an unconverted trial simply pauses — data is retained as described in the Privacy Policy.",
            `Paid subscriptions are prepaid for one month or twelve, per seat, at the prices published on the pricing page (currently ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month, or ₹${BUSINESS_PLAN.pricePerSeatAnnual} billed annually, plus 18% GST). Nothing renews automatically: we request payment, you decide.`,
            "One seat is one named person. A workspace cannot hold more members than its purchased seats, and one account may be signed in on one device at a time. These limits are enforced by the software.",
          ],
        },
        {
          heading: "Cancellation",
          paragraphs: [
            "The workspace owner can cancel at any time from Settings → Billing. Cancellation stops all future payment requests; access continues until the end of the period already paid for, after which the workspace pauses. Refunds are governed by the Refund Policy.",
          ],
        },
        {
          heading: "Your data",
          paragraphs: [
            "Data entered into a workspace belongs to the business that entered it. We claim no rights over it beyond what is necessary to operate the service, you can export it at any time, and on deletion requests we remove it within 30 days except records we must retain by law.",
          ],
        },
        {
          heading: "Acceptable use",
          paragraphs: [
            "You may not use the service to send spam or unlawful messages (WhatsApp broadcasts must respect Meta's business messaging policies), to store content you have no right to store, or to attempt to access other tenants' data. We may suspend accounts doing so, with notice where the law and the situation allow it.",
          ],
        },
        {
          heading: "Payments",
          paragraphs: [
            `Payments are collected by ${BRAND.legalName} through Razorpay on daylink.in. Your card statement will read "Daylink". Prices are stated exclusive of GST; invoices show the GST amount separately.`,
          ],
        },
        {
          heading: "Availability and liability",
          paragraphs: [
            "We aim for continuous availability but do not promise it; maintenance and failures happen. To the extent the law allows, Daylink's total liability for any claim is limited to the amount you paid for the service in the twelve months preceding the claim, and we are not liable for indirect or consequential losses.",
            "Nothing in these terms limits liability that cannot be limited under Indian law.",
          ],
        },
        {
          heading: "Governing law",
          paragraphs: [
            "These terms are governed by the laws of India; courts at Belagavi, Karnataka have exclusive jurisdiction.",
          ],
        },
      ]}
    />
  );
}
