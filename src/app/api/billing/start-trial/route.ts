import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BUSINESS_PLAN } from '@/config/plans';
import { clampSeats } from '@/lib/billing/seats';
import { logActivity } from '@/lib/saas-admin/activity';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/start-trial — begin the 14-day Business trial.
 *
 * The trial IS the product: every module, the seat count the founder
 * chose, no card. Paying later converts it; not paying parks it behind
 * the pay-now marquee.
 *
 * A SERVER ROUTE, not a client-side workspace update, because the seat
 * count lands in plan_limits — the same field purchases write — and the
 * client must never write that field: whoever can write plan_limits can
 * write themselves 500 seats.
 *
 * Idempotent by refusal: a workspace that has ever paid, or whose trial
 * already started, keeps what it has. Otherwise "restart my trial" would
 * be a one-request infinite trial.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { workspace_id, seats } = body;
    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Only owners or admins can start the trial' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: ws } = await admin
      .from('workspaces')
      .select('id, plan, plan_limits, subscription_status, trial_ends_at')
      .eq('id', workspace_id)
      .maybeSingle();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    if (ws.subscription_status === 'active' || (ws.plan && ws.plan !== 'free')) {
      return NextResponse.json({ error: 'This workspace already has a paid plan.' }, { status: 409 });
    }
    if (ws.trial_ends_at) {
      // Trial already started once; report its state rather than resetting
      // the clock.
      return NextResponse.json({
        ok: true,
        already: true,
        trial_ends_at: ws.trial_ends_at,
      });
    }

    const seatCount = clampSeats(BUSINESS_PLAN, 1, Number(seats) || 1);
    const trialEndsAt = new Date(Date.now() + 14 * 86_400_000).toISOString();

    const { error: updateError } = await admin
      .from('workspaces')
      .update({
        plan: 'free',
        subscription_status: 'trialing',
        trial_ends_at: trialEndsAt,
        plan_limits: {
          ...((ws.plan_limits as Record<string, unknown>) ?? {}),
          max_members: seatCount,
          seats: seatCount,
          // Deliberately NOT the Business allowance. Conversations cost
          // real money per message (Meta bills us), so an unpaid trial
          // keeps the 500-conversation cap however many seats it chose —
          // otherwise a burner signup is 5,000 conversations on our bill.
          max_messages: 500,
        },
      })
      .eq('id', workspace_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await logActivity({
      event: 'billing.trial_started',
      userId: user.id,
      userEmail: user.email,
      workspaceId: workspace_id,
      details: { seats: seatCount, trial_ends_at: trialEndsAt },
      request,
    });

    return NextResponse.json({ ok: true, seats: seatCount, trial_ends_at: trialEndsAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[start-trial]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
