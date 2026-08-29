"use client";

import { useState } from "react";
import {
  X,
  CheckCircle2,
  Users,
  Building2,
  Mail,
  Phone,
  ChevronDown,
  Send,
} from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";



/**
 * Lead capture for "Talk to sales".
 *
 * Lifted out of the old single-page landing so every marketing page can
 * open it. It posts to /api/prospects, which is the only lead path the
 * product has — losing it in the rebuild would have quietly turned off
 * inbound sales.
 */
export function SalesModal({
  open,
  onClose,
  defaultPlan,
}: {
  open: boolean;
  onClose: () => void;
  defaultPlan: "growth" | "custom";
}) {
  const [form, setForm] = useState({
    full_name: "",
    company_name: "",
    email: "",
    phone: "",
    team_size: "",
    plan_interest: defaultPlan,
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Something went wrong. Please try again."); return; }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] shadow-[var(--mkt-shadow)] animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--mkt-line-soft)] p-6 pb-5">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--mkt-fg)]">Talk to Sales</h2>
            <p className="text-sm text-[var(--mkt-fg-muted)] mt-0.5">We&apos;ll get back to you within 24 hours</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mkt-accent-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/40 mb-5">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-[var(--mkt-fg)] mb-2">Request Submitted!</h3>
            <p className="text-[var(--mkt-fg-muted)] text-sm mb-6">
              Thanks, <strong className="text-[var(--mkt-fg)]">{form.full_name.split(" ")[0]}</strong>! Our team will reach out to{" "}
              <strong className="text-[var(--mkt-accent-text)]">{form.email}</strong> within 24 hours.
            </p>
            <button onClick={onClose} className="mkt-btn mkt-btn-secondary mkt-btn-md">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--mkt-fg-muted)] uppercase tracking-wider">Full Name *</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--mkt-fg-subtle)]" />
                  <input
                    required
                    placeholder="Jane Smith"
                    value={form.full_name}
                    onChange={e => set("full_name", e.target.value)}
                    className="mkt-field w-full pl-9 pr-3 py-2.5"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--mkt-fg-muted)] uppercase tracking-wider">Company *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--mkt-fg-subtle)]" />
                  <input
                    required
                    placeholder="Acme Corp"
                    value={form.company_name}
                    onChange={e => set("company_name", e.target.value)}
                    className="mkt-field w-full pl-9 pr-3 py-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--mkt-fg-muted)] uppercase tracking-wider">Work Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--mkt-fg-subtle)]" />
                <input
                  required
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  className="mkt-field w-full pl-9 pr-3 py-2.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--mkt-fg-muted)] uppercase tracking-wider">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--mkt-fg-subtle)]" />
                  <input
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={e => set("phone", e.target.value)}
                    className="mkt-field w-full pl-9 pr-3 py-2.5"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--mkt-fg-muted)] uppercase tracking-wider">Team Size</label>
                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--mkt-fg-subtle)] pointer-events-none" />
                  <NativeSelect
                    value={form.team_size}
                    onChange={e => set("team_size", e.target.value)}
                    className="mkt-field w-full appearance-none px-3 py-2.5"
                  >
                    <option value="">Select...</option>
                    <option value="1-5">1–5</option>
                    <option value="6-15">6–15</option>
                    <option value="16-50">16–50</option>
                    <option value="50+">50+</option>
                  </NativeSelect>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--mkt-fg-muted)] uppercase tracking-wider">Plan Interest</label>
              <div className="grid grid-cols-2 gap-2">
                {(["growth", "custom"] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("plan_interest", p)}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mkt-accent-text)] ${
                      form.plan_interest === p
                        ? "border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)] text-[var(--mkt-accent-text)]"
                        : "border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]"
                    }`}
                  >
                    {p === "growth" ? "Growth — $20/mo" : "Custom Solution"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--mkt-fg-muted)] uppercase tracking-wider">Message</label>
              <textarea
                rows={3}
                placeholder="Tell us about your use case, current tools, or any specific requirements..."
                value={form.message}
                onChange={e => set("message", e.target.value)}
                className="mkt-field w-full px-4 py-3 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mkt-btn mkt-btn-primary mkt-btn-md w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Submit Request
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
