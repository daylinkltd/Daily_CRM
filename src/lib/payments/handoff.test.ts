import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  encodeHandoff,
  decodeHandoff,
  encodeOutcome,
  decodeOutcome,
} from './handoff';

const SECRET = 'shared-secret-between-product-and-hub';
const OTHER_SECRET = 'a-different-secret';

const base = {
  product: 'dailybuz',
  orderId: 'order_ABC123',
  amount: 399500,
  currency: 'INR',
  description: 'Business — 5 seats',
  reference: 'ws_123|business|5|monthly',
};

afterEach(() => vi.useRealTimers());

describe('handoff signing', () => {
  it('round-trips a payload', () => {
    const { data, sig, nonce } = encodeHandoff(base, SECRET);
    const result = decodeHandoff(data, sig, SECRET);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.orderId).toBe('order_ABC123');
    expect(result.payload.amount).toBe(399500);
    expect(result.payload.nonce).toBe(nonce);
  });

  it('rejects a payload signed with a different secret', () => {
    // The whole point: a product cannot spend another product's hub trust.
    const { data, sig } = encodeHandoff(base, OTHER_SECRET);
    expect(decodeHandoff(data, sig, SECRET)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects a tampered amount', () => {
    const { sig } = encodeHandoff(base, SECRET);
    // Re-encode with a different amount but keep the original signature.
    const forged = Buffer.from(JSON.stringify({ ...base, amount: 100, nonce: 'x', exp: 9e9 }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(decodeHandoff(forged, sig, SECRET).ok).toBe(false);
  });

  it('rejects a tampered order id', () => {
    const { data, sig } = encodeHandoff(base, SECRET);
    const swapped = data.slice(0, -4) + (data.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    expect(decodeHandoff(swapped, sig, SECRET).ok).toBe(false);
  });

  it('rejects missing pieces rather than throwing', () => {
    expect(decodeHandoff('', 'sig', SECRET)).toEqual({ ok: false, reason: 'malformed' });
    expect(decodeHandoff('data', '', SECRET)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects an expired handoff', () => {
    const { data, sig } = encodeHandoff(base, SECRET);
    // 31 minutes later — past the 30 minute TTL.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    expect(decodeHandoff(data, sig, SECRET)).toEqual({ ok: false, reason: 'expired' });
  });

  it('accepts a handoff still inside its window', () => {
    const { data, sig } = encodeHandoff(base, SECRET);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 29 * 60 * 1000);
    expect(decodeHandoff(data, sig, SECRET).ok).toBe(true);
  });

  it('issues a distinct nonce each time, so a handoff cannot be replayed', () => {
    const a = encodeHandoff(base, SECRET).nonce;
    const b = encodeHandoff(base, SECRET).nonce;
    expect(a).not.toBe(b);
    expect(a).toHaveLength(32);
  });

  it('survives non-ASCII in the description', () => {
    // Prices are quoted with a rupee sign; base64 of raw bytes would mangle it.
    const { data, sig } = encodeHandoff(
      { ...base, description: 'Business — ₹3,995 för 5' },
      SECRET,
    );
    const result = decodeHandoff(data, sig, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.description).toBe('Business — ₹3,995 för 5');
  });
});

describe('outcome signing', () => {
  const outcome = {
    nonce: 'abc123',
    reference: 'ws_123|business|5|monthly',
    status: 'paid' as const,
    razorpayOrderId: 'order_ABC123',
    razorpayPaymentId: 'pay_XYZ789',
    razorpaySignature: 'deadbeef',
  };

  it('round-trips', () => {
    const { data, sig } = encodeOutcome(outcome, SECRET);
    const result = decodeOutcome(data, sig, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outcome.razorpayPaymentId).toBe('pay_XYZ789');
  });

  it('rejects an unsigned "paid" claim', () => {
    // Someone pasting ?status=paid into the callback must get nowhere.
    const forged = Buffer.from(JSON.stringify({ ...outcome, status: 'paid' }))
      .toString('base64url');
    expect(decodeOutcome(forged, 'not-a-real-signature', SECRET).ok).toBe(false);
  });

  it('rejects an outcome signed by someone else', () => {
    const { data, sig } = encodeOutcome(outcome, OTHER_SECRET);
    expect(decodeOutcome(data, sig, SECRET)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('carries cancellation through, so the product can show the right message', () => {
    const cancelled = { nonce: 'n', reference: 'r', status: 'cancelled' as const };
    const { data, sig } = encodeOutcome(cancelled, SECRET);
    const result = decodeOutcome(data, sig, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outcome.status).toBe('cancelled');
  });
});
