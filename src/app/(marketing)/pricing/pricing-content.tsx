"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { BRAND } from "@/config/brand";
import {
  PLANS,
  INCLUDED_MODULES,
  GST_RATE,
  seatRate,
  monthlyTotal,
  annualSavingPercent,
  type BillingPeriod,
} from "@/config/plans";
import { Reveal } from "@/components/marketing/reveal";
import { SalesModal } from "@/components/marketing/sales-modal";

/**
 * The interactive half of the pricing page.
 *
 * Split from page.tsx so the page itself stays a server component and can
 * export `metadata` and the JSON-LD — a "use client" page cannot do
 * either, and losing the metadata would defeat the point of the page.
 */
export function PricingContent({
  faq,
}: {
  faq: { question: string; answer: string }[];
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [seats, setSeats] = useState(5);
  const [salesOpen, setSalesOpen] = useState(false);

  const business = PLANS.find((p) => p.id === "business")!;
  const trial = PLANS.find((p) => p.id === "free")!;
  const enterprise = PLANS.find((p) => p.id === "custom")!;


  return (
    <>
      <section className="mkt-hero mkt-section">
        <div className="mkt-container mkt-container-narrow text-center">
          <div data-enter className="mkt-eyebrow mb-5">
            One price per person
          </div>
          <h1
            data-enter
            style={{ "--enter-delay": "80ms" } as React.CSSProperties}
            className="text-[2.25rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
          >
            Every module. One price per person.
          </h1>
          <p
            data-enter
            style={{ "--enter-delay": "160ms" } as React.CSSProperties}
            className="mkt-lead mt-5"
          >
            No module upsells, no feature gates, no per-integration fees. Add
            people as you grow and the bill follows. Per-seat prices exclude
            GST; totals below show it added.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-1 border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-1">
            {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`mkt-btn mkt-btn-sm relative ${
                  period === p
                    ? "mkt-btn-primary"
                    : "text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]"
                }`}
              >
                {p === "monthly" ? "Monthly" : "Annual"}
                {p === "annual" && (
                  <span className="absolute -top-3.5 -right-5 bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#06131f]">
                    Save {annualSavingPercent(business)}%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Seat calculator */}
          <div className="mx-auto mt-8 max-w-md border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-5">
            <div className="flex items-baseline justify-between gap-4">
              <label
                htmlFor="seats"
                className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]"
              >
                How many people?
              </label>
              <span className="text-sm font-bold text-[var(--mkt-fg)]">
                {seats} {seats === 1 ? "person" : "people"}
              </span>
            </div>
            <input
              id="seats"
              type="range"
              min={1}
              max={50}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
            <p className="mt-3 text-center">
              <span className="text-3xl font-extrabold text-[var(--mkt-fg)]">
                ₹{monthlyTotal(business, seats, period).toLocaleString()}
              </span>
              <span className="text-xs text-[var(--mkt-fg-muted)]">
                {" "}
                /month, all modules
              </span>
            </p>
            {/* The number a buyer's card is actually charged. Quoting only
                the ex-GST figure reads as a bait-and-switch at checkout,
                which is a worse first impression than an 18% bigger number
                on the pricing page. */}
            <p className="mt-1 text-center text-[11px] text-[var(--mkt-fg-subtle)]">
              ₹
              {Math.round(
                monthlyTotal(business, seats, period) * (1 + GST_RATE),
              ).toLocaleString()}{" "}
              incl. 18% GST
            </p>
          </div>
        </div>
      </section>

      <div className="mkt-container"><div className="mkt-rule" /></div>

      {/* Plans */}
      <section className="mkt-section">
        <div className="mkt-container grid gap-5 lg:grid-cols-3">
          {[trial, business, enterprise].map((plan, i) => {
            const isTrial = plan.id === "free";
            const isEnterprise = plan.id === "custom";
            const rate = seatRate(plan, period);
            // Solo is capped at one user, so it must never be linked with the
            // calculator's seat count — checkout rejects seats above the cap.
            const linkSeats = plan.maxUsers ? Math.min(seats, plan.maxUsers) : seats;

            return (
              <Reveal
                key={plan.id}
                delay={i * 70}
                className={`flex h-full flex-col border p-7 ${
                  plan.isRecommended
                    ? "border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)]"
                    : "mkt-lift border-[var(--mkt-line)] bg-[var(--mkt-surface)]"
                }`}
              >
                <h2 className="text-base font-extrabold text-[var(--mkt-fg)]">
                  {plan.name}
                </h2>
                <p className="mt-1 text-xs text-[var(--mkt-fg-subtle)]">{plan.tagline}</p>

                <p className="mt-5">
                  <span className="text-4xl font-extrabold text-[var(--mkt-fg)]">
                    {isTrial ? "₹0" : isEnterprise ? "Custom" : `₹${rate.toLocaleString()}`}
                  </span>
                  {!isTrial && !isEnterprise && (
                    <span className="text-xs text-[var(--mkt-fg-subtle)]">
                      {/* "per user" on a one-user plan reads like there is a
                          second user to buy. There is not. */}
                      {plan.maxUsers === 1 ? " /month" : " /user/month"}
                    </span>
                  )}
                  {isTrial && <span className="text-xs text-[var(--mkt-fg-subtle)]"> /14 days</span>}
                </p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--mkt-fg-muted)]">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isEnterprise ? (
                  <button
                    type="button"
                    onClick={() => setSalesOpen(true)}
                    className="mkt-btn mkt-btn-md mkt-btn-secondary mt-7 w-full"
                  >
                    Talk to sales
                  </button>
                ) : (
                  <Link
                    href={`${BRAND.appUrl}/signup?plan=${plan.id}&cycle=${period}&seats=${linkSeats}`}
                    className={`mkt-btn mkt-btn-md mt-7 w-full ${
                      plan.isRecommended ? "mkt-btn-primary" : "mkt-btn-secondary"
                    }`}
                  >
                    {isTrial ? "Start free trial" : "Subscribe"}
                    <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* What's included */}
      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container">
          <Reveal className="mb-10 text-center">
            <h2 className="mkt-h2">In every paid seat</h2>
          </Reveal>
          <div className="grid gap-px border border-[var(--mkt-line)] bg-[var(--mkt-line)] sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED_MODULES.map((item, i) => (
              <Reveal
                key={item}
                delay={Math.min(i * 40, 320)}
                className="flex items-start gap-3 border border-transparent bg-[var(--mkt-surface)] p-5"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <span className="text-sm text-[var(--mkt-fg-muted)]">{item}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — same entries the JSON-LD publishes. */}
      <section className="mkt-section">
        <div className="mkt-container mkt-container-narrow">
          <Reveal className="mb-10 text-center">
            <h2 className="mkt-h2">Pricing questions</h2>
          </Reveal>
          <div className="space-y-4">
            {faq.map((item, i) => (
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

      <SalesModal
        open={salesOpen}
        onClose={() => setSalesOpen(false)}
        defaultPlan="custom"
      />
    </>
  );
}
