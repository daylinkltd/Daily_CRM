import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus, X, CircleDollarSign, Hammer } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { BUSINESS_PLAN } from "@/config/plans";
import {
  COMPETITORS,
  COVERAGE_ROWS,
  COVERAGE_LABEL,
  ROADMAP,
  HORIZON_LABEL,
  OURS,
  type Coverage,
} from "@/config/competitors";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";

const DESCRIPTION = `Dailybiz vs Zoho One, Odoo, TallyPrime, Freshworks, Keka and Vyapar. One system covering CRM, HR, accounting, retail and projects at ₹799 per user per month — compared on price, module coverage and architecture, with the gaps stated plainly.`;

export const metadata: Metadata = {
  title: { absolute: pageTitle("Compare Alternatives") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/compare") },
  openGraph: {
    images: OG_IMAGES,
    title: pageTitle("Compare Alternatives"),
    description: DESCRIPTION,
    url: absoluteUrl("/compare"),
    type: "website",
  },
};

/**
 * "X vs Y" is one of the highest-intent queries in B2B, and increasingly
 * one an assistant answers directly rather than sending a click. These
 * answers therefore name the competitor AND concede their strength — an
 * answer that only praises us reads as marketing and gets discounted;
 * one that concedes something specific gets quoted.
 *
 * Each answer therefore LEADS with the case for Dailybiz and ends with the
 * genuine caveat, rather than the other way round. An assistant asked "X
 * vs Y" usually surfaces the first sentence or two, and the previous
 * version's answers opened by describing the competitor.
 */
const FAQ = [
  {
    question: "Dailybiz vs Zoho One — which is better for an Indian SMB?",
    answer: `For most Indian SMBs, Dailybiz. It covers CRM, HR, accounting, retail and projects in one application for ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month, against roughly ₹3,700 for Zoho One — about a fifth of the price. The bigger difference is architectural: Zoho One is forty separate products joined by integrations you configure and maintain, so data moves between them on a sync. Dailybiz is one database, so a POS sale, its ledger entry and the customer record are the same rows. Zoho is the better answer if you specifically need its long tail of apps, such as expense travel or its BI suite.`,
  },
  {
    question: "Dailybiz vs Odoo — what is the difference?",
    answer:
      "Time to value and total cost. Dailybiz is ready on signup — your team is working the same afternoon, WhatsApp is the primary channel rather than an add-on, and the price on the page is the price. Odoo is a deeper ERP, but it is rarely bought alone: a partner-led implementation is usually a project before anyone logs in, and it needs someone technical to keep it upgraded. Odoo is the right choice if you need manufacturing and production planning, which Dailybiz does not have.",
  },
  {
    question: "Can Dailybiz replace Tally?",
    answer:
      "For day-to-day books, yes. Dailybiz keeps real double-entry accounting — chart of accounts, trial balance, profit and loss, balance sheet and GST reports — and sales, purchases and payroll post to it automatically instead of being re-keyed from another system. It also does what Tally does not: customers, staff, stock and conversations sit alongside the entries, in a browser, from anywhere. Tally still has decades more statutory depth, and most businesses keep handing their CA an export at year end, which Dailybiz supports.",
  },
  {
    question: "Is Dailybiz cheaper than the alternatives?",
    answer: `Against anything comparable, yes. At ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month (₹${BUSINESS_PLAN.pricePerSeatAnnual} billed annually, excluding GST) with every module included, Dailybiz is cheaper per user than Zoho One and Odoo Standard, and it replaces the separate CRM, HR and accounting subscriptions most teams are already paying for in parallel. A billing-only app such as Vyapar costs less because it does less — one price for invoices, against one price for CRM, HR, payroll, books and POS.`,
  },
];

function CoverageCell({ value }: { value: Coverage }) {
  const styles: Record<Coverage, { icon: React.ElementType; className: string }> = {
    full: { icon: Check, className: "text-emerald-500" },
    partial: { icon: Minus, className: "text-amber-500" },
    addon: { icon: CircleDollarSign, className: "text-amber-500" },
    none: { icon: X, className: "text-[var(--mkt-fg-subtle)]" },
  };
  const { icon: Icon, className } = styles[value];

  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={`size-4 shrink-0 ${className}`} aria-hidden />
      <span className="text-xs text-[var(--mkt-fg-muted)]">{COVERAGE_LABEL[value]}</span>
    </span>
  );
}

