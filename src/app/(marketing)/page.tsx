import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Layers, ShieldCheck, Zap } from "lucide-react";

import { BRAND, pageTitle, OG_IMAGES } from "@/config/brand";
import { MODULES, INCLUDED_MODULES_NOTE } from "@/config/modules-content";
import { BUSINESS_PLAN } from "@/config/plans";
import { COMPETITORS, COVERAGE_ROWS } from "@/config/competitors";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, faqSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  // `absolute` bypasses the parent template — without it the root's
  // "%s | Dailybiz" appends the brand a second time and the tab reads
  // "Dailybiz — … | Dailybiz".
  title: { absolute: pageTitle() },
  description: BRAND.description,
  alternates: { canonical: BRAND.url },
  openGraph: {
    images: OG_IMAGES,
    title: pageTitle(),
    description: BRAND.description,
    url: BRAND.url,
    type: "website",
    siteName: BRAND.name,
  },
};

/**
 * Written as questions a buyer types, with answers that stand alone.
 *
 * These are the units an AI assistant lifts, so each answer includes its
 * own subject ("Dailybiz costs…", not "It costs…") — a quoted fragment
 * beginning with "It" is useless to someone who never saw the page.
 */
const FAQ = [
  {
    question: "What is Dailybiz?",
    answer: `${BRAND.description}`,
  },
  {
    question: "How much does Dailybiz cost?",
    answer: `Dailybiz costs ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month, or ₹${BUSINESS_PLAN.pricePerSeatAnnual} per user per month billed annually, excluding GST. Every module is included at that price — there is no higher tier. A 14-day free trial is available with no card required.`,
  },
  {
    question: "Is Dailybiz suitable for a small business in India?",
    answer:
      "Yes. Dailybiz is built for Indian SMBs specifically: pricing is in INR, GST reporting is built into the accounting module, and the shared inbox is centred on WhatsApp, which is how most Indian businesses actually talk to customers.",
  },
  {
    question: "What does Dailybiz replace?",
    answer:
      "Most customers use it instead of a separate CRM, HR or payroll tool, accounting package and project tracker. Because those all share one database, a POS sale posts straight to the ledger, payroll posts as an expense, and billable project time becomes an invoice without re-keying.",
  },
  {
    question: "Do I have to pay for every employee?",
    answer:
      "You pay per user who logs in. Staff who only punch in and out and raise requests still need a seat, but they see a deliberately narrow view — punch in/out, timesheets and a request form — rather than the full product.",
  },
];

const PILLARS = [
  {
    icon: Layers,
    title: "One database, not five integrations",
    body: "A sale, a payslip and a project invoice all post to the same ledger. Nothing is synced overnight, because nothing is separate to begin with.",
  },
  {
    icon: ShieldCheck,
    title: "Permissions that actually hold",
    body: "Access is enforced in the database itself, per module and per action — not hidden in the interface. A salesperson cannot read payroll even through the API.",
  },
  {
    icon: Zap,
    title: "Priced per person, everything included",
    body: `₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month. No module upsells, no feature gates, no per-integration fees.`,
  },
];

