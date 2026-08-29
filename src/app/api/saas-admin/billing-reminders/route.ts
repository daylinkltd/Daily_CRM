// ============================================================
// GET  /api/saas-admin/billing-reminders  — who is due a reminder
// POST /api/saas-admin/billing-reminders  — send them
//
// Trials end and paid periods lapse silently: nothing in the product
// ever told a customer their access was about to stop, so the first
// signal was a workspace that had gone read-only. This finds the
// workspaces approaching that line and emails their owners from the
// platform mailbox.
//
// Deliberately a request, not a background job: with no scheduler in
// the stack, a cron that nobody can see failing is worse than a button
// an operator presses (or a cron POSTs to). GET previews first, so
// sending is never a leap of faith.
//
// Idempotent within a day: `platform_outbound_messages` is checked for
// a reminder already sent to that owner today, so pressing twice does
// not mail anyone twice.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveSubscription } from '@/lib/limits';
import { sendPlatformMail } from '@/lib/platform/mailer';
import { BRAND } from '@/config/brand';

/** Reminders go out at these day-marks, and on the day access stops. */
const REMIND_AT_DAYS = [7, 3, 1, 0];

interface DueRow {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  ownerName: string;
  state: string;
  daysLeft: number;
}

type Admin = ReturnType<typeof createAdminClient>;

async function findDue(admin: Admin): Promise<DueRow[]> {
  const { data: workspaces } = await admin
    .from('workspaces')
    .select('id, name, plan, created_at, subscription_status, trial_ends_at, current_period_end, cancel_at_period_end');

  if (!workspaces?.length) return [];

  const { data: owners } = await admin
    .from('workspace_members')
    .select('workspace_id, user_id')
    .eq('role', 'owner');

  const ownerByWorkspace = new Map(
    (owners ?? []).map((o) => [o.workspace_id as string, o.user_id as string]),
  );
  const ownerIds = [...new Set([...ownerByWorkspace.values()])];

  const { data: profiles } = await admin
    .from('profiles')
    .select('user_id, email, full_name')
    .in('user_id', ownerIds.length ? ownerIds : ['00000000-0000-0000-0000-000000000000']);
  const profileBy = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const due: DueRow[] = [];
  for (const ws of workspaces) {
    const sub = resolveSubscription({
      planId: ws.plan || 'growth',
      createdAt: new Date(ws.created_at),
      status: ws.subscription_status ?? null,
      trialEndsAt: ws.trial_ends_at ?? null,
      currentPeriodEnd: ws.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(ws.cancel_at_period_end),
    });

    // Nothing to warn about on a healthy paid period that is not near
    // its end, and nothing useful to say to an already-expired one that
    // has been expired for a while.
    if (!REMIND_AT_DAYS.includes(sub.daysLeft)) continue;
    if (sub.state === 'active' && !sub.cancelAtPeriodEnd && sub.daysLeft > 7) continue;

    const ownerId = ownerByWorkspace.get(ws.id);
    const profile = ownerId ? profileBy.get(ownerId) : null;
    if (!profile?.email) continue;

    due.push({
      workspaceId: ws.id,
      workspaceName: ws.name,
      ownerEmail: profile.email,
      ownerName: profile.full_name?.trim() || 'there',
      state: sub.state,
      daysLeft: sub.daysLeft,
    });
  }
  return due;
}

export async function GET(request: NextRequest) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;

  const due = await findDue(guard.ctx.admin);
  return NextResponse.json({ due, count: due.length });
}

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, audit } = guard.ctx;

  const due = await findDue(admin);
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const row of due) {
    // Already reminded today? Leave them alone.
    const { count } = await admin
      .from('platform_outbound_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient', row.ownerEmail)
      .eq('status', 'sent')
      .like('subject', '[billing_reminder]%')
      .gte('created_at', since);
    if ((count ?? 0) > 0) { skipped++; continue; }

    const ending = row.state === 'trialing' ? 'trial' : 'subscription';
    const when =
      row.daysLeft === 0
        ? 'today'
        : `in ${row.daysLeft} day${row.daysLeft === 1 ? '' : 's'}`;

    const result = await sendPlatformMail({
      to: row.ownerEmail,
      kind: 'billing_reminder',
      workspaceId: row.workspaceId,
      subject:
        row.daysLeft === 0
          ? `${row.workspaceName}: your ${BRAND.name} ${ending} ends today`
          : `${row.workspaceName}: your ${BRAND.name} ${ending} ends ${when}`,
      body: `
        <p>Hi ${row.ownerName},</p>
        <p>Your ${ending} for <strong>${row.workspaceName}</strong> ends ${when}.</p>
        <p>Everything you have set up stays exactly as it is — subscribing
           keeps your team working without interruption.</p>
        <p style="margin:24px 0;">
          <a href="${BRAND.appUrl}/settings?tab=billing"
             style="display:inline-block;padding:12px 22px;background:#0f172a;color:#ffffff;
                    text-decoration:none;border-radius:10px;font-weight:600;">
            Review billing
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">
          Already subscribed? Then nothing is needed — this reminder crossed
          with your payment.
        </p>`,
    });

    if (result.ok) sent++;
    else failures.push(`${row.ownerEmail}: ${result.error}`);
  }

  await audit({
    action: 'billing.reminders_sent',
    targetType: 'platform',
    details: { due: due.length, sent, skipped, failed: failures.length },
  });

  return NextResponse.json({
    ok: true,
    due: due.length,
    sent,
    skipped,
    failures: failures.slice(0, 20),
  });
}
