import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';
import { PLANS, seatRate } from '@/config/plans';

export const dynamic = 'force-dynamic';

/**
 * GET /api/saas-admin/overview
 *
 * The numbers the console's front page is built from.
 *
 * Counts use `head: true` with an exact count so the database returns a
 * number rather than the rows. The old dashboard pulled every profile,
 * every workspace and every prospect in full just to display totals, which
 * is fine at fifty tenants and a slow page load at five thousand.
 */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const head = { count: 'exact' as const, head: true };

  const [
    workspaces,
    users,
    newWorkspaces30,
    newUsers7,
    prospects,
    openProspects,
    activeSessions,
    planRows,
  ] = await Promise.all([
    admin.from('workspaces').select('*', head),
    admin.from('profiles').select('*', head),
    admin.from('workspaces').select('*', head).gte('created_at', since30),
    admin.from('profiles').select('*', head).gte('created_at', since7),
    admin.from('prospects').select('*', head),
    admin.from('prospects').select('*', head).eq('status', 'new'),
    admin.from('user_sessions').select('*', head).eq('status', 'active'),
    // Plan mix drives the revenue estimate below, so the plan column and
    // the member count are the only fields actually needed.
    admin.from('workspaces').select('id, plan, plan_limits, created_at'),
  ]);

  const byPlan: Record<string, number> = {};
  let estimatedMrr = 0;
  let paidSeats = 0;

  for (const w of planRows.data ?? []) {
    const planId = w.plan || 'free';
    byPlan[planId] = (byPlan[planId] ?? 0) + 1;

    const plan = PLANS.find((p) => p.id === planId);
    if (!plan || plan.pricePerSeatMonthly <= 0) continue;

    // `plan_limits.max_members` is what verify-payment writes the purchased
    // seat count into, so it is the closest thing to "seats paid for".
    // Labelled an ESTIMATE throughout the UI for exactly that reason —
    // it is not read from Razorpay settlements.
    const limits = (w.plan_limits ?? {}) as { max_members?: number | null };
    const seats = Math.max(1, Number(limits.max_members) || plan.minSeats);
    paidSeats += seats;
    estimatedMrr += seatRate(plan, 'monthly') * seats;
  }

  return NextResponse.json({
    tenants: {
      total: workspaces.count ?? 0,
      new30d: newWorkspaces30.count ?? 0,
      byPlan,
    },
    users: {
      total: users.count ?? 0,
      new7d: newUsers7.count ?? 0,
      activeSessions: activeSessions.count ?? 0,
    },
    revenue: {
      estimatedMrr,
      paidSeats,
      currency: 'INR',
    },
    pipeline: {
      prospects: prospects.count ?? 0,
      open: openProspects.count ?? 0,
    },
  });
}
