import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { INDUSTRIES, industryBySlug } from "@/config/industries-content";
import { moduleBySlug } from "@/config/modules-content";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ slug: i.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ind = industryBySlug(slug);
  if (!ind) return { title: { absolute: pageTitle("Not found") } };

  const url = absoluteUrl(`/industries/${ind.slug}`);
  const title = `${BRAND.name} for ${ind.name}`;
  return {
    title: { absolute: pageTitle(title) },
    description: ind.summary,
    alternates: { canonical: url },
    openGraph: {
    images: OG_IMAGES, title, description: ind.summary, url, type: "website" },
  };
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ind = industryBySlug(slug);
  if (!ind) notFound();

  const modules = ind.moduleSlugs
    .map((s) => moduleBySlug(s))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Industries", path: "/industries" },
      { name: ind.name, path: `/industries/${ind.slug}` },
    ]),
    faqSchema(ind.faq),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow">
          <Link
            href="/industries"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--mkt-fg-subtle)] hover:text-[var(--mkt-fg)]"
          >
            <ArrowLeft className="size-3" /> All industries
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center border border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)]">
              <ind.icon className="size-6 text-[var(--mkt-accent-text)]" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {BRAND.name} for {ind.audience}
              </h1>
              <p className="mkt-lead mt-4">{ind.summary}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow">
          <Reveal>
            <h2 className="mkt-h2 mb-4">The problem, plainly</h2>
            <p className="text-base leading-relaxed text-[var(--mkt-fg-muted)]">{ind.problem}</p>
          </Reveal>
        </div>
      </section>

      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container">
          <Reveal className="mb-8">
            <h2 className="mkt-h2">How the day runs on {BRAND.name}</h2>
          </Reveal>
          <div className="grid gap-px border border-[var(--mkt-line)] bg-[var(--mkt-line)] sm:grid-cols-2">
            {ind.day.map((d, i) => (
              <Reveal
                key={d.title}
                delay={Math.min(i * 55, 250)}
                className="border border-transparent bg-[var(--mkt-surface)] p-6"
              >
                <span className="text-xs font-bold text-[var(--mkt-accent-text)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-sm font-bold text-[var(--mkt-fg)]">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">{d.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <Reveal className="mb-6">
            <h2 className="mkt-h2">The modules doing the carrying</h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m, i) => (
              <Reveal key={m.slug} delay={i * 50}>
                <Link
                  href={`/modules/${m.slug}`}
                  className="mkt-lift block h-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5"
                >
                  <m.icon className="size-5 text-[var(--mkt-accent-text)]" />
                  <h3 className="mt-3 text-sm font-bold text-[var(--mkt-fg)]">{m.name}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--mkt-fg-muted)]">
                    {m.summary}
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container mkt-container-narrow">
          <Reveal className="mb-8">
            <h2 className="mkt-h2">Asked by {ind.audience}</h2>
          </Reveal>
          <div className="space-y-4">
            {ind.faq.map((f, i) => (
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

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <Reveal>
            <h2 className="mkt-h2 mb-4">Try it with your own numbers</h2>
            <p className="mkt-lead mb-8">
              Fourteen days, every module, the team size you choose — no card
              required.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={`${BRAND.appUrl}/signup`} className="mkt-btn mkt-btn-md mkt-btn-primary">
                Start free trial <ArrowRight className="size-4" />
              </Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-md mkt-btn-secondary">
                <CheckCircle2 className="size-4" /> See pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
