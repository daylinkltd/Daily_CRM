import type { Metadata } from "next";
import { Mail, MapPin, LifeBuoy, CreditCard } from "lucide-react";

import { BRAND, absoluteUrl, pageTitle, OG_IMAGES } from "@/config/brand";
import { Reveal } from "@/components/marketing/reveal";
import { jsonLdGraph, breadcrumbSchema } from "@/lib/seo/structured-data";
import { ContactForm } from "./contact-form";

const DESCRIPTION = `Talk to the ${BRAND.name} team — sales, support and billing, answered from ${BRAND.address.city}, India within one business day.`;

export const metadata: Metadata = {
  title: { absolute: pageTitle("Contact") },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/contact") },
  openGraph: {
    images: OG_IMAGES,
    title: pageTitle("Contact"),
    description: DESCRIPTION,
    url: absoluteUrl("/contact"),
    type: "website",
  },
};

const CHANNELS = [
  {
    icon: Mail,
    label: "Sales",
    value: BRAND.contact.sales,
    note: "Pricing, demos, migrations",
  },
  {
    icon: LifeBuoy,
    label: "Support",
    value: BRAND.contact.support,
    note: "Anything inside the product",
  },
  {
    icon: CreditCard,
    label: "Billing",
    value: BRAND.payments.supportEmail,
    note: "Payments are processed by Daylink",
  },
];

export default function ContactPage() {
  const graph = jsonLdGraph([
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Contact", path: "/contact" },
    ]),
    {
      "@type": "ContactPage",
      "@id": absoluteUrl("/contact"),
      url: absoluteUrl("/contact"),
      name: `Contact ${BRAND.name}`,
      description: DESCRIPTION,
    },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />

      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <div data-enter className="mkt-eyebrow mb-5">
            <MapPin className="size-3" /> {BRAND.address.city}, {BRAND.address.region}
          </div>
          <h1
            data-enter
            style={{ "--enter-delay": "80ms" } as React.CSSProperties}
            className="text-[2.25rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
          >
            Talk to a person
          </h1>
          <p
            data-enter
            style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            className="mkt-lead mt-5"
          >
            We answer our own email, within one business day. Tell us what you
            run and what it runs on today.
          </p>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      <section className="mkt-section">
        <div className="mkt-container grid gap-10 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <ContactForm />
          </Reveal>
          <div className="space-y-4 lg:col-span-2">
            {CHANNELS.map((c, i) => (
              <Reveal
                key={c.label}
                delay={i * 60}
                className="border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5"
              >
                <c.icon className="size-5 text-[var(--mkt-accent-text)]" />
                <h2 className="mt-3 text-sm font-bold text-[var(--mkt-fg)]">{c.label}</h2>
                <a
                  href={`mailto:${c.value}`}
                  className="mt-1 block text-sm font-semibold text-[var(--mkt-accent-text)] underline underline-offset-2"
                >
                  {c.value}
                </a>
                <p className="mt-1 text-xs text-[var(--mkt-fg-subtle)]">{c.note}</p>
              </Reveal>
            ))}
            <Reveal delay={200} className="border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5">
              <h2 className="text-sm font-bold text-[var(--mkt-fg)]">{BRAND.legalName}</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--mkt-fg-muted)]">
                {BRAND.address.city}, {BRAND.address.region}, India
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
