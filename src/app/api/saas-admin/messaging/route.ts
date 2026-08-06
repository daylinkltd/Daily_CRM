import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';
import {
  channelStatuses,
  renderTemplate,
  sendPlatformEmail,
  sendPlatformSms,
  sendPlatformWhatsApp,
  type PlatformChannel,
} from '@/lib/saas-admin/messaging';
import { loadMessagingConfig } from '@/lib/saas-admin/messaging-config';

export const dynamic = 'force-dynamic';

/**
 * How many recipients one send may address. A platform message to every
 * tenant owner is a few hundred rows at most today; anything larger is a
 * campaign tool's job, and a runaway loop inside a serverless request is
 * how sends get half-delivered with no record of where they stopped.
 */
const MAX_RECIPIENTS = 300;

/** GET — channel status, templates, and recent send history. */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;

  const [templates, history, config] = await Promise.all([
    admin.from('platform_message_templates').select('*').order('created_at', { ascending: false }),
    admin
      .from('platform_outbound_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    loadMessagingConfig(admin),
  ]);

  return NextResponse.json({
    channels: channelStatuses(config),
    templates: templates.data ?? [],
    history: history.data ?? [],
  });
}

interface Recipient {
  /** Email address or phone, depending on channel. */
  to: string;
  workspaceId: string | null;
  workspaceName: string | null;
  vars: Record<string, string>;
}

/**
 * POST — send one message to an audience.
 *
 * Body: {
 *   channel: 'email' | 'whatsapp' | 'sms',
 *   audience: 'owners' | 'trial_owners' | 'expired_owners' | 'manual',
 *   manual_recipients?: string[],        // when audience = manual
 *   template_id?: string,                // or subject/body inline
 *   subject?: string,
 *   body?: string,
 * }
 *
 * Audiences resolve to WORKSPACE OWNERS — the platform's counterparty is
 * the business, and the owner is who it talks to. Each recipient gets
 * the template rendered with their own variables ({{name}},
 * {{workspace}}, {{plan}}, {{trial_ends}}).
 */
