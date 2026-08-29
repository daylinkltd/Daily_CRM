import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Platform-wide activity logging.
 *
 * Distinct from `saas_admin_audit`, which records what an ADMINISTRATOR
 * did. This records what the SYSTEM did — sign-ins, plan changes,
 * payments, invitations, blocked users — so the console can answer "what
 * happened to this account" without anyone having to have been watching.
 *
 * ADMIN-ONLY. `platform_activity_log` has RLS on and no policy, so no
 * tenant role can read a row. That is deliberate: the log spans every
 * tenant, and a single leaked row exposes another customer's name,
 * sign-in times and IP address.
 *
 * NEVER LOG A SECRET. Not a token, not a password, not a card number, not
 * an API key, not a signed URL. A log is the one place data goes that
 * nobody deletes.
 */

export type Severity = 'info' | 'warning' | 'error';

export interface ActivityEntry {
  /** Dotted and stable across releases: 'billing.plan_changed'. */
  event: string;
  severity?: Severity;
  userId?: string | null;
  userEmail?: string | null;
  workspaceId?: string | null;
  details?: Record<string, unknown>;
  request?: Request;
}

/**
 * Write one activity row.
 *
 * Never throws and never awaits anything the caller needs. A logging
 * failure must not fail the payment, the invite or the login that
 * triggered it — an unlogged success is recoverable, a failed checkout
 * because the log table was busy is not.
 */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('platform_activity_log').insert({
      event: entry.event,
      severity: entry.severity ?? 'info',
      user_id: entry.userId ?? null,
      user_email: entry.userEmail ?? null,
      workspace_id: entry.workspaceId ?? null,
      details: entry.details ?? {},
      ip_address:
        entry.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: entry.request?.headers.get('user-agent') ?? null,
    });
    if (error) console.error('[activity] insert failed:', error.message, entry.event);
  } catch (err) {
    console.error('[activity] threw:', err instanceof Error ? err.message : err);
  }
}

/**
 * The event names in use, so they stay spellable and greppable.
 *
 * A typo'd event name does not error — it just creates a row nobody will
 * ever filter for, which is the same as not logging it.
 */
export const ACTIVITY = {
  CHECKOUT_STARTED: 'billing.checkout_started',
  PAYMENT_VERIFIED: 'billing.payment_verified',
  PAYMENT_REJECTED: 'billing.payment_rejected',
  PLAN_CHANGED: 'billing.plan_changed',
  MEMBER_INVITED: 'workspace.member_invited',
  MEMBER_JOINED: 'workspace.member_joined',
  MEMBER_REMOVED: 'workspace.member_removed',
  WORKSPACE_CREATED: 'workspace.created',
  SEAT_LIMIT_HIT: 'workspace.seat_limit_hit',
  MEMBER_PASSWORD_SET: 'workspace.member_password_set',
  MEMBER_PASSWORD_RESET_EMAILED: 'workspace.member_password_reset_emailed',
  WORKSPACE_CONFIG_COPIED: 'workspace.config_copied',
} as const;