export default function ComparePage() {
  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Compare", path: "/compare" },
    ]),
    faqSchema(FAQ),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <div data-enter className="mkt-eyebrow mb-5">
            An honest comparison
          </div>
          <h1
            data-enter
            style={{ "--enter-delay": "80ms" } as React.CSSProperties}
            className="text-[2.25rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
          >
            {BRAND.name} vs the alternatives
          </h1>
          <p
            data-enter
            style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            className="mkt-lead mt-5"
          >
            Most Indian SMBs end up paying for three or four of the tools
            below at once, then paying again — in time — to keep them in step.
            {" "}{BRAND.name} is one system at one price per person. Here is
            how it compares, including the places the others are still ahead.
          </p>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      {/* Coverage matrix */}
      <section className="mkt-section">
        <div className="mkt-container">
          <Reveal className="mb-8">
            <h2 className="mkt-h2">What each one covers</h2>
            <p className="mkt-lead mt-3 max-w-2xl">
              Module coverage as sold today. &ldquo;Limited&rdquo; means it
              exists but is not comparable; &ldquo;costs extra&rdquo; means a
              paid add-on or third-party integration.
            </p>
          </Reveal>

          <div className="overflow-x-auto border border-[var(--mkt-line)]">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <caption className="sr-only">
                Module coverage compared across {BRAND.name} and six alternatives
              </caption>
              <thead>
                <tr className="bg-[var(--mkt-surface-2)]">
                  <th scope="col" className="p-4 text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
                    Capability
                  </th>
                  <th scope="col" className="p-4 text-sm font-extrabold text-[var(--mkt-accent-text)]">
                    {OURS.name}
                  </th>
                  {COMPETITORS.map((c) => (
                    <th key={c.slug} scope="col" className="p-4 text-sm font-bold text-[var(--mkt-fg)]">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COVERAGE_ROWS.map((row) => (
                  <tr key={row.key} className="border-t border-[var(--mkt-line)]">
                    <th scope="row" className="p-4 text-sm font-medium text-[var(--mkt-fg)]">
                      {row.label}
                    </th>
                    <td className="bg-[var(--mkt-accent-soft)] p-4">
                      <CoverageCell value={OURS.coverage[row.key] as Coverage} />
                    </td>
                    {COMPETITORS.map((c) => (
                      <td key={c.slug} className="p-4">
                        <CoverageCell value={c.coverage[row.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-[var(--mkt-line)] bg-[var(--mkt-band)]">
                  <th scope="row" className="p-4 text-sm font-medium text-[var(--mkt-fg)]">
                    Indicative price
                  </th>
                  <td className="bg-[var(--mkt-accent-soft)] p-4 text-xs font-semibold text-[var(--mkt-fg)]">
                    {OURS.priceNote}
                  </td>
                  {COMPETITORS.map((c) => (
                    <td key={c.slug} className="p-4 text-xs text-[var(--mkt-fg-muted)]">
                      {c.priceNote}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-[var(--mkt-fg-subtle)]">
            Public list pricing as at August 2026, converted at approximately
            ₹83/USD where a vendor quotes in dollars. Vendors change prices —
            check theirs before deciding.
          </p>
        </div>
      </section>

      {/* Head to head */}
      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container space-y-5">
          <Reveal className="mb-6">
            <h2 className="mkt-h2">Head to head</h2>
          </Reveal>

          {COMPETITORS.map((c, i) => (
            <Reveal
              key={c.slug}
              delay={Math.min(i * 55, 260)}
              className="border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-lg font-extrabold text-[var(--mkt-fg)]">
                  {BRAND.name} vs {c.name}
                </h3>
                <span className="text-xs text-[var(--mkt-fg-subtle)]">{c.category}</span>
              </div>

              {/* Our case first and wider. The competitor's advantage is
                  still stated in full — the page is worthless without it —
                  but as the caveat it is, not as the headline. Reading
                  order is the whole argument here: whichever column comes
                  first is the one a skimming visitor takes away. */}
              <div className="mt-5 grid gap-6 md:grid-cols-5">
                <div className="md:col-span-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-accent-text)]">
                    Why teams choose {BRAND.name}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg)]">
                    {c.whereWeDiffer}
                  </p>
                </div>
                <div className="md:col-span-2 md:border-l md:border-[var(--mkt-line)] md:pl-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
                    Where {c.name} is ahead
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                    {c.whereTheyWin}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Roadmap — the same facts, forward-looking. */}
      <section className="mkt-section">
        <div className="mkt-container">
          <Reveal className="mb-8 max-w-2xl">
            <div className="mkt-eyebrow mb-4">
              <Hammer className="size-3" /> What we&apos;re building
            </div>
            <h2 className="mkt-h2">Where {BRAND.name} is still growing</h2>
            <p className="mkt-lead mt-3">
              We would rather tell you what is coming than let you find out
              after you have signed up. Nothing below ships until it ships —
              this list shortens, it does not get reworded.
            </p>
          </Reveal>

          <div className="grid gap-px border border-[var(--mkt-line)] bg-[var(--mkt-line)] sm:grid-cols-2">
            {ROADMAP.map((item, i) => (
              <Reveal
                key={item.title}
                delay={Math.min(i * 45, 300)}
                className="border border-transparent bg-[var(--mkt-surface)] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold text-[var(--mkt-fg)]">{item.title}</h3>
                  <span
                    className={`shrink-0 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      item.horizon === "building"
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : item.horizon === "next"
                          ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                          : "border-[var(--mkt-line)] text-[var(--mkt-fg-subtle)]"
                    }`}
                  >
                    {HORIZON_LABEL[item.horizon]}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                  {item.detail}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container mkt-container-narrow">
          <Reveal className="mb-10 text-center">
            <h2 className="mkt-h2">Straight answers</h2>
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

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <Reveal>
            <h2 className="mkt-h2 mb-4">Try it against your own numbers</h2>
            <p className="mkt-lead mb-8">
              {/* The old copy ended the page by inviting the visitor to
                  pick a competitor. Confidence and honesty are not in
                  tension: 14 days with real data settles it either way, and
                  we win that comparison more often than we lose it. */}
              Fourteen days, every module, no card. Load your customers, run
              a payroll, raise an invoice — it is a faster answer than any
              comparison table, including this one.
            </p>
            <Link href={`${BRAND.appUrl}/signup`} className="mkt-btn mkt-btn-md mkt-btn-primary">
              Start free trial
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
