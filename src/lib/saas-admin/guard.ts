import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The gate on every platform-admin route.
 *
 * WHY THIS IS ONE FUNCTION AND NOT A PATTERN TO COPY. Each saas-admin
 * route used to inline the same twenty lines: getUser, select system_role,
 * compare to 'super_admin', then build a service-role client. Every one of
 * those routes hands out the service role, which bypasses RLS across all
 * tenants — so a single route that forgets a step is a full cross-tenant
 * data leak, and "twenty lines repeated eleven times" is exactly the shape
 * that eventually loses a line in a refactor.
 *
 * Centralising it also means the audit entry is written by the same code
 * that grants the privilege, rather than depending on each route to
 * remember.
 */

export interface AdminContext {
  /** Service-role client. Bypasses RLS — never hand this to a client. */
  admin: SupabaseClient;
  /** The caller, for audit entries. */
  actor: { id: string; email: string };
  /**
   * Record a privileged action. Failures are logged, never thrown: losing
   * an audit line must not roll back the operation the user asked for, and
   * a silently failed action is worse than an unlogged one.
   */
  audit: (entry: AuditEntry) => Promise<void>;
}

export interface AuditEntry {
  /** Verb-noun, stable across releases: 'tenant.plan_changed'. */
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

export type AdminGuardResult =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse };

/**
 * Authenticate and authorise a platform-admin request.
 *
 * Returns a discriminated result rather than throwing, so a route reads
 * as a straight line:
 *
 *   const guard = await requireSuperAdmin(request);
 *   if (!guard.ok) return guard.response;
 *   const { admin, audit } = guard.ctx;
 */
export async function requireSuperAdmin(request?: Request): Promise<AdminGuardResult> {
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // Read the role with the CALLER's client, not the service role. Under
  // RLS a user can only see their own profile, so this cannot be steered
  // at someone else's row by a crafted request.
  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role, email')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.system_role !== 'super_admin') {
    // 403 with no detail. Telling a signed-in non-admin that the endpoint
    // exists and merely needs a better role is free reconnaissance.
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const admin = createAdminClient();
  const actor = { id: user.id, email: profile.email ?? user.email ?? 'unknown' };

  const ipAddress = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = request?.headers.get('user-agent') ?? null;

  const audit = async (entry: AuditEntry) => {
    const { error } = await admin.from('saas_admin_audit').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      details: entry.details ?? {},
      ip_address: ipAddress,
      user_agent: userAgent,
    });
    if (error) console.error('[saas-admin] audit write failed:', error.message, entry.action);
  };

  return { ok: true, ctx: { admin, actor, audit } };
}
