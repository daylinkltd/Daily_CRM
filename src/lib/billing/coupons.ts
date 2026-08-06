import type { SupabaseClient } from '@supabase/supabase-js';

import { GST_RATE, billBreakdown, type BillBreakdown, type Plan, type BillingPeriod } from '@/config/plans';

/**
 * Coupons — validation and the discounted bill.
 *
 * THE ONE RULE THAT MATTERS HERE: checkout and verify-payment must compute
 * the exact same number for the same (plan, seats, period, coupon) inputs,
 * to the paisa. Checkout creates the Razorpay order with the discounted
 * total, and verify-payment recomputes it independently to check what was
 * actually captured — the coupon code travels in the order's reference so
 * both sides see the same inputs. If the two implementations ever
 * diverged, every discounted payment would be rejected as underpaid.
 * Hence: one function, imported by both.
 *
 * The discount applies to the BASE, and GST is recomputed on the
 * discounted base. That is not a style choice — under GST law the tax is
 * owed on the consideration actually charged, so discounting the
 * tax-inclusive total would misstate the GST line on the invoice.
 */

export interface CouponRow {
  id: string;
  code: string;
  percent_off: number;
  plan_id: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  valid_from: string;
  valid_until: string | null;
  active: boolean;
}

export type CouponCheck =
  | { ok: true; coupon: CouponRow }
  | { ok: false; reason: string };

/** Normalise user input before lookup; codes are stored uppercase. */
export function normalizeCouponCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(code) ? code : null;
}

/**
 * Look a coupon up and decide whether THIS purchase may use it.
 *
 * Reasons are written for the buyer — they are shown verbatim in the
 * billing panel — and deliberately do not distinguish "no such code"
 * from "expired code": both read "not valid", so the input box cannot be
 * used to enumerate live codes.
 */
export async function checkCoupon(
  admin: SupabaseClient,
  rawCode: unknown,
  planId: string,
): Promise<CouponCheck> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { ok: false, reason: 'That code is not valid.' };

  const { data, error } = await admin
    .from('coupons')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'That code is not valid.' };
  const coupon = data as CouponRow;

  const now = Date.now();
  if (!coupon.active) return { ok: false, reason: 'That code is not valid.' };
  if (new Date(coupon.valid_from).getTime() > now) {
    return { ok: false, reason: 'That code is not valid.' };
  }
  if (coupon.valid_until && new Date(coupon.valid_until).getTime() < now) {
    return { ok: false, reason: 'That code has expired.' };
  }
  if (coupon.max_redemptions !== null && coupon.redeemed_count >= coupon.max_redemptions) {
    return { ok: false, reason: 'That code has been fully redeemed.' };
  }
  if (coupon.plan_id && coupon.plan_id !== planId) {
    return { ok: false, reason: 'That code does not apply to this plan.' };
  }

  return { ok: true, coupon };
}

export interface DiscountedBill extends BillBreakdown {
  /** Base before the coupon, for the strikethrough. */
  undiscountedBasePaise: number;
  discountPaise: number;
  percentOff: number;
}

/**
 * The bill after a percent-off coupon. Deterministic and shared — see the
 * module comment for why this must be the only implementation.
 */
export function discountedBill(
  plan: Plan,
  seats: number,
  period: BillingPeriod,
  percentOff: number,
): DiscountedBill | null {
  const bill = billBreakdown(plan, seats, period);
  if (!bill) return null;

  const pct = Math.min(100, Math.max(0, Math.round(percentOff)));
  const discountPaise = Math.round((bill.basePaise * pct) / 100);
  const basePaise = bill.basePaise - discountPaise;
  const gstPaise = Math.round(basePaise * GST_RATE);

  return {
    undiscountedBasePaise: bill.basePaise,
    discountPaise,
    percentOff: pct,
    basePaise,
    gstPaise,
    totalPaise: basePaise + gstPaise,
  };
}
