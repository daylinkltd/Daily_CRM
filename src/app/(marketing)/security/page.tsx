import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Database,
  MonitorSmartphone,
  ScrollText,
  KeyRound,
  CreditCard,
  UserCog,
  ArrowRight,
} from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, breadcrumbSchema } from "@/lib/seo/structured-data";

const DESCRIPTION = `How ${BRAND.name} protects business data: database-enforced tenant isolation, single-device sessions, role-based access, append-only audit logs and PCI-DSS payments via Razorpay.`;

export const metadata: Metadata = {
  title: { absolute: pageTitle("Security") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/security") },
  openGraph: {
    images: OG_IMAGES,
    title: pageTitle("Security"),
    description: DESCRIPTION,
    url: absoluteUrl("/security"),
    type: "website",
  },
};

/**
 * The trust page. Everything on it is a statement about how the system
 * is BUILT, not a promise about how we behave — a buyer can't audit our
 * intentions, but "row security is enforced in the database" is a
 * checkable architectural fact. Where something is on the roadmap (2FA),
 * it says so; a security page caught overclaiming is worse than none.
 */
const MEASURES = [
  {
    icon: Database,
    title: "Tenant isolation in the database",
    body: "Every table carries Postgres row-level security keyed to your workspace, with restrictive policies generated from one permission registry. Isolation is enforced by the database engine itself — an application bug cannot read another tenant's rows, because the query never sees them.",
  },
  {
    icon: MonitorSmartphone,
    title: "One device per login",
    body: "Signing in on a new device signs the old one out, atomically, checked on every request. Accounts cannot be shared, and a stolen session dies the moment the real owner signs in.",
  },
  {
    icon: UserCog,
    title: "Role-based access on every module",
    body: "Permissions are per-module and per-action, enforced in the database through the same policy layer as tenant isolation. An employee restricted to attendance punch-in cannot reach payroll data by knowing a URL.",
  },
  {
    icon: ScrollText,
    title: "Append-only audit trails",
    body: "Sign-ins, device displacements, plan changes and every administrative action are logged to tables where UPDATE and DELETE are revoked at the database level. The log cannot be edited by the people it describes — including us using the admin console.",
  },
  {
    icon: CreditCard,
    title: "Payments never touch our servers",
    body: `Checkout runs on Razorpay (PCI-DSS Level 1) via ${BRAND.legalName}. Card numbers are entered on Razorpay's systems; we receive a signed confirmation and independently verify the captured amount against the order before any plan changes.`,
  },
  {
    icon: KeyRound,
    title: "Secrets stay server-side",
    body: "Payment credentials live only on the payment hub, integration tokens are encrypted at rest, and our own admin console displays whether a secret is configured — never its value, not even masked.",
  },
];

export default function SecurityPage() {
  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Security", path: "/security" },
    ]),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <div data-enter className="mkt-eyebrow mb-5">
            <ShieldCheck className="size-3" /> Security
          </div>
          <h1
            data-enter
            style={{ "--enter-delay": "80ms" } as React.CSSProperties}
            className="text-[2.25rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
          >
            Built so trust is checkable
          </h1>
          <p
            data-enter
            style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            className="mkt-lead mt-5"
          >
            Your books, payroll and customer conversations live here. These are
            the architectural facts that protect them — facts, not promises.
          </p>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="grid gap-px border border-[var(--mkt-line)] bg-[var(--mkt-line)] sm:grid-cols-2 lg:grid-cols-3">
            {MEASURES.map((m, i) => (
              <Reveal
                key={m.title}
                delay={Math.min(i * 50, 250)}
                className="border border-transparent bg-[var(--mkt-surface)] p-6"
              >
                <m.icon className="size-5 text-[var(--mkt-accent-text)]" />
                <h2 className="mt-3 text-sm font-bold text-[var(--mkt-fg)]">{m.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">{m.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container mkt-container-narrow">
          <Reveal>
            <h2 className="mkt-h2 mb-4">Stated limits</h2>
            <p className="text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
              Two-factor authentication (TOTP) is in development and listed on
              the public roadmap; until it ships, account security rests on
              password strength plus the single-device rule. We publish what is
              not built yet for the same reason we publish what competitors do
              better: a security page that overclaims is worse than none.
              Security questions go to{" "}
              <a
                href={`mailto:${BRAND.contact.support}`}
                className="font-semibold text-[var(--mkt-accent-text)] underline underline-offset-2"
              >
                {BRAND.contact.support}
              </a>
              , and reports of vulnerabilities are answered personally and
              fast.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <Reveal>
            <h2 className="mkt-h2 mb-4">See it from the inside</h2>
            <p className="mkt-lead mb-8">
              Roles, audit logs and session control are all visible in the
              trial — fourteen days, no card.
            </p>
            <Link href={`${BRAND.appUrl}/signup`} className="mkt-btn mkt-btn-md mkt-btn-primary">
              Start free trial <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
