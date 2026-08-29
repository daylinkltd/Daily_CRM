import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS } from '@/config/plans';

export interface WorkspaceUsageInfo {
  planId: string;
  planName: string;
  memberCount: number;
  /** null = unlimited. Callers must handle it — see checkMessageLimit. */
  maxUsers: number | null;
  workspaceCount: number;
  maxWorkspaces: number | null;
  messageCount: number;
  /** Pooled conversations per month; null = unlimited / custom terms. */
  monthlyMessageAllowance: number | null;
  isTrial: boolean;
  createdAt: Date;
  subscription: SubscriptionInfo;
}

/**
 * The lifecycle state a workspace's subscription is in.
 *
 * Derived, never stored raw: the stored status says what the workspace
 * bought or chose, and TIME decides what that means today. A 'trialing'
 * row whose trial_ends_at has passed IS expired regardless of what the
 * column says, because nothing runs at midnight to flip statuses — the
 * read path is the state machine.
 */
export interface SubscriptionInfo {
  state: 'trialing' | 'active' | 'grace' | 'expired' | 'cancelled';
  /** Days remaining in trial or paid period. 0 when expired. */
  daysLeft: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** True when the pay-now marquee should show. */
  paymentDue: boolean;
}

/** Days from now, floored at 0. */
function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function resolveSubscription(input: {
  planId: string;
  createdAt: Date;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}): SubscriptionInfo {
  // Workspaces created before migration 103 have no explicit trial end;
  // their trial has always been created_at + 14 days, so keep that rule.
  const trialEndsAt =
    input.trialEndsAt ??
    (input.planId === 'free'
      ? new Date(input.createdAt.getTime() + 14 * 86_400_000).toISOString()
      : null);

  const status = input.status ?? (input.planId === 'free' ? 'trialing' : 'active');

  if (status === 'cancelled') {
    // Cancelled keeps access until the paid period runs out — that is
    // what "cancel anytime" has to mean when the money was taken up
    // front. After that it is expired like anything else.
    const left = daysUntil(input.currentPeriodEnd);
    return {
      state: left > 0 ? 'cancelled' : 'expired',
      daysLeft: left,
      trialEndsAt,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: true,
      paymentDue: false,
    };
  }

  if (status === 'trialing') {
    const left = daysUntil(trialEndsAt);
    return {
      state: left > 0 ? 'trialing' : 'expired',
      daysLeft: left,
      trialEndsAt,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      paymentDue: left <= 0,
    };
  }

  // Paid. A null period end means a legacy activation from before 103 —
  // treat as active rather than expiring everyone retroactively.
  const left = input.currentPeriodEnd ? daysUntil(input.currentPeriodEnd) : null;
  if (left === null || left > 0) {
    return {
      state: 'active',
      daysLeft: left ?? 9999,
      trialEndsAt,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      paymentDue: false,
    };
  }

  // Period lapsed. Three days of grace before the marquee turns into a
  // wall, because "card expired over the weekend" should not brick a
  // business on Monday morning.
  const graceDays = 3;
  const lapsedDays = Math.ceil(
    (Date.now() - new Date(input.currentPeriodEnd!).getTime()) / 86_400_000,
  );
  return {
    state: lapsedDays <= graceDays ? 'grace' : 'expired',
    daysLeft: 0,
    trialEndsAt,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    paymentDue: true,
  };
}

