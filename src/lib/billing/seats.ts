import type { Plan } from '@/config/plans';

/**
 * Seat rules, shared by the billing panel and the checkout API.
 *
 * WHY THIS IS NOT JUST UI LOGIC. The panel clamps the stepper so nobody
 * *accidentally* buys fewer seats than their team size — but a clamp in a
 * React component is a suggestion, not a rule. `POST /api/billing/checkout`
 * with `{"seats": 1}` from an eight-person workspace is one curl away, and
 * the amount is computed from the seat count, so the whole subscription
 * would be underpaid. The server calls the same function against a live
 * member count, which is what actually enforces it.
 *
 * Keeping the two on one implementation also means the price the buyer is
 * shown and the price the server is willing to accept can never disagree
 * over a rounding or floor rule.
 */

/**
 * Upper bound on a single purchase.
 *
 * Not a plan limit — Business is genuinely unlimited. It stops a typo in a
 * number field from becoming an order worth lakhs that then has to be
 * refunded. Larger teams go through Enterprise, where someone reads the
 * number before it is charged.
 */
export const MAX_SEATS = 500;

/** The fewest seats a workspace of this size may buy on this plan. */
export function seatFloor(plan: Plan, memberCount: number): number {
  return Math.max(1, Math.floor(memberCount) || 1, plan.minSeats);
}

/** Clamp a requested seat count into the allowed range for a workspace. */
export function clampSeats(plan: Plan, memberCount: number, requested: number): number {
  const floor = seatFloor(plan, memberCount);
  if (!Number.isFinite(requested)) return floor;
  return Math.min(MAX_SEATS, Math.max(floor, Math.round(requested)));
}

export interface SeatCheck {
  ok: boolean;
  error?: string;
}

/**
 * Server-side validation. Returns a message fit to show the buyer.
 *
 * Deliberately rejects rather than silently clamping upward: quietly
 * charging someone more than the amount they clicked is worse than making
 * them click again, even when the larger number is the correct one.
 */
export function validateSeats(
  plan: Plan,
  memberCount: number,
  requested: unknown,
): SeatCheck {
  const seats = Number(requested);

  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    return { ok: false, error: `seats must be a whole number between 1 and ${MAX_SEATS}` };
  }

  const floor = seatFloor(plan, memberCount);
  if (seats < floor) {
    return {
      ok: false,
      error:
        memberCount > plan.minSeats
          ? `This workspace has ${memberCount} members, so it needs at least ${memberCount} seats. Remove members first if you want a smaller subscription.`
          : `The ${plan.name} plan starts at ${plan.minSeats} seats.`,
    };
  }

  if (plan.maxUsers !== null && seats > plan.maxUsers) {
    return {
      ok: false,
      error: `The ${plan.name} plan is limited to ${plan.maxUsers} user${
        plan.maxUsers === 1 ? '' : 's'
      }.`,
    };
  }

  return { ok: true };
}
