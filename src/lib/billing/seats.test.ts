import { describe, it, expect } from 'vitest';

import { BUSINESS_PLAN, PLANS } from '@/config/plans';
import { clampSeats, seatFloor, validateSeats, MAX_SEATS } from './seats';

const ENTERPRISE = PLANS.find((p) => p.id === 'custom')!;

describe('seatFloor', () => {
  it('never goes below one', () => {
    expect(seatFloor(BUSINESS_PLAN, 0)).toBe(1);
    expect(seatFloor(BUSINESS_PLAN, -5)).toBe(1);
    expect(seatFloor(BUSINESS_PLAN, Number.NaN)).toBe(1);
  });

  it('tracks the workspace headcount', () => {
    expect(seatFloor(BUSINESS_PLAN, 8)).toBe(8);
  });

  it('respects a plan minimum above the headcount', () => {
    // Enterprise starts at 25 even for a team of three.
    expect(seatFloor(ENTERPRISE, 3)).toBe(ENTERPRISE.minSeats);
  });
});

describe('clampSeats', () => {
  it('pulls a too-small request up to the floor', () => {
    expect(clampSeats(BUSINESS_PLAN, 8, 1)).toBe(8);
  });

  it('caps a runaway request', () => {
    expect(clampSeats(BUSINESS_PLAN, 2, 99_999)).toBe(MAX_SEATS);
  });

  it('leaves a sensible request alone', () => {
    expect(clampSeats(BUSINESS_PLAN, 3, 12)).toBe(12);
  });

  it('survives a cleared number input', () => {
    // <input type="number"> yields NaN when emptied, which must not become
    // a zero-seat order.
    expect(clampSeats(BUSINESS_PLAN, 4, Number.NaN)).toBe(4);
  });
});

describe('validateSeats', () => {
  it('rejects buying fewer seats than the team has members', () => {
    // The revenue bug this exists for: an eight-person workspace paying for
    // one seat by posting straight to the API.
    const result = validateSeats(BUSINESS_PLAN, 8, 1);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('8 members');
  });

  it('accepts an exact match', () => {
    expect(validateSeats(BUSINESS_PLAN, 8, 8).ok).toBe(true);
  });

  it('accepts buying ahead of hiring', () => {
    expect(validateSeats(BUSINESS_PLAN, 8, 20).ok).toBe(true);
  });

  it('rejects fractional, zero and absurd counts', () => {
    expect(validateSeats(BUSINESS_PLAN, 1, 2.5).ok).toBe(false);
    expect(validateSeats(BUSINESS_PLAN, 1, 0).ok).toBe(false);
    expect(validateSeats(BUSINESS_PLAN, 1, MAX_SEATS + 1).ok).toBe(false);
    expect(validateSeats(BUSINESS_PLAN, 1, 'eight').ok).toBe(false);
  });

  it('enforces a plan user ceiling when one exists', () => {
    const capped = { ...BUSINESS_PLAN, name: 'Capped', maxUsers: 3 };
    expect(validateSeats(capped, 1, 4).ok).toBe(false);
    expect(validateSeats(capped, 1, 3).ok).toBe(true);
  });
});
