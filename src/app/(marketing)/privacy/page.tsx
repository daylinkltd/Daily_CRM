import type { Metadata } from "next";

import { BRAND, absoluteUrl, pageTitle } from "@/config/brand";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: { absolute: pageTitle("Privacy Policy") },
  description: `How ${BRAND.name} collects, uses and protects personal data, under India's DPDP Act framework.`,
  alternates: { canonical: absoluteUrl("/privacy") },
  robots: { index: true, follow: true },
};

/**
 * Written to be accurate to how the system actually works (single-device
 * sessions, RLS isolation, Razorpay handling cards, Meta processing
 * WhatsApp) rather than copied boilerplate that promises practices we
 * don't have. REVIEW BY A LAWYER BEFORE RELYING ON IT IN A DISPUTE —
 * this is an honest description, not legal advice.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="6 August 2026"
      intro={`This policy explains what ${BRAND.legalName} ("Daylink", "we") collects when you use ${BRAND.name}, why, and the choices you have. It is written to be read, not skimmed past.`}
      sections={[
        {
          heading: "What we collect",
          paragraphs: [
            "Account data: your name, email, and password hash when you sign up; your phone number if you provide it.",
            "Workspace data: everything your business puts into the product — contacts, conversations, invoices, ledgers, employee records, documents. This data belongs to your business; we store and process it only to run the service.",
            "Usage and security data: sign-in events with device and IP address (used to enforce the one-active-session rule and to give workspace owners an audit trail), and diagnostic logs needed to keep the service running.",
            "Payment data: we never see card numbers. Payments are processed by Razorpay on daylink.in; we receive confirmation of the amount paid and an order reference.",
          ],
        },
        {
          heading: "What we do with it",
          paragraphs: [
            "We use your data to provide the service, enforce plan limits, prevent abuse, answer support requests and send transactional messages (receipts, trial reminders, security notices).",
            "We do not sell personal data, we do not rent lists, and we do not use your workspace's business data to train machine-learning models.",
          ],
        },
        {
          heading: "WhatsApp and connected channels",
          paragraphs: [
            "When you connect a WhatsApp Business number, messages flow through Meta's Cloud API under Meta's own terms. Access tokens for connected channels are stored encrypted at rest. Instagram, Messenger and email channels work the same way through their respective providers.",
          ],
        },
        {
          heading: "Where data lives and how it is protected",
          paragraphs: [
            "Data is stored in a managed Postgres database (Supabase) with tenant isolation enforced by row-level security in the database engine itself. Access inside Daylink is restricted to what operating the service requires, and administrative actions on our side are logged to an append-only audit trail.",
          ],
        },
        {
          heading: "Your rights",
          paragraphs: [
            "You can export your data from the product, correct it in the product, and request deletion of your account or an entire workspace by emailing support. We honour deletion requests within 30 days, except records we are legally required to retain (such as tax invoices).",
            "India's Digital Personal Data Protection Act applies to us as a data fiduciary; grievances go to the contact below and will be acknowledged within 72 hours.",
          ],
        },
        {
          heading: "Cookies",
          paragraphs: [
            "The product uses strictly functional cookies: your session, and a short-lived marker used by session enforcement. The marketing site sets no advertising trackers.",
          ],
        },
        {
          heading: "Changes",
          paragraphs: [
            "If this policy changes materially, workspace owners are notified inside the product and by email before the change takes effect.",
          ],
        },
      ]}
    />
  );
}
