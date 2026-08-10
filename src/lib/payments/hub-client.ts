// ============================================================
// Client for the Daylink payment hub.
//
// WHY THIS APP NO LONGER HOLDS RAZORPAY CREDENTIALS
//
// The Razorpay account belongs to Daylink, and daylink.in is the only
// domain registered against it. An earlier version of this integration had
// Dailybiz hold RAZORPAY_KEY_SECRET so it could create orders and verify
// payments itself. That was wrong: it copies the account's most sensitive
// credential into every product's environment, so five SaaS products means
// five places it can leak from and five to rotate when it does.
//
// It also bought less isolation than it appeared to. daylink.in hosts the
// checkout UI, so it is already inside the trust path — if it were
// compromised an attacker controls the payment screen regardless, and this
// app verifying independently would not help.
//
// So credentials live in exactly one place, and this app talks to the hub.
//
// WHAT DID NOT MOVE: pricing. This app still computes the amount from its
// own plan config and seat count, and still decides whether a captured
// payment covers what it meant to charge. The hub creates the order for
// whatever amount it is given and reports back what Razorpay says — it has
// no idea what a seat costs and cannot approve an underpayment, because it
// never makes that call.
// ============================================================

import crypto from 'crypto';

const PRODUCT_ID = 'dailybuz';

function hubConfig(): { base: string; secret: string } | null {
  const secret = process.env.DAYLINK_PAY_SECRET;
  if (!secret) return null;
  const base = process.env.DAYLINK_PAY_API_URL || 'https://daylink.in/api/pay';
  return { base, secret };
}

/**
 * Signed server-to-server POST.
 *
 * The signature covers `timestamp.body` over the EXACT bytes sent, so the
 * body is serialised once and both signed and transmitted from the same
 * string — re-serialising would risk a different key order and a
 * signature that fails for no real reason.
 */
async function hubPost<T>(
  path: string,
  payload: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const config = hubConfig();
  if (!config) {
    return {
      ok: false,
      status: 500,
      error: 'The payment hub is not configured on this environment.',
    };
  }

  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac('sha256', config.secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  try {
    const res = await fetch(`${config.base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-daylink-product': PRODUCT_ID,
        'x-daylink-timestamp': timestamp,
        'x-daylink-signature': signature,
      },
      body,
      // Payment calls must not be served from a cache, ever.
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json.error || `Payment hub returned ${res.status}`,
      };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    // A network failure to the hub is not the buyer's fault and must not
    // read like a declined card.
    return {
      ok: false,
      status: 502,
      error:
        err instanceof Error
          ? `Could not reach the payment service: ${err.message}`
          : 'Could not reach the payment service.',
    };
  }
}

export interface HubOrder {
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

/** Create an order for an amount THIS APP computed. */
export function createHubOrder(input: {
  amount: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}) {
  return hubPost<HubOrder>('/order', input);
}

export interface HubVerification {
  signature_valid: boolean;
  order_id?: string;
  /** Paise actually captured, straight from Razorpay. */
  amount_paid?: number;
  amount?: number;
  currency?: string;
  status?: string;
  notes?: Record<string, string>;
}

/**
 * Ask the hub what Razorpay says about a payment.
 *
 * Returns facts. The caller compares `amount_paid` against what it
 * expected — that comparison is the authorisation decision and stays here,
 * in the app that knows the price.
 */
export function verifyHubPayment(input: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return hubPost<HubVerification>('/verify', input);
}

export interface HubPayment {
  id: string;
  order_id: string | null;
  amount: number;
  amount_refunded: number;
  currency: string;
  status: string;
  method: string | null;
  email: string | null;
  contact: string | null;
  /** Unix seconds, as Razorpay reports it. */
  created_at: number;
  notes: Record<string, string>;
}

/**
 * Recent payments from the Razorpay account, via the hub.
 *
 * Read-only: the hub endpoint can move no money, and this is the ground
 * truth the console's Revenue page reconciles the local income ledger
 * against — Razorpay knows about refunds and payments made outside this
 * app; platform_payments knows which tenant each one belongs to.
 */
export function listHubPayments(input: { count?: number; from?: number; to?: number } = {}) {
  return hubPost<{ count: number; payments: HubPayment[] }>('/payments', input);
}
