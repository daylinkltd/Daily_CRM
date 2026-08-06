import { NextResponse, type NextRequest } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';
import { PLANS } from '@/config/plans';

export const dynamic = 'force-dynamic';

/** Feature toggles the console may flip, and their DB column names. */
const FEATURE_COLUMNS = [
  'enable_crm',
  'enable_hr',
  'enable_retail',
  'enable_projects',
  'enable_manufacturing',
  'enable_wms',
  'enable_services',
] as const;

/** GET /api/saas-admin/tenants/[id] — everything about one tenant. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;
  const { id } = await params;

  const [workspace, members, flags, usage] = await Promise.all([
    // '*' already includes the subscription columns from migration 103.
    admin.from('workspaces').select('*').eq('id', id).maybeSingle(),
    admin
      .from('workspace_members')
      .select('id, user_id, role, created_at, profiles(full_name, email, status, system_role)')
      .eq('workspace_id', id),
    admin.from('saas_workspace_feature_flags').select('*').eq('workspace_id', id).maybeSingle(),
    // Cheap activity signal without dragging message bodies across.
    admin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', id)
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ]);

  if (!workspace.data) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  return NextResponse.json({
    workspace: workspace.data,
    members: members.data ?? [],
    flags: flags.data ?? null,
    usage: { messages30d: usage.count ?? 0 },
  });
}

/**
 * PATCH /api/saas-admin/tenants/[id]
 *
 * Body may carry any of `plan`, `plan_limits`, `flags`.
 *
 * Every branch writes an audit entry with the BEFORE value, because the
 * question asked after an incident is never "what is the plan now" — the
 * console already shows that — it is "what was it, and who changed it".
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, audit } = guard.ctx;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));

  const { data: before } = await admin
    .from('workspaces')
    .select('id, name, plan, plan_limits')
    .eq('id', id)
    .maybeSingle();

  if (!before) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const patch: Record<string, unknown> = {};

  if (typeof body.plan === 'string') {
    if (!PLANS.some((p) => p.id === body.plan)) {
      return NextResponse.json({ error: `Unknown plan: ${body.plan}` }, { status: 400 });
    }
    patch.plan = body.plan;
  }

  if (body.plan_limits && typeof body.plan_limits === 'object') {
    // Merged, not replaced. A console form that posts only max_members
    // must not silently drop the channel list and the automation cap.
    patch.plan_limits = { ...(before.plan_limits ?? {}), ...body.plan_limits };
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('workspaces').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await audit({
      action: 'tenant.updated',
      targetType: 'workspace',
      targetId: id,
      details: {
        name: before.name,
        before: { plan: before.plan, plan_limits: before.plan_limits },
        after: patch,
      },
    });
  }

  // Subscription overrides — the platform's escape hatches. Each writes
  // an audit entry with the before value, because these are exactly the
  // fields a billing dispute will ask about later.
  const subPatch: Record<string, unknown> = {};

  if (typeof body.extend_trial_days === 'number' && body.extend_trial_days > 0) {
    const days = Math.min(90, Math.round(body.extend_trial_days));
    // Extend from whichever is later, now or the current end — extending
    // an expired trial by 7 days should give 7 usable days, not 7 days
    // ago.
    const { data: current } = await admin
      .from('workspaces')
      .select('trial_ends_at')
      .eq('id', id)
      .maybeSingle();
    const base = Math.max(
      Date.now(),
      current?.trial_ends_at ? new Date(current.trial_ends_at).getTime() : 0,
    );
    subPatch.trial_ends_at = new Date(base + days * 86_400_000).toISOString();
    subPatch.subscription_status = 'trialing';
  }

  if (['trialing', 'active', 'cancelled'].includes(body.subscription_status)) {
    subPatch.subscription_status = body.subscription_status;
  }

  if (body.current_period_end !== undefined) {
    const t = body.current_period_end ? Date.parse(body.current_period_end) : NaN;
    if (Number.isFinite(t)) subPatch.current_period_end = new Date(t).toISOString();
  }

  if (Object.keys(subPatch).length > 0) {
    const { data: beforeSub } = await admin
      .from('workspaces')
      .select('subscription_status, trial_ends_at, current_period_end')
      .eq('id', id)
      .maybeSingle();

    const { error } = await admin.from('workspaces').update(subPatch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await audit({
      action: 'tenant.subscription_overridden',
      targetType: 'workspace',
      targetId: id,
      details: { name: before.name, before: beforeSub, after: subPatch },
    });
  }

  if (body.flags && typeof body.flags === 'object') {
    const flagPatch: Record<string, boolean> = {};
    for (const col of FEATURE_COLUMNS) {
      if (typeof body.flags[col] === 'boolean') flagPatch[col] = body.flags[col];
    }

    if (Object.keys(flagPatch).length > 0) {
      const { error } = await admin
        .from('saas_workspace_feature_flags')
        .upsert(
          { workspace_id: id, ...flagPatch, updated_at: new Date().toISOString() },
          { onConflict: 'workspace_id' },
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await audit({
        action: 'tenant.flags_updated',
        targetType: 'workspace',
        targetId: id,
        details: { name: before.name, flags: flagPatch },
      });
    }
  }

  const { data: after } = await admin.from('workspaces').select('*').eq('id', id).maybeSingle();
  return NextResponse.json({ workspace: after });
}
