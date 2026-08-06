import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { INDUSTRIES } from "@/config/industries-content";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, breadcrumbSchema } from "@/lib/seo/structured-data";

const DESCRIPTION = `How ${BRAND.name} runs a retail store, an agency, a distribution business or a clinic — the same modules, mapped to each business's actual day.`;

export const metadata: Metadata = {
  title: { absolute: pageTitle("Industries") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/industries") },
  openGraph: {
    images: OG_IMAGES,
    title: pageTitle("Industries"),
    description: DESCRIPTION,
    url: absoluteUrl("/industries"),
    type: "website",
  },
};

export default function IndustriesPage() {
  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Industries", path: "/industries" },
    ]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: graph }}
      />

      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <div data-enter className="mkt-eyebrow mb-5">
            Built for how you actually work
          </div>
          <h1
            data-enter
            style={{ "--enter-delay": "80ms" } as React.CSSProperties}
            className="text-[2.25rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
          >
            One system, four very different days
          </h1>
          <p
            data-enter
            style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            className="mkt-lead mt-5"
          >
            The modules are the same; the day they carry is not. Pick the
            business that looks like yours and see where each piece lands.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container grid gap-5 sm:grid-cols-2">
          {INDUSTRIES.map((ind, i) => (
            <Reveal
              key={ind.slug}
              delay={i * 60}
              className="mkt-lift border border-[var(--mkt-line)] bg-[var(--mkt-surface)]"
            >
              <Link href={`/industries/${ind.slug}`} className="block p-7">
                <ind.icon className="size-6 text-[var(--mkt-accent-text)]" />
                <h2 className="mt-4 text-lg font-extrabold text-[var(--mkt-fg)]">
                  {ind.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                  {ind.summary}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--mkt-accent-text)]">
                  See the full day <ArrowRight className="size-3.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
