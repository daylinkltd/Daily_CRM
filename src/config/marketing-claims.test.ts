import { describe, it, expect } from 'vitest';

import { PLANS, SOLO_PLAN, BUSINESS_PLAN, chargeablePaise, seatRate } from './plans';
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
  it('never makes a larger tier cheaper than a smaller one', () => {
    expect(SOLO_PLAN.pricePerSeatMonthly).toBeLessThan(BUSINESS_PLAN.pricePerSeatMonthly);
    expect(SOLO_PLAN.pricePerSeatAnnual).toBeLessThan(BUSINESS_PLAN.pricePerSeatAnnual);
  });

  it('always makes annual cheaper per month than monthly', () => {
    for (const plan of PLANS) {
      if (plan.pricePerSeatMonthly <= 0) continue;
      expect(plan.pricePerSeatAnnual).toBeLessThan(plan.pricePerSeatMonthly);
    }
  });

  it('caps Solo at a single user', () => {
    // The whole justification for the lower price. If this ever becomes
    // null, Solo silently turns into an unlimited plan at ₹299.
    expect(SOLO_PLAN.maxUsers).toBe(1);
  });

  it('charges twelve months up front on annual', () => {
    const monthly = chargeablePaise(BUSINESS_PLAN, 3, 'monthly');
    const annual = chargeablePaise(BUSINESS_PLAN, 3, 'annual');
    expect(monthly).toBe(BUSINESS_PLAN.pricePerSeatMonthly * 3 * 100);
    expect(annual).toBe(BUSINESS_PLAN.pricePerSeatAnnual * 3 * 12 * 100);
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
