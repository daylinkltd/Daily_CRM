// ============================================================
// The platform's own mailbox.
//
// Every message the PRODUCT sends on its own behalf goes through here:
// password resets, sign-in codes, invitations, billing reminders. It is
// deliberately separate from a workspace's own Outlook connection —
// that mailbox belongs to the customer and speaks to *their* contacts,
// while this one is Dailybuz speaking to its users.
//
// Until now these flows had no shared route to a mailbox at all:
//
//   • password reset leaned on Supabase's built-in mailer, which is
//     why the links pointed at localhost — the redirect came from a
//     dashboard setting rather than from the app;
//   • invitations could only be emailed if the workspace happened to
//     have connected Outlook;
//   • sign-in codes and billing reminders had nowhere to send from,
//     so they did not exist.
//
// One sender, configured once in the SaaS console (or by environment
// variables), and every send recorded in `platform_outbound_messages`
// so an operator can answer "did that reset email actually leave?".
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { loadMessagingConfig, type MessagingConfig } from '@/lib/saas-admin/messaging-config';
import { sendPlatformEmail } from '@/lib/saas-admin/messaging';
import { BRAND } from '@/config/brand';

export type PlatformMailKind =
  | 'password_reset'
  | 'login_code'
  | 'invitation'
  | 'billing_reminder'
  | 'verification';

export interface PlatformMailInput {
  to: string;
  subject: string;
  /** HTML body. Wrapped in the shared shell unless `raw` is set. */
  body: string;
  kind: PlatformMailKind;
  /** Skip the branded wrapper — for bodies that bring their own. */
  raw?: boolean;
  workspaceId?: string | null;
}

export interface PlatformMailResult {
  ok: boolean;
  error?: string;
  /** True when nothing is configured, so callers can fall back. */
  notConfigured?: boolean;
}

/**
 * Office 365 SMTP, filled in when the operator gives only a mailbox and
 * password. `contact@daylink.in` is an Outlook mailbox, and asking
 * someone to remember `smtp.office365.com:587` to use it is friction
 * with no upside — but an explicit setting still wins, so a different
 * provider is never overridden.
 */
function withOutlookDefaults(config: MessagingConfig): MessagingConfig {
  // An explicit host always wins, so a Zoho or Gmail mailbox is never
  // redirected. This only fills the gap left when someone supplies a
  // mailbox and password and nothing else.
  if (config.smtp_host?.trim() || !config.smtp_user?.trim()) return config;

  return {
    ...config,
    smtp_host: 'smtp.office365.com',
    smtp_port: config.smtp_port?.trim() || '587',
  };
}

/** True when the platform has a usable mailbox. */
export function isPlatformMailConfigured(config: MessagingConfig): boolean {
  const c = withOutlookDefaults(config);
  if (c.email_provider?.trim().toLowerCase() === 'microsoft') {
    return Boolean(c.ms_tenant_id && c.ms_client_id && c.ms_client_secret && c.ms_sender);
  }
  return Boolean(c.smtp_host && c.smtp_user && c.smtp_pass);
}

/**
 * A plain, legible HTML shell. Deliberately table-free and inline-styled:
 * these are transactional messages that must render in Outlook, Gmail
 * and a phone's default client without a stylesheet.
 */
export function wrapPlatformEmail(title: string, bodyHtml: string): string {
  return `<div style="margin:0;padding:24px;background:#f4f6f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #edf1f6;">
      <span style="font-size:18px;font-weight:700;color:#0b1220;letter-spacing:-0.2px;">${BRAND.name}</span>
    </div>
    <div style="padding:24px;color:#1f2937;font-size:15px;line-height:1.6;">
      <h1 style="margin:0 0 16px;font-size:18px;color:#0b1220;">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;">
      Sent by ${BRAND.name}. If you were not expecting this email you can safely ignore it.
    </div>
  </div>
</div>`;
}

/**
 * Send as the platform.
 *
 * Never throws: a failed reset email must not turn into a 500 that
 * tells the user their account is broken. Callers get `ok:false` and
 * decide — usually by surfacing "we could not send right now".
 */
export async function sendPlatformMail(
  input: PlatformMailInput,
): Promise<PlatformMailResult> {
  const admin = createAdminClient();

  let config: MessagingConfig;
  try {
    config = withOutlookDefaults(await loadMessagingConfig(admin));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not load mail settings',
    };
  }

  if (!isPlatformMailConfigured(config)) {
    return {
      ok: false,
      notConfigured: true,
      error:
        'Platform email is not configured. Set the mailbox under SaaS admin → Messaging.',
    };
  }

  const html = input.raw ? input.body : wrapPlatformEmail(input.subject, input.body);
  const result = await sendPlatformEmail(config, {
    to: input.to,
    subject: input.subject,
    body: html,
  });

  // Logged either way. "Did the reset email go out?" is the first
  // question support asks, and a silent failure makes it unanswerable.
  try {
    await admin.from('platform_outbound_messages').insert({
      channel: 'email',
      recipient: input.to,
      workspace_id: input.workspaceId ?? null,
      subject: `[${input.kind}] ${input.subject}`,
      body: html,
      status: result.ok ? 'sent' : 'failed',
      provider_id: result.ok ? (result.providerId ?? null) : null,
      error: result.ok ? null : (result.error ?? 'send failed'),
    });
  } catch {
    // The log is diagnostics; never let it fail the send it describes.
  }

  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? 'Send failed' };
}
