// ============================================================
// Cross-domain checkout handoff: product → daylink.in → product.
//
// WHY THIS EXISTS
//
// Razorpay only opens its Checkout modal on domains registered against the
// account, and only daylink.in is registered. Rather than register every
// future product domain, the modal is hosted once on daylink.in and each
// product hands off to it.
//
// WHAT DAYLINK IS AND IS NOT
//
// daylink.in is a THIN MODAL HOST. It does not decide prices, look up
// plans, or know what a seat costs. The product creates the Razorpay order
// itself — the Orders API has no domain restriction, only Checkout does —
// and hands over an order id that already has the amount baked in. Daylink
// opens the modal for that order and hands the result back.
//
// That boundary is the whole security design. If daylink priced anything,
// a bug there would mis-charge every product on the hub. Because it does
// not, the worst a compromised hub can do is fail to complete a payment or
// return a forged success — and the second is caught, because the product
// re-verifies the payment directly with Razorpay before granting anything.
//
// THREE THINGS THIS MODULE PROTECTS AGAINST
//
//   1. Tampering. The handoff is HMAC-signed with a secret shared between
//      the product and the hub, so nobody can craft their own "pay for
//      this order" link or alter the amount shown.
//   2. Open redirect. The return URL is NOT taken from the request. The
//      hub looks it up from its own registry keyed by product id, so a
//      crafted link cannot turn daylink.in into a redirector to a phishing
//      page — which would be far more damaging than a lost sale, given
//      daylink.in is the trusted brand in the flow.
//   3. Replay. Every handoff carries a nonce and a short expiry.
// ============================================================

import crypto from 'crypto';

/** Minutes a handoff stays valid. Long enough to pay, short enough to matter. */
const TTL_MINUTES = 30;

export interface HandoffPayload {
  /** Which product is asking. The hub maps this to a return URL. */
  product: string;
  /** Razorpay order id, created by the PRODUCT with the amount already set. */
  orderId: string;
  /** Paise. Display only — Razorpay is the authority on what is charged. */
  amount: number;
  currency: string;
  /** Shown in the modal so the buyer knows what they are paying for. */
  description: string;
  /** Opaque to the hub; handed back so the product can resume its flow. */
  reference: string;
  /** Single-use id, checked on return. */
  nonce: string;
  /** Unix seconds. */
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(encoded: string, secret: string): string {
  return b64url(crypto.createHmac('sha256', secret).update(encoded).digest());
}

/**
 * Constant-time compare.
 *
 * `a === b` on a signature leaks its content through timing. Rare to be
 * practical over the internet, but free to avoid.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Build the signed `?d=…&s=…` pair for the redirect to the hub. */
export function encodeHandoff(
  payload: Omit<HandoffPayload, 'nonce' | 'exp'>,
  secret: string,
): { data: string; sig: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString('hex');
  const full: HandoffPayload = {
    ...payload,
    nonce,
    exp: Math.floor(Date.now() / 1000) + TTL_MINUTES * 60,
  };
  const data = b64url(JSON.stringify(full));
  return { data, sig: sign(data, secret), nonce };
}

export type HandoffResult =
  | { ok: true; payload: HandoffPayload }
  | { ok: false; reason: 'bad_signature' | 'malformed' | 'expired' };

/**
 * Verify and decode a handoff.
 *
 * Signature is checked BEFORE parsing: parsing attacker-controlled JSON
 * that has not been authenticated is work done on behalf of an attacker,
 * however cheap.
 */
export function decodeHandoff(
  data: string,
  sig: string,
  secret: string,
): HandoffResult {
  if (!data || !sig) return { ok: false, reason: 'malformed' };
  if (!safeEqual(sig, sign(data, secret))) return { ok: false, reason: 'bad_signature' };

  let payload: HandoffPayload;
  try {
    payload = JSON.parse(fromB64url(data).toString('utf8')) as HandoffPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    typeof payload.orderId !== 'string' ||
    typeof payload.product !== 'string' ||
    typeof payload.nonce !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  if (payload.exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}

export interface HandoffOutcome {
  nonce: string;
  reference: string;
  status: 'paid' | 'cancelled' | 'failed';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

/** Sign the result the hub sends back, so the product can trust the shape. */
export function encodeOutcome(
  outcome: HandoffOutcome,
  secret: string,
): { data: string; sig: string } {
  const data = b64url(JSON.stringify(outcome));
  return { data, sig: sign(data, secret) };
}

export type OutcomeResult =
  | { ok: true; outcome: HandoffOutcome }
  | { ok: false; reason: 'bad_signature' | 'malformed' };

/**
 * Verify a returned outcome.
 *
 * IMPORTANT: a valid signature here proves the hub sent it, NOT that the
 * money arrived. The product must still verify razorpayPaymentId /
 * razorpaySignature against Razorpay before granting anything — which
 * /api/verify-payment already does. This signature only stops a stranger
 * pasting `?status=paid` into the callback URL.
 */
export function decodeOutcome(
  data: string,
  sig: string,
  secret: string,
): OutcomeResult {
  if (!data || !sig) return { ok: false, reason: 'malformed' };
  if (!safeEqual(sig, sign(data, secret))) return { ok: false, reason: 'bad_signature' };

  try {
    const outcome = JSON.parse(fromB64url(data).toString('utf8')) as HandoffOutcome;
    if (typeof outcome.nonce !== 'string' || typeof outcome.status !== 'string') {
      return { ok: false, reason: 'malformed' };
    }
    return { ok: true, outcome };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}
