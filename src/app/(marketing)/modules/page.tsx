import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { MODULES } from "@/config/modules-content";
import { Reveal } from "@/components/marketing/reveal";
import {
  jsonLdGraph,
  moduleSchemas,
  breadcrumbSchema,
  faqSchema,
} from "@/lib/seo/structured-data";

const DESCRIPTION =
  "Every Dailybiz module — CRM and shared WhatsApp inbox, HR and payroll, double-entry accounting, retail POS and inventory, and project management. All included in every user, at one price.";

export const metadata: Metadata = {
  title: { absolute: pageTitle("All Modules") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/modules") },
  openGraph: {
    images: OG_IMAGES,
    title: pageTitle("All Modules"),
    description: DESCRIPTION,
    url: absoluteUrl("/modules"),
    type: "website",
  },
};

/**
 * Questions written the way buyers actually ask them.
 *
 * Kept as complete, self-contained answers: an assistant quoting one of
 * these should produce something true even with no surrounding context,
 * because that is exactly how it will be surfaced.
 */
const FAQ = [
  {
    question: "Which modules are included in Dailybiz?",
    answer:
      "All five are included for every user: CRM with a shared WhatsApp inbox, HR and payroll, double-entry accounting, retail POS and inventory, and project management. There is no higher tier that unlocks modules — the only variable in the price is how many people you add.",
  },
  {
    question: "Can I use only one module?",
    answer:
      "Yes. Each module can be switched off per role, so a salesperson need never see payroll and an accountant need never see the sales pipeline. You still pay one per-user price, because the modules share one database — a POS sale posts to the ledger, and billable project time becomes an invoice.",
  },
  {
    question: "Does Dailybiz replace Tally or Zoho Books?",
    answer:
      "For day-to-day bookkeeping, largely yes: Dailybiz keeps real double-entry books with a chart of accounts, trial balance, profit and loss, balance sheet and GST reports, and every sale, purchase and payroll run posts automatically. Many businesses still export to their accountant at year end.",
  },
  {
    question: "Is WhatsApp included, and are there message charges?",
    answer:
      "A shared WhatsApp inbox is included, along with a pooled monthly conversation allowance shared across your whole workspace. Meta charges per conversation beyond that allowance, and those are billed at cost.",
  },
];

export default function ModulesPage() {
  const graph = jsonLdGraph([
    ...moduleSchemas(),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Modules", path: "/modules" },
    ]),
    faqSchema(FAQ),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <div data-enter className="mkt-eyebrow mb-5">
            Five modules, one product
          </div>
          <h1
            data-enter
            style={{ "--enter-delay": "80ms" } as React.CSSProperties}
            className="text-[2.25rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
          >
            Everything your business runs on, in one place
          </h1>
          <p
            data-enter
            style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            className="mkt-lead mt-5"
          >
            Most teams pay for a CRM, a payroll tool, an accounting package and
            a project tracker — then spend their week copying data between
            them. {BRAND.name} is one system with one customer record, one
            ledger and one set of people.
          </p>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      {/* ── MODULES ────────────────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-container space-y-6">
          {MODULES.map((module, index) => {
            const Icon = module.icon;
            return (
              <Reveal
                key={module.slug}
                delay={Math.min(index * 60, 240)}
                className="mkt-lift border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-6 sm:p-8"
              >
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-10 items-center justify-center border border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)]">
                        <Icon className="size-5 text-[var(--mkt-accent-text)]" />
                      </span>
                      <h2 className="text-xl font-extrabold tracking-tight">
                        {module.name}
                      </h2>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                      {module.summary}
                    </p>

                    <p className="mt-4 border-l-2 border-[var(--mkt-accent-line)] pl-4 text-sm italic leading-relaxed text-[var(--mkt-fg-subtle)]">
                      {module.problem}
                    </p>

                    <Link
                      href={`/modules/${module.slug}`}
                      className="mkt-btn mkt-btn-sm mkt-btn-secondary mt-6"
                    >
                      Explore {module.name}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>

                  <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {module.features.map((feature) => (
                      <li key={feature.title}>
                        <p className="flex items-start gap-2 text-sm font-semibold text-[var(--mkt-fg)]">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                          {feature.title}
                        </p>
                        <p className="mt-1 pl-[1.375rem] text-xs leading-relaxed text-[var(--mkt-fg-muted)]">
                          {feature.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                {module.roadmap?.length ? (
                  <p className="mt-6 border-t border-[var(--mkt-line-soft)] pt-4 text-xs text-[var(--mkt-fg-subtle)]">
                    <span className="font-semibold">In development:</span>{" "}
                    {module.roadmap.join(" · ")}
                  </p>
                ) : null}
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container mkt-container-narrow">
          <Reveal className="mb-10 text-center">
            <h2 className="mkt-h2">Questions worth asking</h2>
          </Reveal>

          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <Reveal
                key={item.question}
                delay={Math.min(i * 60, 240)}
                className="border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5"
              >
                {/* Real headings and prose, not an accordion: content hidden
                    behind a click is content an extractor may not read. */}
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
            <h2 className="mkt-h2 mb-4">Try the whole thing for 14 days</h2>
            <p className="mkt-lead mb-8">
              Every module, no card required. Keep your data if you stay.
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
