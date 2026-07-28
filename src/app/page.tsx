"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/config/plans";
import {
  ArrowRight, MessageSquare, Zap, BarChart3, Users,
  Bot, Globe, Shield, CheckCircle2, ChevronRight, Sparkles,
  PhoneCall, Mail, Star, TrendingUp, Clock, Lock,
  X, Send, Phone, Building2, ChevronDown,
} from "lucide-react";

// ── Feature data ──────────────────────────────────────────────────────────────
const features = [
  {
    icon: MessageSquare,
    title: "Unified Inbox",
    desc: "WhatsApp, Instagram, Messenger, and Email — all in one lightning-fast inbox. No tab-switching.",
    color: "#0284C7",
  },
  {
    icon: Bot,
    title: "Smart Automations",
    desc: "Build no-code workflows that qualify leads, send follow-ups, and assign conversations automatically.",
    color: "#a855f7",
  },
  {
    icon: TrendingUp,
    title: "Visual Pipelines",
    desc: "Kanban-style deal boards with drag-and-drop stages, custom fields, and automated stage progression.",
    color: "#10b981",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    desc: "Track response times, team performance, conversion rates, and revenue attribution in real-time.",
    color: "#f59e0b",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    desc: "Role-based access control, workspace isolation, and real-time presence — built for growing teams.",
    color: "#ec4899",
  },
  {
    icon: Globe,
    title: "Multi-Workspace",
    desc: "Manage multiple brands or clients from a single account with complete data isolation between tenants.",
    color: "#0284C7",
  },
];

// ── Channels ──────────────────────────────────────────────────────────────────
const channels = [
  { label: "WhatsApp", icon: PhoneCall, color: "#25D366" },
  { label: "Instagram", icon: Sparkles, color: "#E1306C" },
  { label: "Messenger", icon: MessageSquare, color: "#0078FF" },
  { label: "Email", icon: Mail, color: "#0284C7" },
];

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = [
  { value: "10K+", label: "Messages / day" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "< 2min", label: "Avg response time" },
  { value: "4.9★", label: "Client satisfaction" },
];

// ── Testimonials ──────────────────────────────────────────────────────────────
const testimonials = [
  {
    stars: 5,
    text: "Daily CRM cut our WhatsApp response time by 70%. The automation builder is genuinely game-changing.",
    name: "Priya Sharma",
    title: "Head of Sales, GrowthStack",
    avatar: "PS",
    color: "#0284C7",
  },
  {
    stars: 5,
    text: "We manage 3 brands from one dashboard now. The workspace isolation is exactly what we needed.",
    name: "Arjun Mehta",
    title: "Co-founder, BrandHive",
    avatar: "AM",
    color: "#a855f7",
  },
  {
    stars: 5,
    text: "Moved from 5 different tools to Daily CRM. The team is faster, happier, and our clients love it.",
    name: "Sarah Chen",
    title: "Head of Sales, GrowthStack",
    avatar: "SC",
    color: "#10b981",
  },
];



