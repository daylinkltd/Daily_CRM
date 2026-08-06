import { BRAND } from "@/config/brand";

/**
 * Shared shell for legal pages.
 *
 * Plain prose in a narrow column, one H1, dated. These pages exist for
 * three readers — a cautious customer, Razorpay's live-mode reviewer, and
 * a lawyer — and all three want boring, findable text over marketing
 * design. Every section is server-rendered static HTML.
 */
export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <section className="mkt-section">
      <div className="mkt-container" style={{ maxWidth: "760px" }}>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--mkt-fg)]">{title}</h1>
        <p className="mt-2 text-xs text-[var(--mkt-fg-subtle)]">
          {BRAND.legalName} · Last updated {updated}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">{intro}</p>

        {sections.map((s, i) => (
          <div key={s.heading} className="mt-8">
            <h2 className="text-base font-bold text-[var(--mkt-fg)]">
              {i + 1}. {s.heading}
            </h2>
            {s.paragraphs.map((p, j) => (
              <p key={j} className="mt-3 text-sm leading-relaxed text-[var(--mkt-fg-muted)]">
                {p}
              </p>
            ))}
          </div>
        ))}

        <p className="mt-10 border-t border-[var(--mkt-line)] pt-6 text-xs text-[var(--mkt-fg-subtle)]">
          Questions about this document: {BRAND.contact.support} · Billing:{" "}
          {BRAND.payments.supportEmail} · {BRAND.legalName}, {BRAND.address.city},{" "}
          {BRAND.address.region}, India.
        </p>
      </div>
    </section>
  );
}
