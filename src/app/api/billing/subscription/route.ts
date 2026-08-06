import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/saas-admin/activity';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/subscription — { workspace_id, action: 'cancel' | 'resume' }
 *
 * WHAT CANCEL MEANS HERE, precisely: payments are one-off Razorpay orders,
 * so there is no mandate to revoke and no future charge to stop. Cancel
 * is therefore a promise about OUR behaviour — we stop asking for money,
 * access runs to the end of what was already paid, and nothing renews.
 * Resume simply withdraws the cancellation while the period is still
 * running. Neither moves any money, which is why neither touches the hub.
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
    const { workspace_id, action } = body;
    if (!workspace_id || !['cancel', 'resume'].includes(action)) {
      return NextResponse.json(
        { error: 'workspace_id and action (cancel|resume) are required' },
        { status: 400 },
      );
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();
    // Owner only — stricter than checkout's owner/admin. An admin can
    // spend the company's money on more seats; ending the service the
    // whole team runs on belongs to the person who owns the workspace.
    if (!member || member.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the workspace owner can cancel or resume the subscription.' },
        { status: 403 },
      );
    }

    const admin = createAdminClient();
    const { data: ws } = await admin
      .from('workspaces')
      .select('id, name, subscription_status, current_period_end, trial_ends_at')
      .eq('id', workspace_id)
      .maybeSingle();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    if (action === 'cancel') {
      if (ws.subscription_status === 'cancelled') {
        return NextResponse.json({ ok: true, already: true });
      }
      const { error } = await admin
        .from('workspaces')
        .update({ subscription_status: 'cancelled', cancel_at_period_end: true })
        .eq('id', workspace_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await logActivity({
        event: 'billing.subscription_cancelled',
        severity: 'warning',
        userId: user.id,
        userEmail: user.email,
        workspaceId: workspace_id,
        details: { name: ws.name, access_until: ws.current_period_end ?? ws.trial_ends_at },
        request,
      });

      return NextResponse.json({
        ok: true,
        access_until: ws.current_period_end ?? ws.trial_ends_at,
      });
    }

    // resume
    const wasPaid = Boolean(ws.current_period_end);
    const { error } = await admin
      .from('workspaces')
      .update({
        subscription_status: wasPaid ? 'active' : 'trialing',
        cancel_at_period_end: false,
      })
      .eq('id', workspace_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      event: 'billing.subscription_resumed',
      userId: user.id,
      userEmail: user.email,
      workspaceId: workspace_id,
      details: { name: ws.name },
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[billing/subscription]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
