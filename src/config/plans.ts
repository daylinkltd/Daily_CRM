// ============================================================
// Pricing — per seat, every module included.
//
// The old model sold capped tiers (Starter = 5 users, Growth = 15…),
// which punished growth: adding a sixth person meant a plan change, and
// the modules a customer got depended on how many people they had. That
// is backwards — a five-person firm needs accounting just as much as a
// fifty-person one.
//
// Now there is ONE product. Every module (CRM, HR, Accounting, Retail,
// Projects) is in every paid seat, and the only variable is headcount.
//
// WHY THERE IS NO CHEAP SINGLE-USER TIER. One was tried and removed. A
// ₹299 plan with the identical feature set and only a seat cap separating
// it from Business does not win the one-person customer — it reprices the
// product. Every prospect anchors on the lowest number on the page, the
// sales conversation becomes "why is the same thing ₹799 for us?", and a
// five-person team buys five single-user workspaces or simply argues the
// price down. A discount tier has to be worth less, not merely smaller,
// and there is no module worth cutting here. Compete on the 14-day trial
// and on being one system instead.
//
// WHATSAPP CONVERSATIONS ARE NOT FREE TO US. Meta bills per conversation,
// so a seat price with unlimited messaging is an open-ended liability: one
// broadcast-heavy customer can cost more than they pay. Each plan
// therefore carries a POOLED conversation allowance shared across the
// workspace, with overage metered beyond it. Pooled rather than per-seat
// because usage is lumpy — one salesperson may send ten times what their
// colleagues do, and per-seat pools would block them while capacity sits
// unused elsewhere.
// ============================================================

export type BillingPeriod = 'monthly' | 'annual';

/**
 * GST on SaaS in India. One constant, used by the pricing page, the
 * billing panel and checkout alike — if the rate ever changes in a
 * Budget, it changes here and nowhere else.
 */
export const GST_RATE = 0.18;

export interface Plan {
  id: string;
  name: string;
  /** What this plan is for, in one line. Shown on the pricing card. */
  tagline: string;

  /**
   * Per SEAT per month, excluding GST. `0` for the trial, `-1` for
   * contact-sales.
   *
   * NOTE for anyone touching checkout: the charge is
   * `pricePerSeatMonthly x seats`, never this figure alone. See
   * `monthlyTotalPaise` below and its use in /api/verify-payment.
   */
  pricePerSeatMonthly: number;
  /** Per seat per month when billed annually (charged 12x up front). */
  pricePerSeatAnnual: number;

  /** Seats a subscription cannot go below. */
  minSeats: number;
  /** Hard ceiling on members, or null for unlimited. */
  maxUsers: number | null;
  maxWorkspaces: number | null;
  /** Pooled WhatsApp conversations per month, or null for custom terms. */
  monthlyMessageAllowance: number | null;

  features: string[];
  isRecommended: boolean;
  ctaType: 'trial' | 'subscribe' | 'contact';
  razorpayPlanIdMonthly?: string;
  razorpayPlanIdYearly?: string;
}

