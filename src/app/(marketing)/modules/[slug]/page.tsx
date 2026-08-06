import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { MODULES, moduleBySlug } from "@/config/modules-content";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, breadcrumbSchema } from "@/lib/seo/structured-data";

/**
 * Statically generated from the registry, so every module page exists at
 * build time and is crawlable without JavaScript. `dynamicParams = false`
 * makes an unknown slug a real 404 rather than an on-demand render of an
 * empty page — a soft 404 is worse for indexing than a hard one.
 */
export function generateStaticParams() {
  return MODULES.map((m) => ({ slug: m.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mod = moduleBySlug(slug);
  if (!mod) return { title: { absolute: pageTitle("Module not found") } };

  const url = absoluteUrl(`/modules/${mod.slug}`);
  return {
    title: { absolute: pageTitle(mod.name) },
    description: mod.summary,
    alternates: { canonical: url },
    openGraph: {
    images: OG_IMAGES,
      title: `${mod.name} · ${BRAND.name}`,
      description: mod.summary,
      url,
      type: "website",
    },
  };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = moduleBySlug(slug);
  if (!mod) notFound();

  const Icon = mod.icon;
  const others = MODULES.filter((m) => m.slug !== mod.slug);

  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Modules", path: "/modules" },
      { name: mod.name, path: `/modules/${mod.slug}` },
    ]),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      <section className="mkt-hero mkt-section">
        <div className="mkt-container">
          {/* Visible breadcrumb, matching the structured data. */}
          <nav aria-label="Breadcrumb" className="mb-8">
            <Link
              href="/modules"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]"
            >
              <ArrowLeft className="size-3.5" />
              All modules
            </Link>
          </nav>

          <div className="max-w-3xl">
            <span
              data-enter
              className="inline-flex size-12 items-center justify-center border border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)]"
            >
              <Icon className="size-6 text-[var(--mkt-accent-text)]" />
            </span>

            <h1
              data-enter
              style={{ "--enter-delay": "80ms" } as React.CSSProperties}
              className="mt-6 text-[2.25rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
            >
              {mod.name}
            </h1>

            <p
              data-enter
              style={{ "--enter-delay": "160ms" } as React.CSSProperties}
              className="mkt-lead mt-5"
            >
              {mod.summary}
            </p>

            <p
              data-enter
              style={{ "--enter-delay": "220ms" } as React.CSSProperties}
              className="mt-6 border-l-2 border-[var(--mkt-accent-line)] pl-4 text-sm italic leading-relaxed text-[var(--mkt-fg-subtle)]"
            >
              {mod.problem}
            </p>
          </div>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      <section className="mkt-section">
        <div className="mkt-container">
          <Reveal className="mb-10">
            <h2 className="mkt-h2">What you get</h2>
          </Reveal>

          <div className="grid gap-px border border-[var(--mkt-line)] bg-[var(--mkt-line)] sm:grid-cols-2 lg:grid-cols-3">
            {mod.features.map((feature, i) => (
              <Reveal
                key={feature.title}
                delay={Math.min(i * 50, 300)}
                className="mkt-lift border border-transparent bg-[var(--mkt-surface)] p-6"
              >
                <h3 className="flex items-start gap-2 text-sm font-bold text-[var(--mkt-fg)]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  {feature.title}
                </h3>
                <p className="mt-2 pl-6 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                  {feature.body}
                </p>
              </Reveal>
            ))}
          </div>

          {mod.roadmap?.length ? (
            <Reveal className="mt-8 border border-dashed border-[var(--mkt-line)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
                In development
              </p>
              <ul className="mt-2 space-y-1">
                {mod.roadmap.map((item) => (
                  <li key={item} className="text-sm text-[var(--mkt-fg-muted)]">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[var(--mkt-fg-subtle)]">
                Listed so you can plan around it — these are not available today.
              </p>
            </Reveal>
          ) : null}
        </div>
      </section>

      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container">
          <Reveal className="mb-8">
            <h2 className="mkt-h2">It does not work alone</h2>
            <p className="mkt-lead mt-3 max-w-2xl">
              Every module in {BRAND.name} shares one database, so the work
              carries across instead of being re-keyed. These are included at
              the same price.
            </p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((other, i) => {
              const OtherIcon = other.icon;
              return (
                <Reveal key={other.slug} delay={Math.min(i * 60, 240)}>
                  <Link
                    href={`/modules/${other.slug}`}
                    className="mkt-lift flex h-full flex-col border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5"
                  >
                    <OtherIcon className="size-5 text-[var(--mkt-accent-text)]" />
                    <p className="mt-3 text-sm font-bold text-[var(--mkt-fg)]">{other.name}</p>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-[var(--mkt-fg-muted)]">
                      {other.summary}
                    </p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <Reveal>
            <h2 className="mkt-h2 mb-4">Start with {mod.name}</h2>
            <p className="mkt-lead mb-8">
              14 days free, every module unlocked, no card required.
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
