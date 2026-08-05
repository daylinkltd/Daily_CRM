"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

import { BRAND } from "@/config/brand";
import { MODULES } from "@/config/modules-content";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/modules", label: "Modules" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Shared header for every marketing page.
 *
 * Real <Link> navigation rather than the single-page anchor scrolling the
 * old landing page used: separate URLs are what let /modules and /pricing
 * be indexed, linked and quoted independently — which is the entire point
 * of splitting the site up.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--mkt-line)] bg-[color-mix(in_oklab,var(--mkt-canvas)_88%,transparent)] backdrop-blur">
      <div className="mkt-container flex h-16 items-center justify-between gap-4 px-6">
        <Link href="/" className="text-base font-extrabold tracking-tight text-[var(--mkt-fg)]">
          {BRAND.name}
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "text-[var(--mkt-fg)]"
                  : "text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href={`${BRAND.appUrl}/login`}
            className="hidden px-3 py-2 text-sm font-medium text-[var(--mkt-fg-muted)] transition-colors hover:text-[var(--mkt-fg)] sm:inline-flex"
          >
            Sign in
          </Link>
          <Link href={`${BRAND.appUrl}/signup`} className="mkt-btn mkt-btn-sm mkt-btn-primary">
            Start free
            <ArrowRight className="size-3.5" />
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center border border-[var(--mkt-line)] text-[var(--mkt-fg-muted)] md:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-[var(--mkt-line)] bg-[var(--mkt-canvas)] md:hidden">
          <div className="mkt-container flex flex-col px-6 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-[var(--mkt-line-soft)] py-3 text-sm font-medium text-[var(--mkt-fg-muted)] last:border-0"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--mkt-line)] bg-[var(--mkt-band)]">
      <div className="mkt-container px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-base font-extrabold text-[var(--mkt-fg)]">{BRAND.name}</p>
            <p className="mt-2 max-w-xs text-sm text-[var(--mkt-fg-muted)]">
              {BRAND.tagline}. Built in {BRAND.address.city} for Indian businesses.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
              Modules
            </p>
            <ul className="mt-3 space-y-2">
              {MODULES.map((m) => (
                <li key={m.slug}>
                  <Link
                    href={`/modules/${m.slug}`}
                    className="text-sm text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]"
                  >
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
              Product
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/modules" className="text-sm text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]">
                  All modules
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]">
                  Pricing
                </Link>
              </li>
              <li>
                <a
                  href={`${BRAND.appUrl}/signup`}
                  className="text-sm text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]"
                >
                  Start free trial
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mkt-fg-subtle)]">
              Contact
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  href={`mailto:${BRAND.contact.sales}`}
                  className="text-sm text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]"
                >
                  {BRAND.contact.sales}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${BRAND.contact.support}`}
                  className="text-sm text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]"
                >
                  {BRAND.contact.support}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--mkt-line)] pt-6 text-xs text-[var(--mkt-fg-subtle)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {BRAND.foundingYear}–2026 {BRAND.legalName}. All rights reserved.
          </p>
          <p>Prices exclude GST. {BRAND.address.city}, {BRAND.address.region}, India.</p>
        </div>
      </div>
    </footer>
  );
}