export default function HomePage() {
  const graph = jsonLdGraph([faqSchema(FAQ)]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <div data-enter className="mkt-eyebrow mb-6">
            CRM · HR · Accounting · Retail · Projects
          </div>

          <h1
            data-enter
            style={{ "--enter-delay": "80ms" } as React.CSSProperties}
            className="text-[2.5rem] font-extrabold leading-[1.06] tracking-tight sm:text-6xl"
          >
            Run your whole business
            <br className="hidden sm:block" /> in one place
          </h1>

          <p
            data-enter
            style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            className="mkt-lead mx-auto mt-6 max-w-2xl"
          >
            {BRAND.name} puts your customers, staff, books, stock and projects
            in a single system — with the WhatsApp conversation attached to the
            customer record, the invoice and the job.
          </p>

          <div
            data-enter
            style={{ "--enter-delay": "240ms" } as React.CSSProperties}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href={`${BRAND.appUrl}/signup`} className="mkt-btn mkt-btn-md mkt-btn-primary">
              Start 14-day free trial
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/modules" className="mkt-btn mkt-btn-md mkt-btn-secondary">
              See all modules
            </Link>
          </div>

          <p
            data-enter
            style={{ "--enter-delay": "300ms" } as React.CSSProperties}
            className="mt-4 text-xs text-[var(--mkt-fg-subtle)]"
          >
            No card required · ₹{BUSINESS_PLAN.pricePerSeatMonthly}/user/month after
            trial · Prices exclude GST
          </p>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      {/* ── WHY ────────────────────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-container">
          <div className="grid gap-px border border-[var(--mkt-line)] bg-[var(--mkt-line)] md:grid-cols-3">
            {PILLARS.map((pillar, i) => (
              <Reveal
                key={pillar.title}
                delay={i * 70}
                className="border border-transparent bg-[var(--mkt-surface)] p-7"
              >
                <pillar.icon className="size-5 text-[var(--mkt-accent-text)]" />
                <h2 className="mt-4 text-base font-bold text-[var(--mkt-fg)]">
                  {pillar.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                  {pillar.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULES ────────────────────────────────────────────────────── */}
      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container">
          <Reveal className="mb-12 max-w-2xl">
            <h2 className="mkt-h2">Five modules. One price. No upsell.</h2>
            <p className="mkt-lead mt-4">{INCLUDED_MODULES_NOTE}</p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((module, i) => {
              const Icon = module.icon;
              return (
                <Reveal key={module.slug} delay={Math.min(i * 60, 300)}>
                  <Link
                    href={`/modules/${module.slug}`}
                    className="mkt-lift flex h-full flex-col border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-6"
                  >
                    <span className="inline-flex size-10 items-center justify-center border border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)]">
                      <Icon className="size-5 text-[var(--mkt-accent-text)]" />
                    </span>
                    <h3 className="mt-4 text-base font-bold text-[var(--mkt-fg)]">
                      {module.name}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                      {module.summary}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--mkt-accent-text)]">
                      Explore <ArrowRight className="size-3" />
                    </span>
                  </Link>
                </Reveal>
              );
            })}

            <Reveal delay={330}>
              <Link
                href="/modules"
                className="mkt-lift flex h-full flex-col justify-center border border-dashed border-[var(--mkt-line)] bg-transparent p-6 text-center"
              >
                <p className="text-sm font-bold text-[var(--mkt-fg)]">
                  Compare everything
                </p>
                <p className="mt-2 text-xs text-[var(--mkt-fg-muted)]">
                  Full capability list, module by module.
                </p>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── PRICING TEASER ─────────────────────────────────────────────── */}
      {/* ── What the others leave out ─────────────────────────────────
          The single sharpest fact on the compare page, surfaced where
          most visitors actually are. Rendered from the same config as
          /compare so the two can never disagree. */}
      <section className="mkt-section">
        <div className="mkt-container">
          <Reveal className="mb-8 text-center">
            <h2 className="mkt-h2">The parts the others make you buy elsewhere</h2>
            <p className="mkt-lead mx-auto mt-3 max-w-2xl">
              Every capability below is included in every {BRAND.name} seat.
              Here is how many of the six tools we compare against ship each
              one at all.
            </p>
          </Reveal>
          <div className="grid gap-px border border-[var(--mkt-line)] bg-[var(--mkt-line)] sm:grid-cols-2 lg:grid-cols-3">
            {COVERAGE_ROWS.map((row, i) => {
              const offeredBy = COMPETITORS.filter(
                (c) => c.coverage[row.key] === "full",
              ).length;
              return (
                <Reveal
                  key={row.key}
                  delay={Math.min(i * 45, 250)}
                  className="border border-transparent bg-[var(--mkt-surface)] p-6"
                >
                  <h3 className="text-sm font-bold text-[var(--mkt-fg)]">{row.label}</h3>
                  <p className="mt-2 text-sm text-[var(--mkt-fg-muted)]">
                    Included here.{" "}
                    {offeredBy === 0
                      ? "None of the six alternatives ship this fully."
                      : `Only ${offeredBy} of 6 alternatives ship this fully.`}
                  </p>
                </Reveal>
              );
            })}
            <Reveal delay={280} className="border border-transparent bg-[var(--mkt-surface)] p-6">
              <h3 className="text-sm font-bold text-[var(--mkt-fg)]">14 currencies</h3>
              <p className="mt-2 text-sm text-[var(--mkt-fg-muted)]">
                Pick your workspace currency — ₹, $, €, £, AED and more — and
                every deal, invoice and report renders in it.
              </p>
            </Reveal>
          </div>
          <Reveal className="mt-6 text-center">
            <Link href="/compare" className="text-sm font-bold text-[var(--mkt-accent-text)] hover:underline">
              See the full, honest comparison →
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow">
          <Reveal className="border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-8 text-center sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
              Simple pricing
            </p>
            <p className="mt-4 text-5xl font-extrabold tracking-tight text-[var(--mkt-fg)]">
              ₹{BUSINESS_PLAN.pricePerSeatMonthly}
              <span className="text-base font-medium text-[var(--mkt-fg-subtle)]">
                {" "}
                /user/month
              </span>
            </p>
            <p className="mt-3 text-sm text-[var(--mkt-fg-muted)]">
              ₹{BUSINESS_PLAN.pricePerSeatAnnual}/user/month billed annually.
              Every module included. Excludes GST.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/pricing" className="mkt-btn mkt-btn-md mkt-btn-primary">
                See what&apos;s included
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container mkt-container-narrow">
          <Reveal className="mb-10 text-center">
            <h2 className="mkt-h2">Common questions</h2>
          </Reveal>

          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <Reveal
                key={item.question}
                delay={Math.min(i * 50, 250)}
                className="border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5"
              >
                <h3 className="text-sm font-bold text-[var(--mkt-fg)]">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                  {item.answer}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <Reveal>
            <h2 className="mkt-h2 mb-4">Stop paying four vendors</h2>
            <p className="mkt-lead mb-8">
              Fourteen days, every module, no card. If it does not fit, walk
              away — your data exports.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href={`${BRAND.appUrl}/signup`} className="mkt-btn mkt-btn-md mkt-btn-primary">
                Start free trial
                <ArrowRight className="size-4" />
              </Link>
              <a href={`mailto:${BRAND.contact.sales}`} className="mkt-btn mkt-btn-md mkt-btn-secondary">
                Talk to sales
              </a>
            </div>
            <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--mkt-fg-subtle)]">
              {["Every module included", "No card required", "Built in India"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  {t}
                </span>
              ))}
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