/** Everything a paid seat includes, listed once. */
export const INCLUDED_MODULES = [
  'CRM & shared team inbox',
  'WhatsApp, Instagram, Messenger & Email',
  'Pipelines, deals, quotations & invoices',
  'HR: attendance, leave, payroll & documents',
  'Accounting: ledgers, GST, P&L & balance sheet',
  'Retail: POS, products, inventory & purchasing',
  'Projects: tasks, sprints, timesheets & boards',
  'Automations, broadcasts & forms',
  'Works in 14 currencies (₹, $, €, £, AED…)',
  'Role-based access control',
  'Public REST API',
] as const;

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Trial',
    tagline: '14 days of everything, no card required.',
    pricePerSeatMonthly: 0,
    pricePerSeatAnnual: 0,
    minSeats: 1,
    // Fallback ceiling only: the trial's real seat count is whatever the
    // founder chose at onboarding, written to plan_limits.max_members by
    // /api/billing/start-trial. This static value applies to legacy
    // workspaces that never went through that route.
    maxUsers: 5,
    maxWorkspaces: 1,
    monthlyMessageAllowance: 500,
    features: [
      'Every module, unrestricted',
      'The team size you choose',
      '500 WhatsApp conversations',
      'No card required — cancel anytime',
      'Keep your data when you upgrade',
    ],
    isRecommended: false,
    ctaType: 'trial',
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Every module, one price per person.',
    pricePerSeatMonthly: 799,
    pricePerSeatAnnual: 639,
    minSeats: 1,
    maxUsers: null,
    maxWorkspaces: 3,
    monthlyMessageAllowance: 5000,
    features: [
      'Everything listed above, for every seat',
      'Unlimited users — pay only for who you add',
      '5,000 pooled WhatsApp conversations/month',
      'Up to 3 workspaces',
      'Unlimited automations & broadcasts',
      'Email support',
    ],
    isRecommended: true,
    ctaType: 'subscribe',
    // Set these to real Razorpay plan ids before enabling subscriptions.
    // Checkout today creates one-off orders and does not read them.
    razorpayPlanIdMonthly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_BUSINESS_MONTHLY,
    razorpayPlanIdYearly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_BUSINESS_YEARLY,
  },
  {
    id: 'custom',
    name: 'Enterprise',
    tagline: 'For larger teams with their own rules.',
    pricePerSeatMonthly: -1,
    pricePerSeatAnnual: -1,
    minSeats: 25,
    maxUsers: null,
    maxWorkspaces: null,
    monthlyMessageAllowance: null,
    features: [
      'Everything in Business',
      'Unlimited workspaces',
      'Custom conversation volume',
      'Custom domain deployment',
      'SLA & dedicated support',
      'Onboarding and data migration',
    ],
    isRecommended: false,
    ctaType: 'contact',
  },
];

export const BUSINESS_PLAN = PLANS.find((p) => p.id === 'business')!;

/** Per-seat rate for a billing period. */
export function seatRate(plan: Plan, period: BillingPeriod): number {
  return period === 'annual' ? plan.pricePerSeatAnnual : plan.pricePerSeatMonthly;
}

/**
 * The bill, in paise, split into base and GST.
 *
 * Returns null for plans that cannot be bought through checkout (trial,
 * enterprise) so callers must handle them rather than charging zero.
 *
 * GST is computed on the TOTAL base in paise and rounded once, not per
 * seat and summed — per-seat rounding drifts by a paisa per seat, and a
 * total that differs from base x 1.18 by even one paisa fails the
 * verify-payment amount check we ourselves enforce.
 */
export interface BillBreakdown {
  /** Seat price x seats x months, before tax. */
  basePaise: number;
  /** 18% of base, rounded to the paisa. */
  gstPaise: number;
  /** What Razorpay is asked to charge. */
  totalPaise: number;
}

export function billBreakdown(
  plan: Plan,
  seats: number,
  period: BillingPeriod,
): BillBreakdown | null {
  const rate = seatRate(plan, period);
  if (rate <= 0) return null;

  const billedSeats = Math.max(seats, plan.minSeats);
  const months = period === 'annual' ? 12 : 1;
  const basePaise = Math.round(rate * billedSeats * months * 100);
  const gstPaise = Math.round(basePaise * GST_RATE);
  return { basePaise, gstPaise, totalPaise: basePaise + gstPaise };
}

/**
 * What to charge, in paise — GST INCLUSIVE.
 *
 * This is the single definition of "the right price". /api/verify-payment
 * checks the amount Razorpay actually captured against it — the payment
 * signature only proves an order was paid, not that it was paid enough.
 *
 * Until 2026-08 this returned the ex-GST base, which meant every order
 * was raised 18% short of what the invoice had to say. Callers that want
 * the split for display use billBreakdown().
 */
export function chargeablePaise(
  plan: Plan,
  seats: number,
  period: BillingPeriod,
): number | null {
  return billBreakdown(plan, seats, period)?.totalPaise ?? null;
}

/** Display total per month for a seat count, excluding GST. */
export function monthlyTotal(plan: Plan, seats: number, period: BillingPeriod): number {
  return seatRate(plan, period) * Math.max(seats, plan.minSeats);
}

/** Percentage saved by paying annually, rounded — for the toggle badge. */
export function annualSavingPercent(plan: Plan): number {
  if (plan.pricePerSeatMonthly <= 0) return 0;
  return Math.round(
    ((plan.pricePerSeatMonthly - plan.pricePerSeatAnnual) / plan.pricePerSeatMonthly) * 100,
  );
}
