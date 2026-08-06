import type { Metadata } from "next";

import { BRAND, absoluteUrl, pageTitle } from "@/config/brand";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: { absolute: pageTitle("Refund Policy") },
  description: `${BRAND.name}'s refund policy: a 7-day money-back window on first purchases, no charges during trials, and how refunds are processed via Razorpay.`,
  alternates: { canonical: absoluteUrl("/refund-policy") },
  robots: { index: true, follow: true },
};

/**
 * Razorpay's live-mode review requires a published refund policy, and
 * more importantly buyers check for one before paying a company they
 * have never heard of. The policy leans generous on the first purchase
 * because the 14-day trial already filters out most mismatches — anyone
 * asking for a refund after trialling AND paying usually has a real
 * grievance, and fighting over one month of one seat is never worth it.
 */
export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      updated="6 August 2026"
      intro={`${BRAND.name} is trial-first: you get 14 days of the full product before any money changes hands, so most purchases are made by people who already know it fits. For the cases where it still doesn't, this is how refunds work.`}
      sections={[
        {
          heading: "Trials are never charged",
          paragraphs: [
            "The 14-day trial requires no payment method and cannot result in a charge. If you do nothing at the end of a trial, nothing is billed — the workspace simply pauses.",
          ],
        },
        {
          heading: "First purchase: 7-day money-back",
          paragraphs: [
            "If your first paid subscription is not working out, email us within 7 days of payment and we refund it in full — monthly or annual, no questionnaire. We will ask what went wrong, because we want to know, but answering is not a condition of the refund.",
          ],
        },
        {
          heading: "Renewals and later purchases",
          paragraphs: [
            "Payments are prepaid and made manually (nothing auto-charges), so a renewal is always a deliberate act. Renewals are generally non-refundable once the period has begun, except where the paragraph below applies. Cancelling instead is always available: access runs to the end of the paid period and no further payment is requested.",
          ],
        },
        {
          heading: "Our failures are always refundable",
          paragraphs: [
            "If a defect on our side materially prevented you from using the service — extended downtime, data loss, a billing error such as a double charge or a wrong amount — we refund the affected period in full, whether or not any window has passed. Billing errors are corrected first and refunded second; you do not have to choose.",
          ],
        },
        {
          heading: "How refunds are paid",
          paragraphs: [
            `Refunds go back to the original payment method through Razorpay, initiated by ${BRAND.legalName} within 3 business days of approval. Razorpay and the card networks typically take 5–7 further business days to show it on your statement. GST charged on a refunded amount is refunded with it.`,
          ],
        },
        {
          heading: "How to ask",
          paragraphs: [
            `Email ${BRAND.payments.supportEmail} from the address on the account, with the workspace name. That is the whole process.`,
          ],
        },
      ]}
    />
  );
}
