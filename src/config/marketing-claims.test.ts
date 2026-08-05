import { describe, it, expect } from 'vitest';

import { PLANS, BUSINESS_PLAN, GST_RATE, billBreakdown, chargeablePaise, seatRate } from './plans';
import { MODULES, allCapabilities } from './modules-content';
import { ROADMAP } from './competitors';

/**
 * These tests guard CLAIMS, not code paths.
 *
 * The marketing pages, the JSON-LD and llms.txt all assert things about the
 * product to an audience that includes AI assistants, which repeat what
 * they read. A capability listed as both shipped and roadmap, or a plan
 * priced so a bigger tier is cheaper, is a factual error published at scale
 * — much harder to walk back than a runtime bug, because it propagates into
 * other people's answers.
 */

describe('plan pricing', () => {
  it('keeps exactly one purchasable price', () => {
    // A cheap single-user tier was tried and pulled: with an identical
    // feature set it repriced the product rather than winning a new
    // customer. If a second buyable plan is ever added, the JSON-LD in
    // structured-data.ts must become an AggregateOffer at the same time —
    // this test is the reminder.
    const buyable = PLANS.filter((p) => p.ctaType === 'subscribe');
    expect(buyable.map((p) => p.id)).toEqual(['business']);
  });

  it('always makes annual cheaper per month than monthly', () => {
    for (const plan of PLANS) {
      if (plan.pricePerSeatMonthly <= 0) continue;
      expect(plan.pricePerSeatAnnual).toBeLessThan(plan.pricePerSeatMonthly);
    }
  });

  it('charges twelve months up front on annual, GST inclusive', () => {
    const monthlyBase = BUSINESS_PLAN.pricePerSeatMonthly * 3 * 100;
    const annualBase = BUSINESS_PLAN.pricePerSeatAnnual * 3 * 12 * 100;
    expect(chargeablePaise(BUSINESS_PLAN, 3, 'monthly')).toBe(Math.round(monthlyBase * (1 + GST_RATE)));
    expect(chargeablePaise(BUSINESS_PLAN, 3, 'annual')).toBe(Math.round(annualBase * (1 + GST_RATE)));
  });

  it('keeps the breakdown internally consistent', () => {
    // The invoice line items must sum to the amount charged — a breakdown
    // that is off by a paisa fails the verify-payment amount check.
    for (const seats of [1, 3, 7, 49]) {
      for (const period of ['monthly', 'annual'] as const) {
        const b = billBreakdown(BUSINESS_PLAN, seats, period)!;
        expect(b.basePaise + b.gstPaise).toBe(b.totalPaise);
        expect(b.gstPaise).toBe(Math.round(b.basePaise * GST_RATE));
        expect(chargeablePaise(BUSINESS_PLAN, seats, period)).toBe(b.totalPaise);
      }
    }
  });

  it('refuses to price plans that cannot be bought', () => {
    for (const plan of PLANS) {
      if (seatRate(plan, 'monthly') > 0) continue;
      expect(chargeablePaise(plan, 1, 'monthly')).toBeNull();
      expect(chargeablePaise(plan, 1, 'annual')).toBeNull();
    }
  });
});

describe('module claims', () => {
  it('never lists the same thing as both shipped and planned', () => {
    const shipped = new Set(allCapabilities().map((c) => c.toLowerCase()));
    for (const mod of MODULES) {
      for (const item of mod.roadmap ?? []) {
        expect(shipped.has(item.toLowerCase())).toBe(false);
      }
    }
  });

  it('keeps every module claiming at least one capability', () => {
    for (const mod of MODULES) {
      expect(mod.capabilities.length).toBeGreaterThan(0);
    }
  });
});

describe('comparison-page roadmap', () => {
  it('has no duplicate entries', () => {
    const titles = ROADMAP.map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('sequences every entry', () => {
    for (const item of ROADMAP) {
      expect(['building', 'next', 'later']).toContain(item.horizon);
      expect(item.detail.length).toBeGreaterThan(20);
    }
  });
});