export async function getWorkspaceUsageAndLimits(workspaceId: string): Promise<WorkspaceUsageInfo> {
  const admin = createAdminClient();

  // 1. Get the workspace plan and limits
  const { data: ws, error: wsError } = await admin
    .from('workspaces')
    .select('plan, plan_limits, created_at, subscription_status, trial_ends_at, current_period_end, cancel_at_period_end')
    .eq('id', workspaceId)
    .single();

  if (wsError || !ws) {
    throw new Error('Workspace not found');
  }

  const planId = ws.plan || 'growth';
  const createdAt = new Date(ws.created_at);

  // 2. The owner, and therefore the tenant: every workspace this person
  //    owns shares one subscription and one pool of seats.
  const { data: ownerMember } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .maybeSingle();

  let tenantWorkspaceIds: string[] = [workspaceId];
  let workspaceCount = 1;
  if (ownerMember) {
    const { data: owned } = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', ownerMember.user_id)
      .eq('role', 'owner');
    if (owned?.length) {
      tenantWorkspaceIds = owned.map((r) => r.workspace_id as string);
      workspaceCount = owned.length;
    }
  }

  // 3. Seats are PEOPLE, not memberships. Someone who works in three of
  //    the tenant's workspaces occupies one seat — counting rows instead
  //    would bill them three times, and counting only this workspace let
  //    a 5-seat plan carry 20 people split across four workspaces.
  const { data: tenantMemberRows } = await admin
    .from('workspace_members')
    .select('user_id')
    .in('workspace_id', tenantWorkspaceIds);
  const memberCount = new Set((tenantMemberRows ?? []).map((r) => r.user_id)).size;

  // 4. Count outbound messages ('agent' or 'bot') in the current month (or total if free trial)
  let startDateTime = new Date();
  if (planId === 'free') {
    startDateTime = createdAt;
  } else {
    startDateTime = new Date();
    startDateTime.setUTCDate(1);
    startDateTime.setUTCHours(0, 0, 0, 0);
  }

  const { count: messageCount } = await admin
    .from('messages')
    .select('id, conversations!inner(workspace_id)', { count: 'exact', head: true })
    .eq('conversations.workspace_id', workspaceId)
    .in('sender_type', ['agent', 'bot'])
    .gte('created_at', startDateTime.toISOString());

  // Find the plan config
  // 'growth' no longer exists; fall back to the paid plan, not a
  // missing id — `!` on an undefined find would crash at runtime.
  const planConfig =
    PLANS.find((p) => p.id === planId) ?? PLANS.find((p) => p.id === 'business')!;

  // PURCHASED limits first, static plan config as the fallback.
  //
  // verify-payment writes the bought seat count into
  // plan_limits.max_members; this function used to ignore that entirely
  // and return the static plan ceiling, so a customer who paid for five
  // seats was shown (and gated by) the plan default. The purchase is the
  // authority whenever it exists.
  const bought = (ws.plan_limits ?? {}) as {
    max_members?: number | null;
    max_workspaces?: number | null;
    max_messages?: number | null;
  };

  const subscription = resolveSubscription({
    planId,
    createdAt,
    status: ws.subscription_status ?? null,
    trialEndsAt: ws.trial_ends_at ?? null,
    currentPeriodEnd: ws.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(ws.cancel_at_period_end),
  });

  return {
    planId,
    planName: planConfig.name,
    memberCount,
    maxUsers: Number(bought.max_members) || planConfig.maxUsers,
    workspaceCount,
    maxWorkspaces: Number(bought.max_workspaces) || planConfig.maxWorkspaces,
    messageCount: messageCount || 0,
    monthlyMessageAllowance:
      Number(bought.max_messages) || planConfig.monthlyMessageAllowance,
    isTrial: subscription.state === 'trialing',
    createdAt,
    subscription,
  };
}

export async function checkMessageLimit(workspaceId: string): Promise<{
  allowed: boolean;
  warn: boolean;
  messageCount: number;
  limit: number | null;
  error?: string;
}> {
  try {
    const info = await getWorkspaceUsageAndLimits(workspaceId);
    const limit = info.monthlyMessageAllowance;
    const count = info.messageCount;

    // Check if free trial has expired (14 days)
    if (info.planId === 'free') {
      const trialDurationMs = 14 * 24 * 60 * 60 * 1000;
      const trialExpired = (Date.now() - info.createdAt.getTime()) > trialDurationMs;
      if (trialExpired) {
        return {
          allowed: false,
          warn: false,
          messageCount: count,
          limit,
          error: `Your 14-day Free Trial has expired. Please upgrade your plan to resume messaging.`,
        };
      }
    }

    // null allowance = unlimited, so nothing to enforce.
    if (limit !== null && count >= limit) {
      return {
        allowed: false,
        warn: false,
        messageCount: count,
        limit,
        error: `Message limit reached. You have sent ${count}/${limit} messages on the ${info.planName} plan. Please upgrade to send more.`,
      };
    }

    // Unlimited plans never warn — there is no threshold to approach.
    return {
      allowed: true,
      warn: limit !== null && count >= limit * 0.8,
      messageCount: count,
      limit,
    };
  } catch (err: any) {
    console.error('[checkMessageLimit] error:', err.message);
    // A workspace that definitively doesn't exist must not send —
    // fail closed. Transient DB errors still fail open so a hiccup
    // doesn't block every tenant's messaging.
    if (typeof err?.message === 'string' && err.message.includes('Workspace not found')) {
      return {
        allowed: false,
        warn: false,
        messageCount: 0,
        limit: 0,
        error: 'Workspace not found for this conversation. Cannot verify plan limits.',
      };
    }
    return { allowed: true, warn: false, messageCount: 0, limit: 999999 };
  }
}
