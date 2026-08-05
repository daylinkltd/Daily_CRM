// ============================================================
// Razorpay checkout configuration — client side.
//
// Payments for Dailybuz settle into Daylink Tech Labs' Razorpay account,
// so the checkout is branded with the LEGAL ENTITY. The customer's card
// statement will read "Daylink"; showing them "Dailybuz" and then billing
// them as something else is the classic cause of a "I don't recognise
// this charge" chargeback.
// ============================================================

import { BRAND } from '@/config/brand';

/**
 * The publishable key, or null when it is not configured.
 *
 * Returns null rather than falling back to a hardcoded key. Three call
 * sites previously defaulted to `rzp_test_TEus8m7ilDoAio` — a DIFFERENT
 * account's test key — which meant a deploy with the env var missing would
 * quietly open a working-looking checkout that paid into someone else's
 * Razorpay account instead of erroring. Failing loudly is the only safe
 * behaviour for a payment credential.
 */
export function razorpayKeyId(): string | null {
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  return key && key.trim() ? key.trim() : null;
}

export interface CheckoutBranding {
  key: string;
  name: string;
  description: string;
  /** Razorpay shows this beneath the merchant name. */
  image?: string;
  theme: { color: string };
  notes: Record<string, string>;
}

/**
 * Shared branding for every checkout the app opens.
 *
 * `notes` is carried through to the Razorpay dashboard and the settlement
 * report, which is what makes a payment traceable back to the workspace
 * that made it when finance asks three months later.
 */
export function checkoutBranding(opts: {
  key: string;
  description: string;
  workspaceId?: string;
  planId?: string;
  seats?: number;
}): CheckoutBranding {
  return {
    key: opts.key,
    name: BRAND.payments.merchantName,
    description: opts.description,
    theme: { color: '#2f7fd1' },
    notes: {
      product: BRAND.name,
      ...(opts.workspaceId ? { workspace_id: opts.workspaceId } : {}),
      ...(opts.planId ? { plan_id: opts.planId } : {}),
      ...(opts.seats ? { seats: String(opts.seats) } : {}),
    },
  };
}

/** Message shown when checkout is opened without a configured key. */
export const RAZORPAY_NOT_CONFIGURED =
  'Payments are not configured on this environment. Please contact support.';
