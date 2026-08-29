"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * The contact form, posting to the same /api/prospects endpoint as the
 * sales modal — one lead path, one table, one place the admin console
 * reads. A second endpoint would just be a second place leads get lost.
 */
export function ContactForm() {
  const [form, setForm] = useState({
    full_name: "",
    company_name: "",
    email: "",
    phone: "",
    team_size: "",
    plan_interest: "business",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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
      if (!res.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
        <h3 className="mt-4 text-lg font-bold text-[var(--mkt-fg)]">Got it — we&apos;ll reply within one business day</h3>
        <p className="mt-2 text-sm text-[var(--mkt-fg-muted)]">
          Your message is with a person, not a queue. If it is urgent, email
          us directly and mention you filled the form.
        </p>
      </div>
    );
  }

  const inputCls =
    "h-11 w-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-3.5 text-sm text-[var(--mkt-fg)] placeholder:text-[var(--mkt-fg-subtle)] focus:border-[var(--mkt-accent-line)] focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          required
          value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          placeholder="Your name *"
          aria-label="Your name"
          className={inputCls}
        />
        <input
          required
          value={form.company_name}
          onChange={(e) => set("company_name", e.target.value)}
          placeholder="Company *"
          aria-label="Company"
          className={inputCls}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          required
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="Work email *"
          aria-label="Work email"
          className={inputCls}
        />
        <input
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="Phone / WhatsApp"
          aria-label="Phone or WhatsApp"
          className={inputCls}
        />
      </div>
      <NativeSelect
        value={form.team_size}
        onChange={(e) => set("team_size", e.target.value)}
        aria-label="Team size"
        className={inputCls}
      >
        <option value="">How many people work with you?</option>
        <option value="1-5">1–5</option>
        <option value="6-15">6–15</option>
        <option value="16-50">16–50</option>
        <option value="51+">51+</option>
      </NativeSelect>
      <textarea
        value={form.message}
        onChange={(e) => set("message", e.target.value)}
        placeholder="What are you trying to run — and on what today?"
        aria-label="Message"
        rows={4}
        className="w-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-3.5 py-3 text-sm text-[var(--mkt-fg)] placeholder:text-[var(--mkt-fg-subtle)] focus:border-[var(--mkt-accent-line)] focus:outline-none"
      />

      {error && <p className="text-sm text-rose-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mkt-btn mkt-btn-md mkt-btn-primary w-full disabled:opacity-60"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {submitting ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
