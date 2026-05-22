"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
    color: "#00aef0",
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
    color: "#00aef0",
  },
];

// ── Channels ──────────────────────────────────────────────────────────────────
const channels = [
  { label: "WhatsApp", icon: PhoneCall, color: "#25D366" },
  { label: "Instagram", icon: Sparkles, color: "#E1306C" },
  { label: "Messenger", icon: MessageSquare, color: "#0078FF" },
  { label: "Email", icon: Mail, color: "#00aef0" },
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
    color: "#00aef0",
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

// ── Pricing ───────────────────────────────────────────────────────────────────
const pricingPlans = [
  {
    name: "Growth",
    price: "$20",
    period: "/month",
    desc: "Perfect for growing teams ready to scale conversations.",
    highlight: false,
    planKey: "growth",
    features: [
      "Up to 20 team members",
      "2 workspaces",
      "All channels: WhatsApp, Instagram, Messenger & Email",
      "Unlimited automations & integrations",
      "Shared media storage (Supabase-backed)",
      "Community support",
    ],
  },
  {
    name: "Custom Solution",
    price: "Custom",
    period: "",
    desc: "Enterprise-grade setup on your domain with full control.",
    highlight: true,
    planKey: "custom",
    features: [
      "Unlimited team members",
      "Multiple workspaces",
      "All channels (WA, IG, FB, Email)",
      "Advanced automations (unlimited)",
      "Custom storage quota",
      "Dedicated onboarding & SLA",
      "Custom domain deployment",
      "Priority support",
    ],
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700/60 bg-[#020817] shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6 pb-5">
          <div>
            <h2 className="text-xl font-extrabold text-white">Talk to Sales</h2>
            <p className="text-sm text-slate-400 mt-0.5">We&apos;ll get back to you within 24 hours</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-800 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-5">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Request Submitted!</h3>
            <p className="text-slate-400 text-sm mb-6">
              Thanks, <strong className="text-white">{form.full_name.split(" ")[0]}</strong>! Our team will reach out to{" "}
              <strong className="text-[#00aef0]">{form.email}</strong> within 24 hours.
            </p>
            <button
              onClick={onClose}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 text-sm font-semibold transition-all"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name *</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    required
                    placeholder="Jane Smith"
                    value={form.full_name}
                    onChange={e => set("full_name", e.target.value)}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[#00aef0] focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    required
                    placeholder="Acme Corp"
                    value={form.company_name}
                    onChange={e => set("company_name", e.target.value)}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[#00aef0] focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Work Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  required
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[#00aef0] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={e => set("phone", e.target.value)}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[#00aef0] focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Size</label>
                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                  <select
                    value={form.team_size}
                    onChange={e => set("team_size", e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:border-[#00aef0] focus:outline-none transition-colors"
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
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plan Interest</label>
              <div className="grid grid-cols-2 gap-2">
                {(["growth", "custom"] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("plan_interest", p)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all text-left ${
                      form.plan_interest === p
                        ? "border-[#00aef0] bg-[#00aef0]/10 text-[#00aef0]"
                        : "border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {p === "growth" ? "Growth — $20/mo" : "Custom Solution"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Message</label>
              <textarea
                rows={3}
                placeholder="Tell us about your use case, current tools, or any specific requirements..."
                value={form.message}
                onChange={e => set("message", e.target.value)}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-[#00aef0] focus:outline-none transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00aef0] hover:bg-[#008ec4] text-white font-bold py-3 text-sm transition-all shadow-lg shadow-[#00aef0]/20 hover:shadow-[#00aef0]/35 disabled:opacity-50 disabled:cursor-not-allowed"
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

  const openModal = (plan: "growth" | "custom" = "growth") => {
    setModalPlan(plan);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white overflow-x-hidden">
      <SalesModal open={modalOpen} onClose={() => setModalOpen(false)} defaultPlan={modalPlan} />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-[#020817]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
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

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#channels" className="hover:text-white transition-colors">Channels</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block"
            >
              Sign in
            </Link>
            <button
              onClick={() => openModal("growth")}
              className="flex items-center gap-1.5 rounded-full bg-[#00aef0] px-5 py-2 text-sm font-semibold text-white hover:bg-[#008ec4] transition-all shadow-lg shadow-[#00aef0]/20 hover:shadow-[#00aef0]/30 hover:scale-105"
            >
              Contact Sales <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-32 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full bg-[#00aef0]/10 blur-[120px]" />
          <div className="absolute top-40 left-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/8 blur-[100px]" />
          <div className="absolute top-40 right-1/4 h-[300px] w-[300px] rounded-full bg-indigo-600/6 blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00aef0]/40 to-transparent" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00aef0]/25 bg-[#00aef0]/8 px-4 py-1.5 text-xs font-semibold text-[#00aef0] mb-8 shadow-lg shadow-[#00aef0]/5">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            Omni-Channel CRM — WhatsApp · Instagram · Email · Messenger
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.06] mb-6">
            The CRM that{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-[#00aef0] via-[#44c8ff] to-[#a78bfa] bg-clip-text text-transparent">
                closes deals
              </span>
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00aef0] to-[#a78bfa] opacity-50 rounded-full" />
            </span>{" "}
            <br />
            across every channel.
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-400 mb-10 leading-relaxed">
            Unify WhatsApp, Instagram, Email &amp; Messenger into one intelligent inbox.
            Automate repetitive tasks, track pipelines, and give your team superpowers.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <button
              onClick={() => openModal("growth")}
              className="flex items-center gap-2 rounded-full bg-[#00aef0] px-8 py-3.5 text-base font-bold text-white hover:bg-[#008ec4] transition-all shadow-xl shadow-[#00aef0]/20 hover:shadow-[#00aef0]/35 hover:scale-105"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-8 py-3.5 text-base font-semibold text-slate-200 hover:border-slate-600 hover:text-white transition-all"
            >
              Sign In
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-8 sm:gap-16">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold text-white">{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative z-10 mt-20 max-w-5xl mx-auto w-full">
          <div className="relative rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/80 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-rose-500/60" />
                <div className="h-3 w-3 rounded-full bg-amber-500/60" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-6 w-64 rounded-md bg-slate-800 flex items-center px-3">
                  <span className="text-[10px] text-slate-500">app.daylink.in/dashboard</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-0 min-h-[340px]">
              <div className="col-span-2 border-r border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <div className="h-7 w-20 bg-[#00aef0]/10 rounded-lg flex items-center justify-center">
                  <div className="h-2 w-12 bg-[#00aef0]/60 rounded-full" />
                </div>
                {["Inbox", "Contacts", "Pipeline", "Automations"].map((item, i) => (
                  <div key={item} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${i === 0 ? "bg-[#00aef0]/15" : ""}`}>
                    <div className={`h-3 w-3 rounded-sm ${i === 0 ? "bg-[#00aef0]" : "bg-slate-700"}`} />
                    <div className={`h-2 w-10 rounded-full ${i === 0 ? "bg-[#00aef0]/60" : "bg-slate-700"}`} />
                  </div>
                ))}
              </div>
              <div className="col-span-3 border-r border-slate-800 p-3 space-y-2">
                <div className="h-7 bg-slate-800/50 rounded-lg" />
                {[
                  { color: "#25D366", name: "Riya S." },
                  { color: "#E1306C", name: "Arjun M." },
                  { color: "#00aef0", name: "Priya K." },
                  { color: "#25D366", name: "Karan V." },
                ].map((conv, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${i === 0 ? "bg-slate-800/70" : ""}`}>
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: conv.color + "22", color: conv.color }}>
                      {conv.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-2 w-14 bg-slate-600 rounded-full mb-1.5" />
                      <div className="h-1.5 w-20 bg-slate-700 rounded-full" />
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: conv.color }} />
                  </div>
                ))}
              </div>
              <div className="col-span-4 border-r border-slate-800 p-4 space-y-3">
                <div className="h-6 bg-slate-800/50 rounded-lg w-32" />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#25D366]/20 shrink-0" />
                    <div className="bg-slate-800 rounded-xl px-3 py-2 max-w-[60%]">
                      <div className="h-1.5 w-24 bg-slate-600 rounded-full mb-1" />
                      <div className="h-1.5 w-16 bg-slate-700 rounded-full" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-[#00aef0]/20 border border-[#00aef0]/30 rounded-xl px-3 py-2 max-w-[55%]">
                      <div className="h-1.5 w-20 bg-[#00aef0]/60 rounded-full mb-1" />
                      <div className="h-1.5 w-14 bg-[#00aef0]/40 rounded-full" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#25D366]/20 shrink-0" />
                    <div className="bg-slate-800 rounded-xl px-3 py-2">
                      <div className="h-1.5 w-32 bg-slate-600 rounded-full mb-1" />
                      <div className="h-1.5 w-20 bg-slate-700 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="h-8 rounded-xl bg-slate-800/60 border border-slate-700 mt-auto" />
              </div>
              <div className="col-span-3 p-4 space-y-3">
                <div className="h-5 w-24 bg-slate-700 rounded-md" />
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2">
                  {["New Lead", "Proposal Sent", "Negotiating"].map((stage, i) => (
                    <div key={stage} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: ["#00aef0", "#a855f7", "#f59e0b"][i] }} />
                      <div className="flex-1 h-5 bg-slate-800 rounded flex items-center px-2">
                        <div className="h-1.5 rounded-full" style={{ width: [70, 45, 55][i] + "%", background: ["#00aef0", "#a855f7", "#f59e0b"][i] + "40" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-16 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-emerald-400" />
                    <div className="text-[10px] text-emerald-400 font-semibold">Automation Active</div>
                  </div>
                  <div className="h-1.5 w-full bg-emerald-500/30 rounded-full" />
                  <div className="h-1.5 w-3/4 bg-emerald-500/20 rounded-full" />
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-24 w-3/4 bg-[#00aef0]/10 blur-[60px] pointer-events-none rounded-full" />
        </div>
      </section>

      {/* ── CHANNEL LOGOS ─────────────────────────────────────────────────── */}
      <section id="channels" className="border-y border-slate-800/50 bg-slate-900/20 py-12 px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-500 mb-8">
            Connect every channel you already use
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {channels.map((ch) => (
              <div
                key={ch.label}
                className="flex items-center gap-3 rounded-2xl border px-6 py-3 transition-all hover:scale-105"
                style={{ borderColor: ch.color + "30", background: ch.color + "08" }}
              >
                <ch.icon className="h-5 w-5" style={{ color: ch.color }} />
                <span className="text-sm font-semibold text-slate-200">{ch.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-28 px-6 relative">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-0 h-[500px] w-[500px] rounded-full bg-violet-600/5 blur-[120px]" />
          <div className="absolute top-1/2 right-0 h-[400px] w-[400px] rounded-full bg-[#00aef0]/5 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/8 px-4 py-1.5 text-xs font-semibold text-violet-400 mb-4">
              <Sparkles className="h-3 w-3" /> Everything you need
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Built for teams that{" "}
              <span className="bg-gradient-to-r from-[#00aef0] to-[#a78bfa] bg-clip-text text-transparent">
                move fast
              </span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Every feature designed to reduce manual work, speed up responses, and give your team a competitive edge.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-slate-800/60 bg-slate-900/40 p-7 backdrop-blur-sm hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden"
              >
                <div
                  className="absolute top-0 right-0 h-32 w-32 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: f.color + "08" }}
                />
                <div
                  className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border"
                  style={{ background: f.color + "12", borderColor: f.color + "25" }}
                >
                  <f.icon className="h-6 w-6" style={{ color: f.color }} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-slate-900/20 border-y border-slate-800/50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold tracking-tight mb-3">
              Up and running in{" "}
              <span className="text-[#00aef0]">minutes</span>
            </h2>
            <p className="text-slate-400 text-lg">
              No complex setup. Connect, configure, and start closing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-14 left-1/3 right-1/3 h-px border-t border-dashed border-slate-700" />
            {[
              { step: "01", icon: Globe, title: "Connect Channels", desc: "Link your WhatsApp Business API, Instagram, Facebook Page, and email in one click.", color: "#00aef0" },
              { step: "02", icon: Zap, title: "Configure Automations", desc: "Set up lead qualification, auto-responses, and team routing with our visual builder.", color: "#a855f7" },
              { step: "03", icon: TrendingUp, title: "Close More Deals", desc: "Your team works in a unified inbox while analytics track every conversion.", color: "#10b981" },
            ].map((item) => (
              <div key={item.step} className="relative text-center group">
                <div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-lg transition-transform group-hover:scale-110"
                  style={{ background: item.color + "15", borderColor: item.color + "30", boxShadow: `0 0 30px ${item.color}15` }}
                >
                  <item.icon className="h-8 w-8" style={{ color: item.color }} />
                </div>
                <div className="text-xs font-extrabold tracking-widest mb-2" style={{ color: item.color }}>{item.step}</div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-4 py-1.5 text-xs font-semibold text-amber-400 mb-4">
              <Star className="h-3 w-3 fill-current" /> Loved by teams
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight">Real results, real teams</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-7 backdrop-blur-sm hover:border-slate-700 transition-all hover:-translate-y-1 hover:shadow-xl group"
              >
                <div className="flex mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6 italic">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shrink-0"
                    style={{ background: t.color + "20", color: t.color }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 px-6 bg-slate-900/20 border-y border-slate-800/50 relative">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[#00aef0]/5 blur-[140px]" />
        </div>

        <div className="mx-auto max-w-5xl relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00aef0]/20 bg-[#00aef0]/8 px-4 py-1.5 text-xs font-semibold text-[#00aef0] mb-4">
              <Lock className="h-3 w-3" /> Simple, transparent pricing
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">Choose your plan</h2>
            <p className="text-slate-400 text-lg">No hidden fees. Scale as you grow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-2xl ${
                  plan.highlight
                    ? "border-2 border-[#00aef0]/50 bg-gradient-to-b from-[#00aef0]/10 to-slate-900/80 shadow-xl shadow-[#00aef0]/10"
                    : "border border-slate-800/60 bg-slate-900/40"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#00aef0] text-white text-xs font-bold rounded-full shadow-lg shadow-[#00aef0]/30 whitespace-nowrap">
                    RECOMMENDED
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-extrabold text-white mb-1">{plan.name}</h3>
                  <p className="text-slate-400 text-sm mb-4">{plan.desc}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                    {plan.period && <span className="text-slate-400 text-sm pb-1">{plan.period}</span>}
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${plan.highlight ? "text-[#00aef0]" : "text-emerald-400"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => openModal(plan.planKey as "growth" | "custom")}
                  className={`flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-bold transition-all ${
                    plan.highlight
                      ? "bg-[#00aef0] text-white hover:bg-[#008ec4] shadow-lg shadow-[#00aef0]/20 hover:shadow-[#00aef0]/30 hover:scale-105"
                      : "border border-slate-700 text-slate-200 hover:border-slate-600 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  Contact Sales <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-500 text-sm mt-8">
            All plans include a dedicated onboarding call. Questions?{" "}
            <button onClick={() => openModal("growth")} className="text-[#00aef0] hover:text-[#44c8ff] transition-colors">
              Talk to us
            </button>
          </p>
        </div>
      </section>

      {/* ── TRUST BAR ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              { icon: Shield, title: "Enterprise Security", desc: "Row-level security, encrypted data at rest, SOC2-ready infrastructure.", color: "#00aef0" },
              { icon: Clock, title: "99.9% Uptime SLA", desc: "Built on Supabase + Vercel with global edge distribution.", color: "#10b981" },
              { icon: Lock, title: "GDPR Compliant", desc: "Full data sovereignty, deletion rights, and audit logs built-in.", color: "#a855f7" },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border"
                  style={{ background: item.color + "12", borderColor: item.color + "25" }}
                >
                  <item.icon className="h-7 w-7" style={{ color: item.color }} />
                </div>
                <div>
                  <div className="font-bold text-white mb-1">{item.title}</div>
                  <div className="text-sm text-slate-400 leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#00aef0]/8 via-transparent to-[#a78bfa]/8" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00aef0]/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#a78bfa]/30 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            Ready to transform your{" "}
            <span className="bg-gradient-to-r from-[#00aef0] to-[#a78bfa] bg-clip-text text-transparent">
              customer experience?
            </span>
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Join teams using Daily CRM to close faster, respond smarter, and grow without limits.
          </p>
          <button
            onClick={() => openModal("growth")}
            className="inline-flex items-center gap-2 rounded-full bg-[#00aef0] px-10 py-4 text-base font-bold text-white hover:bg-[#008ec4] transition-all shadow-xl shadow-[#00aef0]/25 hover:shadow-[#00aef0]/40 hover:scale-105"
          >
            Get Started Today <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/50 bg-slate-950/80 py-10 px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logolight.png"
              alt="Daily CRM by Daylink"
              width={120}
              height={30}
              className="h-7 w-auto object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-300 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-slate-300 transition-colors">Pricing</a>
            <Link href="/login" className="hover:text-slate-300 transition-colors">Sign in</Link>
            <button onClick={() => openModal("growth")} className="hover:text-slate-300 transition-colors">Contact</button>
          </div>

          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Daylink. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
