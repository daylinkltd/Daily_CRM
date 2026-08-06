import { describe, it, expect } from 'vitest';

import { BUSINESS_PLAN, GST_RATE, chargeablePaise } from '@/config/plans';
import { discountedBill, normalizeCouponCode } from './coupons';

describe('normalizeCouponCode', () => {
  it('uppercases and trims', () => {
    expect(normalizeCouponCode('  launch50 ')).toBe('LAUNCH50');
  });

  it('rejects shapes that cannot be codes', () => {
    expect(normalizeCouponCode('ab')).toBeNull();
    expect(normalizeCouponCode('has space')).toBeNull();
    expect(normalizeCouponCode('drop;table')).toBeNull();
    expect(normalizeCouponCode(42)).toBeNull();
    expect(normalizeCouponCode(null)).toBeNull();
  });
});

describe('discountedBill', () => {
  it('discounts the base and recomputes GST on the discounted base', () => {
    // GST is owed on what is actually charged, so a 50% coupon halves the
    // tax too — discounting the inclusive total instead would misstate
    // the GST line on the customer's invoice.
    const bill = discountedBill(BUSINESS_PLAN, 2, 'monthly', 50)!;
    const fullBase = BUSINESS_PLAN.pricePerSeatMonthly * 2 * 100;
    expect(bill.undiscountedBasePaise).toBe(fullBase);
    expect(bill.discountPaise).toBe(fullBase / 2);
    expect(bill.basePaise).toBe(fullBase / 2);
    expect(bill.gstPaise).toBe(Math.round((fullBase / 2) * GST_RATE));
    expect(bill.totalPaise).toBe(bill.basePaise + bill.gstPaise);
  });

  it('at 0% matches the undiscounted charge exactly', () => {
    // The invariant verify-payment depends on: no coupon and a 0% coupon
    // are the same number, so one code path can serve both.
    for (const period of ['monthly', 'annual'] as const) {
      expect(discountedBill(BUSINESS_PLAN, 7, period, 0)!.totalPaise).toBe(
        chargeablePaise(BUSINESS_PLAN, 7, period),
      );
    }
  });

  it('at 100% charges nothing', () => {
    expect(discountedBill(BUSINESS_PLAN, 3, 'monthly', 100)!.totalPaise).toBe(0);
  });

  it('clamps out-of-range percentages instead of inverting the bill', () => {
    expect(discountedBill(BUSINESS_PLAN, 1, 'monthly', 250)!.totalPaise).toBe(0);
    expect(discountedBill(BUSINESS_PLAN, 1, 'monthly', -30)!.totalPaise).toBe(
      chargeablePaise(BUSINESS_PLAN, 1, 'monthly'),
    );
  });

  it('is deterministic across repeated calls', () => {
    // Checkout and verify-payment call this independently; any
    // nondeterminism rejects real payments as underpaid.
    const a = discountedBill(BUSINESS_PLAN, 13, 'annual', 33)!;
    const b = discountedBill(BUSINESS_PLAN, 13, 'annual', 33)!;
    expect(a).toEqual(b);
  });
});
