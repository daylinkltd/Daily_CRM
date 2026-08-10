import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Minus, X } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { BUSINESS_PLAN } from "@/config/plans";
import {
  COMPETITORS,
  COVERAGE_LABEL,
  COVERAGE_ROWS,
  OURS,
  type Coverage,
} from "@/config/competitors";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";

/**
 * One page per competitor.
 *
 * "Zoho One alternative" and "Dailybiz vs Odoo" are queries with a
 * buyer attached, and the umbrella /compare page cannot rank for six of
 * them at once — a page whose title, H1 and FAQ all speak about ONE rival
 * can. Everything renders from the same config as /compare, so the two
 * can never tell different stories about the same competitor.
 */
export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

function competitorBySlug(slug: string) {
  return COMPETITORS.find((c) => c.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  if (!c) return { title: { absolute: pageTitle("Not found") } };

  const url = absoluteUrl(`/compare/${c.slug}`);
  const title = `${BRAND.name} vs ${c.name} — the ${c.name} alternative for Indian SMBs`;
  const description = `${c.whereWeDiffer.slice(0, 155)}…`;
  return {
    title: { absolute: pageTitle(`${BRAND.name} vs ${c.name}`) },
    description,
    alternates: { canonical: url },
    openGraph: {
    images: OG_IMAGES, title, description, url, type: "website" },
  };
}

function CoverageCell({ value }: { value: Coverage }) {
  const map: Record<Coverage, { icon: React.ElementType; cls: string }> = {
    full: { icon: Check, cls: "text-emerald-500" },
    partial: { icon: Minus, cls: "text-amber-500" },
    addon: { icon: Minus, cls: "text-amber-500" },
    none: { icon: X, cls: "text-[var(--mkt-fg-subtle)]" },
  };
  const { icon: Icon, cls } = map[value];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cls}`}>
      <Icon className="size-3.5" /> {COVERAGE_LABEL[value]}
    </span>
  );
}

export default async function CompetitorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  if (!c) notFound();

  const faq = [
    {
      question: `Is ${BRAND.name} a good alternative to ${c.name}?`,
      answer: `${c.whereWeDiffer} ${c.name} remains ahead where its strengths apply: ${c.whereTheyWin}`,
    },
    {
      question: `How does ${BRAND.name} pricing compare to ${c.name}?`,
      answer: `${BRAND.name} is ₹${BUSINESS_PLAN.pricePerSeatMonthly} per user per month (₹${BUSINESS_PLAN.pricePerSeatAnnual} billed annually, excluding GST) with every module included and a 14-day free trial. ${c.name} is priced at roughly: ${c.priceNote}.`,
    },
    {
      question: `Can I move from ${c.name} to ${BRAND.name}?`,
      answer: `Yes — contacts, products and opening balances import from CSV, and the 14-day trial is long enough to run both side by side before deciding. Your data exports back out just as easily if you decide against it.`,
    },
  ];

  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Compare", path: "/compare" },
      { name: `vs ${c.name}`, path: `/compare/${c.slug}` },
    ]),
    faqSchema(faq),
  ]);

  const others = COMPETITORS.filter((o) => o.slug !== c.slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow">
          <Link
            href="/compare"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--mkt-fg-subtle)] hover:text-[var(--mkt-fg)]"
          >
            <ArrowLeft className="size-3" /> Full comparison
          </Link>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {BRAND.name} vs {c.name}
          </h1>
          <p className="mkt-lead mt-4">
            {c.name}: {c.category.toLowerCase()}. Here is where the two differ,
            with the parts {c.name} still does better stated plainly.
          </p>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow space-y-8">
          <Reveal>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-accent-text)]">
              Why teams choose {BRAND.name}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--mkt-fg)]">{c.whereWeDiffer}</p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
              Where {c.name} is ahead
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">{c.whereTheyWin}</p>
          </Reveal>
          <Reveal delay={140} className="border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
              Pricing, side by side
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="block text-sm font-bold text-[var(--mkt-fg)]">{BRAND.name}</span>
                <span className="block text-sm text-[var(--mkt-fg-muted)]">{OURS.priceNote}</span>
              </div>
              <div>
                <span className="block text-sm font-bold text-[var(--mkt-fg)]">{c.name}</span>
                <span className="block text-sm text-[var(--mkt-fg-muted)]">{c.priceNote}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Coverage table, two columns only */}
      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container mkt-container-narrow">
          <Reveal className="mb-6">
            <h2 className="mkt-h2">Module coverage</h2>
          </Reveal>
          <Reveal className="overflow-x-auto border border-[var(--mkt-line)] bg-[var(--mkt-surface)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--mkt-line)] text-xs uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
                  <th className="p-4">Capability</th>
                  <th className="p-4">{BRAND.name}</th>
                  <th className="p-4">{c.name}</th>
                </tr>
              </thead>
              <tbody>
                {COVERAGE_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-[var(--mkt-line)] last:border-0">
                    <td className="p-4 font-semibold text-[var(--mkt-fg)]">{row.label}</td>
                    <td className="p-4"><CoverageCell value={OURS.coverage[row.key]} /></td>
                    <td className="p-4"><CoverageCell value={c.coverage[row.key]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow">
          <Reveal className="mb-8">
            <h2 className="mkt-h2">Common questions</h2>
          </Reveal>
          <div className="space-y-4">
            {faq.map((f, i) => (
              <Reveal
                key={f.question}
                delay={i * 60}
                className="border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5"
              >
                <h3 className="text-sm font-bold text-[var(--mkt-fg)]">{f.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">{f.answer}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container mkt-container-narrow text-center">
          <Reveal>
            <h2 className="mkt-h2 mb-4">Decide with real data, not tables</h2>
            <p className="mkt-lead mb-8">
              Fourteen days, every module, no card. Run it next to {c.name} and
              keep whichever earns its place.
            </p>
            <Link href={`${BRAND.appUrl}/signup`} className="mkt-btn mkt-btn-md mkt-btn-primary">
              Start free trial <ArrowRight className="size-4" />
            </Link>
            <p className="mt-8 text-xs text-[var(--mkt-fg-subtle)]">
              Also compared:{" "}
              {others.map((o, i) => (
                <span key={o.slug}>
                  <Link href={`/compare/${o.slug}`} className="underline underline-offset-2 hover:text-[var(--mkt-fg)]">
                    {o.name}
                  </Link>
                  {i < others.length - 1 ? " · " : ""}
                </span>
              ))}
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
