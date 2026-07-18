import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS } from '@/config/plans';

export interface WorkspaceUsageInfo {
  planId: string;
  planName: string;
  memberCount: number;
  maxUsers: number;
  workspaceCount: number;
  maxWorkspaces: number;
  messageCount: number;
  monthlyMessageAllowance: number;
  isTrial: boolean;
  createdAt: Date;
}

export async function getWorkspaceUsageAndLimits(workspaceId: string): Promise<WorkspaceUsageInfo> {
  const admin = createAdminClient();

  // 1. Get the workspace plan and limits
  const { data: ws, error: wsError } = await admin
    .from('workspaces')
    .select('plan, plan_limits, created_at')
    .eq('id', workspaceId)
    .single();

  if (wsError || !ws) {
    throw new Error('Workspace not found');
  }

  const planId = ws.plan || 'growth';
  const createdAt = new Date(ws.created_at);

  // 2. Count members
  const { count: memberCount } = await admin
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  // 3. Count workspaces owned by the owner of this workspace
  const { data: ownerMember } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .maybeSingle();

  let workspaceCount = 1;
  if (ownerMember) {
    const { count: wsCount } = await admin
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ownerMember.user_id)
      .eq('role', 'owner');
    workspaceCount = wsCount || 1;
  }

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
  const planConfig = PLANS.find((p) => p.id === planId) || PLANS.find((p) => p.id === 'growth')!;

  return {
    planId,
    planName: planConfig.name,
    memberCount: memberCount || 0,
    maxUsers: planConfig.maxUsers,
    workspaceCount,
    maxWorkspaces: planConfig.maxWorkspaces,
    messageCount: messageCount || 0,
    monthlyMessageAllowance: planConfig.monthlyMessageAllowance,
    isTrial: planId === 'free',
    createdAt,
  };
}

export async function checkMessageLimit(workspaceId: string): Promise<{
  allowed: boolean;
  warn: boolean;
  messageCount: number;
  limit: number;
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

    if (count >= limit) {
      return {
        allowed: false,
        warn: false,
        messageCount: count,
        limit,
        error: `Message limit reached. You have sent ${count}/${limit} messages on the ${info.planName} plan. Please upgrade to send more.`,
      };
    }

    const warnThreshold = limit * 0.8;
    return {
      allowed: true,
      warn: count >= warnThreshold,
      messageCount: count,
      limit,
    };
  } catch (err: any) {
    console.error('[checkMessageLimit] error:', err.message);
    return { allowed: true, warn: false, messageCount: 0, limit: 999999 };
  }
}