// ── Sales Modal ───────────────────────────────────────────────────────────────
function SalesModal({
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
                  <select
                    value={form.team_size}
                    onChange={e => set("team_size", e.target.value)}
                    className="mkt-field w-full appearance-none px-3 py-2.5"
                  >
                    <option value="">Select...</option>
                    <option value="1-5">1–5</option>
                    <option value="6-15">6–15</option>
                    <option value="16-50">16–50</option>
                    <option value="50+">50+</option>
                  </select>
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlan, setModalPlan] = useState<"growth" | "custom">("growth");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
      }
    };
    checkUser();
  }, []);

  const openModal = (plan: "growth" | "custom" = "growth") => {
    setModalPlan(plan);
    setModalOpen(true);
  };

  return (
    <div className="marketing min-h-screen bg-[var(--mkt-canvas)] text-[var(--mkt-fg)] overflow-x-hidden">
      <SalesModal open={modalOpen} onClose={() => setModalOpen(false)} defaultPlan={modalPlan} />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[var(--mkt-line-soft)] bg-[var(--mkt-canvas)]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1152px] items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center">
            <Image
              src="/logolight.png"
              alt="Daily CRM"
              width={140}
              height={36}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="mkt-link">Features</a>
            <a href="#channels" className="mkt-link">Channels</a>
            <a href="#pricing" className="mkt-link">Pricing</a>
            <a href="#testimonials" className="mkt-link">Reviews</a>
          </nav>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/dashboard" className="mkt-btn mkt-btn-primary mkt-btn-sm">
                Go to Dashboard <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="mkt-link hidden sm:block text-sm font-medium">
                  Sign in
                </Link>
                <button
                  onClick={() => openModal("growth")}
                  className="mkt-btn mkt-btn-primary mkt-btn-sm"
                >
                  Contact Sales <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-20 pb-24 sm:pt-24 sm:pb-28 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full bg-primary/12 blur-[130px]" />
          <div className="absolute top-40 left-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[110px]" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 100%)",
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-[1152px] mx-auto">
          <div className="mkt-eyebrow mb-8 border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)] text-[var(--mkt-accent-text)]">
            <Sparkles className="h-3.5 w-3.5" />
            Omni-Channel CRM — WhatsApp · Instagram · Email · Messenger
          </div>

          <h1 className="text-[2.5rem] sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.06] mb-6 text-[var(--mkt-fg)]">
            The CRM that{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-primary via-[#44c8ff] to-[#a78bfa] bg-clip-text text-transparent">
                closes deals
              </span>
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-[#a78bfa] opacity-60 rounded-full" />
            </span>{" "}
            <br className="hidden sm:block" />
            across every channel.
          </h1>

          <p className="mkt-lead max-w-2xl mx-auto mb-10 sm:text-xl">
            Unify WhatsApp, Instagram, Email &amp; Messenger into one intelligent inbox.
            Automate repetitive tasks, track pipelines, and give your team superpowers.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            {isLoggedIn ? (
              <Link href="/dashboard" className="mkt-btn mkt-btn-primary mkt-btn-lg">
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <button
                  onClick={() => openModal("growth")}
                  className="mkt-btn mkt-btn-primary mkt-btn-lg"
                >
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </button>
                <Link href="/login" className="mkt-btn mkt-btn-secondary mkt-btn-lg">
                  Sign In
                </Link>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-y-8 sm:flex sm:flex-wrap sm:justify-center sm:gap-16">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold text-[var(--mkt-fg)]">{s.value}</div>
                <div className="text-xs text-[var(--mkt-fg-subtle)] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard mockup — an opaque, high-contrast product screenshot */}
        <div className="relative z-10 mt-16 sm:mt-20 max-w-[1024px] mx-auto w-full">
          <div className="mkt-mock relative text-left">
            {/* Window chrome */}
            <div className="mkt-mock__chrome flex items-center gap-3 px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex items-center gap-1.5 rounded-md border border-[var(--mkt-line-soft)] bg-[var(--mkt-canvas)] px-3 py-1">
                  <Lock className="h-2.5 w-2.5 text-[var(--mkt-fg-subtle)]" />
                  <span className="text-[10px] text-[var(--mkt-fg-muted)]">app.daylink.in/dashboard</span>
                </div>
              </div>
              <div className="w-12 hidden sm:block" />
            </div>

            {/* App body */}
            <div className="grid grid-cols-12 min-h-[300px] sm:min-h-[380px]">
              {/* Rail */}
              <div className="mkt-mock__rail hidden sm:flex sm:col-span-3 lg:col-span-2 flex-col gap-1 p-3">
                <div className="flex items-center gap-2 px-1.5 pb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-extrabold text-primary-foreground">
                    D
                  </div>
                  <span className="text-[11px] font-bold text-[var(--mkt-fg)] truncate">Daily CRM</span>
                </div>
                {[
                  { label: "Inbox", icon: MessageSquare },
                  { label: "Contacts", icon: Users },
                  { label: "Pipeline", icon: TrendingUp },
                  { label: "Automations", icon: Bot },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                      i === 0 ? "bg-primary/20 text-[var(--mkt-fg)]" : "text-[var(--mkt-fg-subtle)]"
                    }`}
                  >
                    <item.icon className={`h-3.5 w-3.5 shrink-0 ${i === 0 ? "text-[var(--mkt-accent-text)]" : ""}`} />
                    <span className="text-[11px] font-medium truncate">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Conversation list */}
              <div className="mkt-mock__list col-span-5 sm:col-span-4 lg:col-span-3 p-2.5">
                <div className="flex items-center justify-between px-1.5 pb-2">
                  <span className="text-[11px] font-bold text-[var(--mkt-fg)]">Inbox</span>
                  <span className="rounded-full bg-primary px-1.5 py-px text-[9px] font-bold text-primary-foreground">
                    12
                  </span>
                </div>
                <div className="space-y-1">
                  {[
                    { color: "#25D366", name: "Riya S.", preview: "Can you share pricing?", time: "2m" },
                    { color: "#E1306C", name: "Arjun M.", preview: "Loved the demo call", time: "18m" },
                    { color: "#0284C7", name: "Priya K.", preview: "Invoice attached", time: "1h" },
                    { color: "#25D366", name: "Karan V.", preview: "Thanks, sorted!", time: "3h" },
                  ].map((conv, i) => (
                    <div
                      key={conv.name}
                      className={`flex items-center gap-2 rounded-md p-1.5 ${
                        i === 0 ? "bg-[var(--mkt-surface-2)]" : ""
                      }`}
                    >
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                        style={{ background: conv.color, color: "#06131f" }}
                      >
                        {conv.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[10px] font-semibold text-[var(--mkt-fg)] truncate">{conv.name}</span>
                          <span className="text-[9px] text-[var(--mkt-fg-subtle)] shrink-0 hidden lg:inline">{conv.time}</span>
                        </div>
                        <div className="text-[9px] text-[var(--mkt-fg-subtle)] truncate">{conv.preview}</div>
                      </div>
                      {i < 2 && (
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Thread */}
              <div className="mkt-mock__thread col-span-7 sm:col-span-5 lg:col-span-4 flex flex-col p-3">
                <div className="flex items-center gap-2 border-b border-[var(--mkt-line-soft)] pb-2.5">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ background: "#25D366", color: "#06131f" }}
                  >
                    R
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-[var(--mkt-fg)] truncate">Riya Sharma</div>
                    <div className="flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-[#25D366]" />
                      <span className="text-[9px] text-[var(--mkt-fg-subtle)]">WhatsApp</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-end space-y-2 py-3">
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-[var(--mkt-surface-2)] px-2.5 py-1.5">
                      <p className="text-[10px] leading-snug text-[var(--mkt-fg)]">
                        Hi! Can you share pricing for a 6-person team?
                      </p>
                      <span className="text-[8px] text-[var(--mkt-fg-subtle)]">10:24</span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-xl rounded-br-sm bg-primary px-2.5 py-1.5">
                      <p className="text-[10px] leading-snug text-primary-foreground">
                        Sure — sending the Growth plan breakdown now.
                      </p>
                      <span className="text-[8px] text-primary-foreground/75">10:25</span>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-[var(--mkt-surface-2)] px-2.5 py-1.5">
                      <p className="text-[10px] leading-snug text-[var(--mkt-fg)]">
                        Perfect, that works. Let&apos;s get started.
                      </p>
                      <span className="text-[8px] text-[var(--mkt-fg-subtle)]">10:27</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-[var(--mkt-line)] bg-[var(--mkt-surface)] px-2.5 py-1.5">
                  <span className="flex-1 text-[10px] text-[var(--mkt-fg-subtle)]">Type a reply…</span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary">
                    <Send className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                </div>
              </div>

              {/* Aside */}
              <div className="mkt-mock__aside hidden lg:flex lg:col-span-3 flex-col gap-3 p-3">
                <div>
                  <div className="mb-2 text-[11px] font-bold text-[var(--mkt-fg)]">Pipeline</div>
                  <div className="space-y-1.5 rounded-lg border border-[var(--mkt-line-soft)] bg-[var(--mkt-surface)] p-2.5">
                    {[
                      { stage: "New Lead", value: "₹4.2L", pct: 70, color: "#0284C7" },
                      { stage: "Proposal Sent", value: "₹2.8L", pct: 45, color: "#a855f7" },
                      { stage: "Negotiating", value: "₹3.1L", pct: 55, color: "#f59e0b" },
                    ].map((row) => (
                      <div key={row.stage}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[9px] text-[var(--mkt-fg-muted)] truncate">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: row.color }} />
                            {row.stage}
                          </span>
                          <span className="text-[9px] font-bold text-[var(--mkt-fg)] shrink-0">{row.value}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--mkt-surface-2)]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: row.pct + "%", background: row.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-emerald-300" />
                    <span className="text-[10px] font-bold text-emerald-300">Automation active</span>
                  </div>
                  <p className="text-[9px] leading-snug text-[var(--mkt-fg-muted)]">
                    Auto-reply + lead scoring running on 4 channels.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-24 w-3/4 bg-primary/15 blur-[70px] pointer-events-none rounded-full" />
        </div>
      </section>

      {/* ── CHANNEL LOGOS ─────────────────────────────────────────────────── */}
      <section id="channels" className="mkt-band-surface px-6 py-16 sm:py-20">
        <div className="mkt-container">
          <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[var(--mkt-fg-muted)] mb-8">
            Connect every channel you already use
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {channels.map((ch) => (
              <div
                key={ch.label}
                className="mkt-chip"
                style={{ "--ch": ch.color } as React.CSSProperties}
              >
                <span className="mkt-chip__icon">
                  <ch.icon className="h-4 w-4" />
                </span>
                <span className="mkt-chip__label">{ch.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" className="mkt-section">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-0 h-[500px] w-[500px] rounded-full bg-violet-600/6 blur-[130px]" />
          <div className="absolute top-1/2 right-0 h-[400px] w-[400px] rounded-full bg-primary/6 blur-[110px]" />
        </div>

        <div className="mkt-container">
          <div className="text-center mb-14">
            <div className="mkt-eyebrow mb-4">
              <Sparkles className="h-3 w-3 text-violet-300" /> Everything you need
            </div>
            <h2 className="mkt-h2 mb-4">
              Built for teams that{" "}
              <span className="bg-gradient-to-r from-primary to-[#a78bfa] bg-clip-text text-transparent">
                move fast
              </span>
            </h2>
            <p className="mkt-lead max-w-2xl mx-auto">
              Every feature designed to reduce manual work, speed up responses, and give your team a competitive edge.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="mkt-card mkt-card-hover p-6 sm:p-7">
                <div
                  className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border"
                  style={{ background: f.color + "22", borderColor: f.color + "4d" }}
                >
                  <f.icon className="h-6 w-6" style={{ color: f.color }} />
                </div>
                <h3 className="text-lg font-bold text-[var(--mkt-fg)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--mkt-fg-muted)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="mkt-section mkt-band-surface">
        <div className="mkt-container">
          <div className="text-center mb-14">
            <h2 className="mkt-h2 mb-3">
              Up and running in{" "}
              <span className="text-[var(--mkt-accent-text)]">minutes</span>
            </h2>
            <p className="mkt-lead">
              No complex setup. Connect, configure, and start closing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-[var(--mkt-line)] to-transparent" />
            {[
              { step: "01", icon: Globe, title: "Connect Channels", desc: "Link your WhatsApp Business API, Instagram, Facebook Page, and email in one click.", color: "#0284C7" },
              { step: "02", icon: Zap, title: "Configure Automations", desc: "Set up lead qualification, auto-responses, and team routing with our visual builder.", color: "#a855f7" },
              { step: "03", icon: TrendingUp, title: "Close More Deals", desc: "Your team works in a unified inbox while analytics track every conversion.", color: "#10b981" },
            ].map((item) => (
              <div key={item.step} className="relative text-center group">
                <div
                  className="relative z-10 mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border bg-[var(--mkt-surface)] transition-transform group-hover:scale-105"
                  style={{ borderColor: item.color + "59" }}
                >
                  <item.icon className="h-7 w-7" style={{ color: item.color }} />
                </div>
                <div className="text-xs font-extrabold tracking-[0.2em] mb-2" style={{ color: item.color }}>{item.step}</div>
                <h3 className="text-lg font-bold text-[var(--mkt-fg)] mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--mkt-fg-muted)] leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section id="testimonials" className="mkt-section">
        <div className="mkt-container">
          <div className="text-center mb-14">
            <div className="mkt-eyebrow mb-4">
              <Star className="h-3 w-3 fill-current text-amber-300" /> Loved by teams
            </div>
            <h2 className="mkt-h2">Real results, real teams</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="mkt-card mkt-card-hover flex flex-col p-6 sm:p-7">
                <div className="flex mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-[var(--mkt-fg-muted)] text-sm leading-relaxed mb-6 flex-1">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 border-t border-[var(--mkt-line-soft)] pt-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shrink-0"
                    style={{ background: t.color + "33", color: t.color }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--mkt-fg)]">{t.name}</div>
                    <div className="text-xs text-[var(--mkt-fg-subtle)]">{t.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="mkt-section mkt-band-surface">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/6 blur-[150px]" />
        </div>

        <div className="mkt-container">
          <div className="text-center mb-14">
            <div className="mkt-eyebrow mb-4 border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)] text-[var(--mkt-accent-text)]">
              <Lock className="h-3 w-3" /> Flat-Fee CRM Plans
            </div>
            <h2 className="mkt-h2 mb-3">Simple, transparent pricing</h2>
            <p className="mkt-lead">Flat rate per team. No seat pricing. Prices exclude GST.</p>

            {/* Monthly/Annual Toggle */}
            <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`mkt-btn mkt-btn-sm ${
                  billingCycle === 'monthly'
                    ? 'mkt-btn-primary'
                    : 'text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`mkt-btn mkt-btn-sm relative ${
                  billingCycle === 'annual'
                    ? 'mkt-btn-primary'
                    : 'text-[var(--mkt-fg-muted)] hover:text-[var(--mkt-fg)]'
                }`}
              >
                Annual
                <span className="absolute -top-3.5 -right-5 px-1.5 py-0.5 bg-emerald-500 text-[#06131f] text-[9px] font-bold rounded-full uppercase tracking-wider">
                  2 Months Free
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-5 mx-auto justify-center">
            {PLANS.map((plan) => {
              const isFree = plan.priceMonthly === 0;
              const isCustom = plan.priceMonthly === -1;
              const displayPrice = isFree
                ? "₹0"
                : isCustom
                ? "Custom"
                : billingCycle === "annual"
                ? `₹${plan.priceYearly.toLocaleString()}`
                : `₹${plan.priceMonthly.toLocaleString()}`;
              const periodLabel = isFree
                ? "/14 days"
                : isCustom
                ? ""
                : billingCycle === "annual"
                ? "/year"
                : "/month";

              const handleAction = () => {
                if (isLoggedIn) {
                  if (plan.ctaType === 'contact') {
                    openModal('custom');
                  } else {
                    window.location.href = `/settings?tab=billing`;
                  }
                } else {
                  if (plan.ctaType === 'trial') {
                    window.location.href = `/signup?plan=free`;
                  } else if (plan.ctaType === 'contact') {
                    openModal('custom');
                  } else {
                    window.location.href = `/signup?plan=${plan.id}&cycle=${billingCycle}`;
                  }
                }
              };

              return (
                <div
                  key={plan.id}
                  className={`mkt-card flex flex-col p-6 ${
                    plan.isRecommended
                      ? "border-[var(--mkt-accent-line)] bg-[linear-gradient(to_bottom,var(--mkt-accent-soft),var(--mkt-surface))] shadow-[var(--mkt-shadow)]"
                      : "mkt-card-hover"
                  }`}
                >
                  {plan.isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-primary text-primary-foreground text-[11px] font-bold tracking-wide rounded-full whitespace-nowrap">
                      RECOMMENDED
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-base font-extrabold text-[var(--mkt-fg)] mb-2">{plan.name}</h3>
                    <div className="flex items-end gap-1 mb-2">
                      <span className="text-3xl font-extrabold text-[var(--mkt-fg)]">{displayPrice}</span>
                      <span className="text-[var(--mkt-fg-subtle)] text-xs pb-1.5">{periodLabel}</span>
                    </div>
                    {!isFree && !isCustom && (
                      <p className="text-[11px] text-[var(--mkt-fg-subtle)]">
                        {billingCycle === "annual"
                          ? `Equivalent to ₹${Math.round(plan.priceYearly / 12).toLocaleString()}/mo`
                          : `Equivalent to ₹${(plan.priceMonthly * 12).toLocaleString()}/yr`}
                        {" (excl. GST)"}
                      </p>
                    )}
                    {isFree && <p className="text-[11px] font-semibold text-[var(--mkt-accent-text)]">14-day free trial</p>}
                    {isCustom && <p className="text-[11px] text-[var(--mkt-fg-subtle)]">Tailored for large operations</p>}
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--mkt-fg-muted)]">
                        <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${plan.isRecommended ? "text-[var(--mkt-accent-text)]" : "text-emerald-400"}`} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={handleAction}
                    className={`mkt-btn mkt-btn-md w-full text-sm ${
                      plan.isRecommended ? "mkt-btn-primary" : "mkt-btn-secondary"
                    }`}
                  >
                    {plan.ctaType === 'trial' ? 'Start Free Trial' : plan.ctaType === 'contact' ? 'Contact Sales' : 'Subscribe Now'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mx-auto max-w-2xl text-center text-[var(--mkt-fg-subtle)] text-xs leading-relaxed mt-12 space-y-2">
            <p>
              * WhatsApp message allowance covers outbound system messages. Meta Cloud API per-message templates charges are billed separately.
            </p>
            <p>
              All plans include an onboarding setup call. Questions?{" "}
              <button
                onClick={() => openModal("growth")}
                className="mkt-link font-semibold text-[var(--mkt-accent-text)] underline underline-offset-2"
              >
                Talk to us
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ─────────────────────────────────────────────────────── */}
      <section className="mkt-section">
        <div className="mkt-container max-w-[896px]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8 text-center">
            {[
              { icon: Shield, title: "Enterprise Security", desc: "Row-level security, encrypted data at rest, SOC2-ready infrastructure.", color: "#0284C7" },
              { icon: Clock, title: "99.9% Uptime SLA", desc: "Built on Supabase + Vercel with global edge distribution.", color: "#10b981" },
              { icon: Lock, title: "GDPR Compliant", desc: "Full data sovereignty, deletion rights, and audit logs built-in.", color: "#a855f7" },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-[var(--mkt-surface)]"
                  style={{ borderColor: item.color + "59" }}
                >
                  <item.icon className="h-6 w-6" style={{ color: item.color }} />
                </div>
                <div>
                  <div className="font-bold text-[var(--mkt-fg)] mb-1">{item.title}</div>
                  <div className="text-sm text-[var(--mkt-fg-muted)] leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────────────────────── */}
      <section className="mkt-section overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-[#a78bfa]/10" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </div>

        <div className="mkt-container mkt-container-narrow text-center">
          <h2 className="mkt-h2 mb-4">
            Ready to transform your{" "}
            <span className="bg-gradient-to-r from-primary to-[#a78bfa] bg-clip-text text-transparent">
              customer experience?
            </span>
          </h2>
          <p className="mkt-lead mb-10">
            Join teams using Daily CRM to close faster, respond smarter, and grow without limits.
          </p>
          <button
            onClick={() => openModal("growth")}
            className="mkt-btn mkt-btn-primary mkt-btn-lg"
          >
            Get Started Today <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--mkt-line-soft)] bg-[var(--mkt-band)] py-10 px-6">
        <div className="mx-auto max-w-[1152px] flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logolight.png"
              alt="Daily CRM by Daylink"
              width={120}
              height={30}
              className="h-7 w-auto object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <a href="#features" className="mkt-link">Features</a>
            <a href="#pricing" className="mkt-link">Pricing</a>
            <Link href="/login" className="mkt-link">Sign in</Link>
            <button onClick={() => openModal("growth")} className="mkt-link">Contact</button>
          </div>

          <p className="text-xs text-[var(--mkt-fg-subtle)]">
            © {new Date().getFullYear()} Daylink. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
