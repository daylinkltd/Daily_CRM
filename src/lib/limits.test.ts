import { describe, it, expect, vi, afterEach } from 'vitest';

import { resolveSubscription } from './limits';

const NOW = new Date('2026-08-06T12:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

/**
 * The read path IS the state machine — nothing runs at midnight to flip
 * statuses, so these transitions have to fall out of arithmetic on every
 * request. Each case pins one edge of that arithmetic.
 */
describe('resolveSubscription', () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  afterEach(() => {
    vi.setSystemTime(NOW);
  });

  it('runs a live trial', () => {
    const s = resolveSubscription({
      planId: 'free',
      createdAt: NOW,
      status: 'trialing',
      trialEndsAt: days(10),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    expect(s.state).toBe('trialing');
    expect(s.daysLeft).toBe(10);
    expect(s.paymentDue).toBe(false);
  });

  it('expires a trial the stored status still calls trialing', () => {
    const s = resolveSubscription({
      planId: 'free',
      createdAt: NOW,
      status: 'trialing',
      trialEndsAt: days(-1),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    expect(s.state).toBe('expired');
    expect(s.paymentDue).toBe(true);
  });

  it('derives the legacy 14-day trial from created_at when no explicit end exists', () => {
    // Pre-103 workspaces have no trial_ends_at; their contract was always
    // created_at + 14 days and must not change retroactively.
    const s = resolveSubscription({
      planId: 'free',
      createdAt: new Date(NOW.getTime() - 20 * 86_400_000),
      status: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    expect(s.state).toBe('expired');
  });

  it('keeps a paid plan active inside its period', () => {
    const s = resolveSubscription({
      planId: 'business',
      createdAt: NOW,
      status: 'active',
      trialEndsAt: null,
      currentPeriodEnd: days(20),
      cancelAtPeriodEnd: false,
    });
    expect(s.state).toBe('active');
    expect(s.daysLeft).toBe(20);
  });

  it('gives three days of grace after the period lapses, then expires', () => {
    const grace = resolveSubscription({
      planId: 'business',
      createdAt: NOW,
      status: 'active',
      trialEndsAt: null,
      currentPeriodEnd: days(-2),
      cancelAtPeriodEnd: false,
    });
    expect(grace.state).toBe('grace');
    expect(grace.paymentDue).toBe(true);

    const dead = resolveSubscription({
      planId: 'business',
      createdAt: NOW,
      status: 'active',
      trialEndsAt: null,
      currentPeriodEnd: days(-5),
      cancelAtPeriodEnd: false,
    });
    expect(dead.state).toBe('expired');
    expect(dead.paymentDue).toBe(true);
  });

  it('treats a legacy activation with no period end as active, not expired', () => {
    // Expiring every pre-103 paying customer on migration day would be a
    // self-inflicted outage.
    const s = resolveSubscription({
      planId: 'business',
      createdAt: NOW,
      status: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    expect(s.state).toBe('active');
    expect(s.paymentDue).toBe(false);
  });

  it('lets a cancelled plan run to the end of what was paid for, without a pay nag', () => {
    const s = resolveSubscription({
      planId: 'business',
      createdAt: NOW,
      status: 'cancelled',
      trialEndsAt: null,
      currentPeriodEnd: days(9),
      cancelAtPeriodEnd: true,
    });
    expect(s.state).toBe('cancelled');
    expect(s.daysLeft).toBe(9);
    // They chose to leave; the marquee is for people who owe, not people
    // who declined.
    expect(s.paymentDue).toBe(false);

    const after = resolveSubscription({
      planId: 'business',
      createdAt: NOW,
      status: 'cancelled',
      trialEndsAt: null,
      currentPeriodEnd: days(-1),
      cancelAtPeriodEnd: true,
    });
    expect(after.state).toBe('expired');
  });
});