export async function POST(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, actor, audit } = guard.ctx;

  const body = await request.json().catch(() => ({}));
  const channel = body.channel as PlatformChannel;
  if (!['email', 'whatsapp', 'sms'].includes(channel)) {
    return NextResponse.json({ error: 'channel must be email, whatsapp or sms' }, { status: 400 });
  }

  const config = await loadMessagingConfig(admin);
  const status = channelStatuses(config).find((c) => c.channel === channel)!;
  if (!status.configured) {
    return NextResponse.json(
      { error: `The ${channel} channel is not configured. Missing: ${status.missing.join(', ')}` },
      { status: 400 },
    );
  }

  // ---- Template or inline content -----------------------------------
  let subject: string = body.subject ?? '';
  let messageBody: string = body.body ?? '';
  let templateId: string | null = null;
  let metaTemplateName: string | null = null;
  let metaTemplateLanguage: string | null = null;

  if (body.template_id) {
    const { data: tpl } = await admin
      .from('platform_message_templates')
      .select('*')
      .eq('id', body.template_id)
      .maybeSingle();
    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    if (tpl.channel !== channel) {
      return NextResponse.json(
        { error: `That template is for ${tpl.channel}, not ${channel}.` },
        { status: 400 },
      );
    }
    templateId = tpl.id;
    subject = tpl.subject ?? subject;
    messageBody = tpl.body;
    metaTemplateName = tpl.meta_template_name;
    metaTemplateLanguage = tpl.meta_template_language;
  }

  if (!messageBody.trim()) {
    return NextResponse.json({ error: 'The message body is empty.' }, { status: 400 });
  }
  if (channel === 'email' && !subject.trim()) {
    return NextResponse.json({ error: 'Email needs a subject.' }, { status: 400 });
  }
  if (channel === 'whatsapp' && !metaTemplateName) {
    // Meta rejects business-initiated free text outside the 24h window.
    // Refusing here, with the reason, beats 300 rows of Meta error codes.
    return NextResponse.json(
      {
        error:
          'WhatsApp sends need a template with an approved Meta template name — business-initiated free text is rejected by Meta outside a 24-hour service window.',
      },
      { status: 400 },
    );
  }

  // ---- Resolve the audience ------------------------------------------
  const audience = String(body.audience ?? 'manual');
  const recipients: Recipient[] = [];

  if (audience === 'manual') {
    const manual: string[] = Array.isArray(body.manual_recipients) ? body.manual_recipients : [];
    for (const to of manual.slice(0, MAX_RECIPIENTS)) {
      if (typeof to === 'string' && to.trim()) {
        recipients.push({ to: to.trim(), workspaceId: null, workspaceName: null, vars: {} });
      }
    }
  } else {
    // Owner of every workspace, optionally filtered by subscription state.
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('id, name, plan, subscription_status, trial_ends_at, company_phone')
      .limit(2000);

    const wanted = (workspaces ?? []).filter((w) => {
      if (audience === 'owners') return true;
      if (audience === 'trial_owners') return (w.subscription_status ?? 'trialing') === 'trialing';
      if (audience === 'expired_owners') {
        const trialEnd = w.trial_ends_at ? new Date(w.trial_ends_at).getTime() : null;
        return (
          (w.subscription_status ?? 'trialing') === 'trialing' &&
          trialEnd !== null &&
          trialEnd < Date.now()
        );
      }
      return false;
    });

    const ids = wanted.map((w) => w.id);
    if (ids.length > 0) {
      const { data: owners } = await admin
        .from('workspace_members')
        .select('workspace_id, profiles(full_name, email)')
        .eq('role', 'owner')
        .in('workspace_id', ids);

      type OwnerRow = {
        workspace_id: string;
        profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
      };
      const ownerByWs: Record<string, { name: string; email: string }> = {};
      for (const o of (owners ?? []) as unknown as OwnerRow[]) {
        const prof = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
        if (prof?.email && !ownerByWs[o.workspace_id]) {
          ownerByWs[o.workspace_id] = { name: prof.full_name ?? '', email: prof.email };
        }
      }

      for (const w of wanted.slice(0, MAX_RECIPIENTS)) {
        const owner = ownerByWs[w.id];
        if (!owner) continue;
        const to =
          channel === 'email' ? owner.email : (w.company_phone ?? '').replace(/\D/g, '');
        if (!to) continue; // no phone on file for a phone channel — skip, not fail
        recipients.push({
          to,
          workspaceId: w.id,
          workspaceName: w.name,
          vars: {
            name: owner.name,
            workspace: w.name,
            plan: w.plan ?? 'free',
            trial_ends: w.trial_ends_at
              ? new Date(w.trial_ends_at).toLocaleDateString('en-IN')
              : '',
          },
        });
      }
    }
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No recipients resolved for that audience.' }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `That audience is ${recipients.length} recipients; the cap per send is ${MAX_RECIPIENTS}.` },
      { status: 400 },
    );
  }

  // ---- Send, one by one, recording every outcome ---------------------
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const rendered = renderTemplate(messageBody, r.vars);
    const renderedSubject = renderTemplate(subject, r.vars);

    const result =
      channel === 'email'
        ? await sendPlatformEmail(config, { to: r.to, subject: renderedSubject, body: rendered })
        : channel === 'whatsapp'
          ? await sendPlatformWhatsApp(config, {
              to: r.to,
              body: rendered,
              metaTemplateName,
              metaTemplateLanguage,
            })
          : await sendPlatformSms(config, { to: r.to, body: rendered });

    if (result.ok) sent += 1;
    else failed += 1;

    await admin.from('platform_outbound_messages').insert({
      channel,
      recipient: r.to,
      workspace_id: r.workspaceId,
      workspace_name: r.workspaceName,
      template_id: templateId,
      subject: renderedSubject || null,
      body: rendered,
      status: result.ok ? 'sent' : 'failed',
      provider_id: result.providerId ?? null,
      error: result.error ?? null,
      sent_by: actor.id,
      sent_by_email: actor.email,
    });
  }

  await audit({
    action: 'messaging.sent',
    targetType: 'campaign',
    details: { channel, audience, recipients: recipients.length, sent, failed, template_id: templateId },
  });

  return NextResponse.json({ ok: true, recipients: recipients.length, sent, failed });
}
