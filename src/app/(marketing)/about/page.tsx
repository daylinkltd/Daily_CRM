import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Building2, Database, IndianRupee } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, breadcrumbSchema } from "@/lib/seo/structured-data";

const DESCRIPTION = `${BRAND.name} is built by ${BRAND.legalName} in Belagavi, Karnataka — one database that runs an Indian SMB's customers, staff, books, stock and projects, priced per person.`;

export const metadata: Metadata = {
  title: { absolute: pageTitle("About") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/about") },
  openGraph: {
    images: OG_IMAGES,
    title: pageTitle("About"),
    description: DESCRIPTION,
    url: absoluteUrl("/about"),
    type: "website",
  },
};

/**
 * The about page carries the ENTITY story — who makes this, where, and
 * why — because that is what both a cautious buyer and a knowledge graph
 * ask before trusting anything else the site says. Everything here is
 * checkable: the legal entity, the city, the parent company's site.
 */
const PRINCIPLES = [
  {
    icon: Database,
    title: "One database, not five integrations",
    body: "A sale, a payslip and a project invoice post to the same ledger because they are rows in the same database. Nothing syncs overnight, because nothing is separate. That single decision is most of the product.",
  },
  {
    icon: IndianRupee,
    title: "Priced like the businesses it serves",
    body: "One price per person, every module included, quoted in rupees with the GST shown. No enterprise tier hiding the good features, no per-integration fees, no implementation project.",
  },
  {
    icon: Building2,
    title: "Honesty as a growth strategy",
    body: "Our comparison page names what competitors do better and our roadmap says what is not built yet. Pages like that get quoted — by buyers and by AI assistants — and being reliably right is worth more than sounding finished.",
  },
  {
    icon: MapPin,
    title: "Built where its customers are",
    body: "Dailybuz is built in Belagavi, Karnataka — not a metro. The businesses around us run on WhatsApp, khata books and GST deadlines, and the product is shaped by watching them work, not by copying a Silicon Valley CRM.",
  },
];

export default function AboutPage() {
  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "About", path: "/about" },
    ]),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <div data-enter className="mkt-eyebrow mb-5">
            <MapPin className="size-3" /> Belagavi, Karnataka, India
          </div>
          <h1
            data-enter
            style={{ "--enter-delay": "80ms" } as React.CSSProperties}
            className="text-[2.25rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
          >
            Software for the businesses that run India
          </h1>
          <p
            data-enter
            style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            className="mkt-lead mt-5"
          >
            {BRAND.name} exists because a normal Indian business — a shop, an
            agency, a distributor — should not need five subscriptions and a
            spreadsheet to know how it is doing.
          </p>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow space-y-6">
          <Reveal>
            <h2 className="mkt-h2 mb-4">The company behind it</h2>
            <p className="text-base leading-relaxed text-[var(--mkt-fg-muted)]">
              {BRAND.name} is a product of{" "}
              <a
                href={BRAND.payments.merchantUrl}
                target="_blank"
                rel="noopener"
                className="font-semibold text-[var(--mkt-accent-text)] underline underline-offset-2"
              >
                {BRAND.legalName}
              </a>
              , a software company based in Belagavi, Karnataka. Daylink builds
              and operates business software for Indian companies; {BRAND.name}{" "}
              is its flagship platform. Payments are processed by Daylink — your
              card statement reads &ldquo;Daylink&rdquo; — and billing questions
              go to{" "}
              <a href={`mailto:${BRAND.payments.supportEmail}`} className="underline underline-offset-2">
                {BRAND.payments.supportEmail}
              </a>
              .
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container">
          <Reveal className="mb-8">
            <h2 className="mkt-h2">What we hold ourselves to</h2>
          </Reveal>
          <div className="grid gap-px border border-[var(--mkt-line)] bg-[var(--mkt-line)] sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <Reveal
                key={p.title}
                delay={Math.min(i * 55, 220)}
                className="border border-transparent bg-[var(--mkt-surface)] p-6"
              >
                <p.icon className="size-5 text-[var(--mkt-accent-text)]" />
                <h3 className="mt-3 text-sm font-bold text-[var(--mkt-fg)]">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">{p.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <Reveal>
            <h2 className="mkt-h2 mb-4">Talk to a person</h2>
            <p className="mkt-lead mb-8">
              Questions about the product, the company or a partnership — we
              answer our own email.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/contact" className="mkt-btn mkt-btn-md mkt-btn-primary">
                Contact us <ArrowRight className="size-4" />
              </Link>
              <Link href={`${BRAND.appUrl}/signup`} className="mkt-btn mkt-btn-md mkt-btn-secondary">
                Start free trial
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
