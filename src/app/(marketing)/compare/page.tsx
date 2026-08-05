import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus, X, CircleDollarSign, Hammer } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle } from "@/config/brand";
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

const DESCRIPTION = `How Dailybuz compares to Zoho One, Odoo, TallyPrime, Freshworks, Keka and Vyapar for Indian SMBs — on price, module coverage and where each one is genuinely the better choice.`;

export const metadata: Metadata = {
  title: { absolute: pageTitle("Compare Alternatives") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/compare") },
  openGraph: {
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
 */
const FAQ = [
  {
    question: "Dailybuz vs Zoho One — which is better for an Indian SMB?",
    answer: `Zoho One bundles 40+ separate applications for roughly ₹3,700 per user per month. Dailybuz is a single application covering CRM, HR, accounting, retail and projects for ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month. Zoho has far more breadth; Dailybuz keeps everything in one database so a sale posts to the ledger without an integration step. Choose Zoho if you need its long tail of apps, Dailybuz if you want one system at a fifth of the price.`,
  },
  {
    question: "Dailybuz vs Odoo — what is the difference?",
    answer:
      "Odoo is a deeper open-source ERP with manufacturing, MRP, field service and a large module ecosystem, typically implemented with a partner and maintained by someone technical. Dailybuz covers less ground but is ready on signup, WhatsApp-first, and priced without an implementation project. If you need production planning, Odoo is the better tool.",
  },
  {
    question: "Can Dailybuz replace Tally?",
    answer:
      "For day-to-day bookkeeping, largely yes: Dailybuz keeps real double-entry books with a chart of accounts, trial balance, profit and loss, balance sheet and GST reports, and sales, purchases and payroll post automatically. Tally remains the tool most Indian accountants know best, and many businesses still hand over an export at year end.",
  },
  {
    question: "Is Dailybuz cheaper than the alternatives?",
    answer: `At ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month (₹${BUSINESS_PLAN.pricePerSeatAnnual} billed annually, excluding GST) with every module included, Dailybuz is cheaper per user than Zoho One and Odoo Standard. It is more than a billing-only app such as Vyapar, which is the honest comparison — that is one price for CRM, HR, payroll, books and POS against one price for invoices.`,
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
            Every one of these tools is a reasonable choice for someone. Below
            is what each does better than us, what we do differently, and the
            cases where you should buy theirs instead.
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
            <h2 className="mkt-h2">Where each one wins</h2>
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

              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Where {c.name} wins
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                    {c.whereTheyWin}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-accent-text)]">
                    Where {BRAND.name} differs
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                    {c.whereWeDiffer}
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
            <h2 className="mkt-h2 mb-4">See if it fits in 14 days</h2>
            <p className="mkt-lead mb-8">
              Every module, no card. If one of the above suits you better,
              we&apos;d rather you found out for free.
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
