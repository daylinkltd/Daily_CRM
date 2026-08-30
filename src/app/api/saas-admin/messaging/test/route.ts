// ============================================================
// POST /api/saas-admin/messaging/test
//
// Send one email to the signed-in admin's own address and hand back
// exactly what the provider said.
//
// Debugging a mailbox used to mean triggering a real password reset and
// then reading the send log — a slow loop that also emails a customer.
// This closes it: press, read the error, change a setting, press again.
// The address is the caller's own, so this cannot be used to mail
// anyone else.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';
import { loadMessagingConfig } from '@/lib/saas-admin/messaging-config';
import { sendPlatformEmail, buildFromHeader } from '@/lib/saas-admin/messaging';
import { wrapPlatformEmail } from '@/lib/platform/mailer';
import {
  describeCredential,
  detectProvider,
  diagnoseGraph,
  tryCandidates,
} from '@/lib/saas-admin/smtp-diagnose';
import { BRAND } from '@/config/brand';

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, actor } = guard.ctx;

  if (!actor.email) {
    return NextResponse.json(
      { error: 'Your admin account has no email address to send to.' },
      { status: 400 },
    );
  }

  const config = await loadMessagingConfig(admin);
  const user = config.smtp_user?.trim() ?? '';
  const host = config.smtp_host?.trim() || 'smtp.office365.com';
  const port = config.smtp_port?.trim() || '587';

  const body = wrapPlatformEmail(
    'Platform email is working',
    `<p>This is a test from ${BRAND.name}'s SaaS console. If you are reading it,
        password resets, sign-in codes, invitations and billing reminders can
        all be delivered.</p>
     <p style="color:#64748b;font-size:13px;">
       Sent via <strong>${host}:${port}</strong> as
       <strong>${buildFromHeader(config.smtp_from, user)}</strong>.
     </p>`,
  );

  const result = await sendPlatformEmail(config, {
    to: actor.email,
    subject: `${BRAND.name} — platform email test`,
    body,
  });

  // Recorded like any other send, so a test and a real failure sit in
  // the same history rather than in two places.
  await admin.from('platform_outbound_messages').insert({
    channel: 'email',
    recipient: actor.email,
    subject: `[test] ${BRAND.name} — platform email test`,
    body,
    status: result.ok ? 'sent' : 'failed',
    provider_id: result.ok ? (result.providerId ?? null) : null,
    error: result.ok ? null : (result.error ?? 'send failed'),
    sent_by: actor.id,
    sent_by_email: actor.email,
  });

  if (!result.ok) {
    // Graph has its own four settings; diagnosing them as if they were
    // SMTP would point at the wrong things entirely.
    if (config.email_provider?.trim().toLowerCase() === 'microsoft') {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          provider: 'microsoft',
          graphChecks: await diagnoseGraph(config),
        },
        { status: 502 },
      );
    }

    // A refusal is where the guessing starts, so answer the questions
    // that refusal cannot: who hosts this domain, does the credential
    // look intact, and does ANY of that provider's endpoints accept it.
    const profile = await detectProvider(user);
    const credential = describeCredential(config.smtp_pass);
    const attempts = config.smtp_pass
      ? await tryCandidates(profile.candidates, user, config.smtp_pass)
      : [];

    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        host,
        port,
        from: buildFromHeader(config.smtp_from, user),
        diagnosis: {
          provider: profile.provider,
          mx: profile.mx,
          advice: profile.advice,
          credential,
          attempts,
        },
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    to: actor.email,
    host,
    port,
    from: buildFromHeader(config.smtp_from, user),
  });
}
