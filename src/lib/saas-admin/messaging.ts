import nodemailer from 'nodemailer';

import { BRAND } from '@/config/brand';
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/meta-api';
import type { MessagingConfig } from './messaging-config';

/**
 * Platform outbound channels — Dailybuz-the-company messaging its
 * tenants, from the SaaS console.
 *
 * SEPARATE FROM TENANT MESSAGING BY CONSTRUCTION. Tenants message their
 * customers with their own connected numbers and mailboxes; the platform
 * messages tenants with ITS OWN credentials, loaded from
 * platform_settings (edited in the console, secrets encrypted at rest)
 * with env vars as the fallback — see messaging-config.ts.
 *
 * Every function here takes the resolved config as an argument rather
 * than reading the environment, so the console's settings actually
 * govern sends and tests can inject configs freely.
 *
 * Each sender returns a uniform result and never throws: a campaign to
 * 200 tenants must not die at recipient 37 — the failure is recorded on
 * that row and the loop moves on.
 */

export type PlatformChannel = 'email' | 'whatsapp' | 'sms';

export interface ChannelStatus {
  channel: PlatformChannel;
  configured: boolean;
  /** What is missing when not configured, for the console. */
  missing: string[];
  /** The visible sender identity when configured. */
  identity: string | null;
}

/** Which email backend the config selects. Defaults to SMTP. */
export function emailProvider(config: MessagingConfig): 'smtp' | 'microsoft' {
  return config.email_provider?.trim().toLowerCase() === 'microsoft' ? 'microsoft' : 'smtp';
}

export function channelStatuses(config: MessagingConfig): ChannelStatus[] {
  const smtpKeys = ['smtp_host', 'smtp_user', 'smtp_pass'];
  const msKeys = ['ms_tenant_id', 'ms_client_id', 'ms_client_secret', 'ms_sender'];
  const waKeys = ['wa_phone_id', 'wa_token'];
  const smsKeys = ['sms_authkey', 'sms_sender'];

  const missing = (keys: string[]) => keys.filter((k) => !config[k]?.trim());

  const provider = emailProvider(config);
  const emailMissing = provider === 'microsoft' ? missing(msKeys) : missing(smtpKeys);
  const waMissing = missing(waKeys);
  const smsMissing = missing(smsKeys);

  return [
    {
      channel: 'email',
      configured: emailMissing.length === 0,
      missing: emailMissing,
      identity:
        emailMissing.length === 0
          ? provider === 'microsoft'
            ? `${config.ms_sender} via Microsoft 365`
            : config.smtp_from || config.smtp_user || null
          : null,
    },
    {
      channel: 'whatsapp',
      configured: waMissing.length === 0,
      missing: waMissing,
      identity: waMissing.length === 0 ? `phone id ${config.wa_phone_id}` : null,
    },
    {
      channel: 'sms',
      configured: smsMissing.length === 0,
      missing: smsMissing,
      identity: smsMissing.length === 0 ? config.sms_sender : null,
    },
  ];
}

/**
 * {{variable}} substitution. Unknown variables render as an empty string
 * rather than leaking "{{name}}" into a customer-facing message — a
 * blank is a flaw, a template artefact is an embarrassment.
 */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

/**
 * Microsoft Graph client-credentials token, cached until near expiry.
 *
 * Module-level cache is safe here: the token is tenant-wide (application
 * permission, no user context), Graph tokens live ~an hour, and a send
 * batch of 300 recipients must not fetch 300 tokens.
 */
let graphTokenCache: { key: string; token: string; expiresAt: number } | null = null;

async function getGraphToken(config: MessagingConfig): Promise<string> {
  const cacheKey = `${config.ms_tenant_id}:${config.ms_client_id}`;
  if (graphTokenCache && graphTokenCache.key === cacheKey && graphTokenCache.expiresAt > Date.now() + 60_000) {
    return graphTokenCache.token;
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.ms_tenant_id)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.ms_client_id,
        client_secret: config.ms_client_secret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  );
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || `Microsoft token request failed (${res.status})`);
  }

  graphTokenCache = {
    key: cacheKey,
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

/**
 * Send through Microsoft Graph as the configured mailbox.
 *
 * Requires an Entra app registration with the APPLICATION permission
 * Mail.Send and admin consent — the daemon flow, no user signs in.
 * Prefer restricting the app to the one sending mailbox with an
 * ApplicationAccessPolicy, since Mail.Send is otherwise tenant-wide.
 */
async function sendViaMicrosoft(
  config: MessagingConfig,
  input: { to: string; subject: string; body: string },
): Promise<SendResult> {
  const token = await getGraphToken(config);
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.ms_sender)}/sendMail`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: 'Text', content: input.body },
          toRecipients: [{ emailAddress: { address: input.to } }],
        },
        saveToSentItems: true,
      }),
    },
  );

  if (res.status === 202) {
    // Graph's sendMail returns no message id; the request id is the
    // traceable handle Microsoft support asks for.
    return { ok: true, providerId: res.headers.get('request-id') ?? 'graph-accepted' };
  }
  const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return {
    ok: false,
    error: explainGraphError(
      err.error?.message || `Graph sendMail returned ${res.status}`,
      config.ms_sender,
    ),
  };
}

/**
 * Graph's refusals are terse and their causes are not obvious. The one
 * that cost us most: "The requested user 'x' is invalid" simply means
 * the Send-as mailbox does not exist in the tenant — nothing to do with
 * permissions or the app registration.
 */
export function explainGraphError(message: string, sender?: string): string {
  const m = message.toLowerCase();

  if (m.includes('requested user') && m.includes('invalid')) {
    return `${message} — "${sender ?? 'the Send as address'}" is not a mailbox in this tenant. Set "Send as" to a real address; an unlicensed shared mailbox is fine here, which is the point of using Graph.`;
  }
  if (m.includes('access') && (m.includes('denied') || m.includes('token'))) {
    return `${message} — the app registration cannot send as that mailbox. It needs the APPLICATION permission Mail.Send with admin consent granted, not the delegated one. If an ApplicationAccessPolicy restricts the app, the Send-as mailbox must be inside its scope.`;
  }
  if (m.includes('mailboxnotenabled') || m.includes('not have a mailbox')) {
    return `${message} — that account has no mailbox to send from.`;
  }
  return message;
}


/**
 * A readable plain-text version of an HTML body, for the multipart
 * alternative. Not a general HTML renderer: it keeps link targets
 * visible (a text-only client must still be able to follow a reset
 * link) and collapses the rest to lines.
 */
export function htmlToPlainText(html: string): string {
  return html
    // Surface the destination of every link before tags are stripped.
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2: $1')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8377;/g, '\u20b9')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n')
    .trim();
}


/**
 * Build a valid RFC-5322 From header.
 *
 * `smtp_from` is meant to be `"Name" <box@example.com>`, but a value
 * set through an env file often arrives as just `Dailybuz`: a shell or
 * dotenv parser reading PLATFORM_SMTP_FROM="Dailybuz" <box@daylink.in>
 * stops at the closing quote and drops the address. Passing that on
 * gives SMTP a From with no mailbox in it.
 *
 * So: a value containing an address is used as-is; anything else is
 * treated as the display name it clearly is, and paired with the
 * authenticated mailbox — which is the only address Office 365 would
 * accept from this connection anyway.
 */
export function buildFromHeader(smtpFrom: string | undefined, user: string): string {
  const raw = smtpFrom?.trim();
  if (!raw) return `"${BRAND.name}" <${user}>`;
  if (raw.includes('@')) return raw;
  // A bare display name. Strip stray quotes before re-quoting it.
  const name = raw.replace(/^["']|["']$/g, '').trim();
  return name ? `"${name}" <${user}>` : `"${BRAND.name}" <${user}>`;
}

/**
 * Turn a provider rejection into something an operator can act on.
 * "535 5.7.3 Authentication unsuccessful" names the failure but not the
 * fix, and the fix here is almost never "check the password".
 */
export function explainSmtpError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('5.7.139') || (m.includes('535') && m.includes('basic'))) {
    return `${message} — Microsoft has SMTP AUTH disabled for this mailbox. Enable "Authenticated SMTP" for it in the Microsoft 365 admin centre (Users -> Mail -> Manage email apps), or switch this Provider to Microsoft Graph, which does not use passwords.`;
  }
  if (m.includes('535') || m.includes('authentication unsuccessful') || m.includes('5.7.3')) {
    return `${message} — the mailbox rejected the credentials. If the password is right, this is almost always SMTP AUTH being disabled for the mailbox, or a tenant that requires modern auth. Enable "Authenticated SMTP" for it, or switch to Microsoft Graph.`;
  }
  if (m.includes('5.7.60') || m.includes('send as') || m.includes('not allowed to send')) {
    return `${message} — the From address is not this mailbox. Set "From address" to the signed-in mailbox, or grant it Send As permission.`;
  }
  if (m.includes('etimedout') || m.includes('econnrefused') || m.includes('timeout')) {
    return `${message} — nothing answered on that host and port. Check the SMTP host, and that the port is 587 (STARTTLS) or 465 (implicit TLS).`;
  }
  return message;
}

export async function sendPlatformEmail(
  config: MessagingConfig,
  input: {
    to: string;
    subject: string;
    body: string;
  },
): Promise<SendResult> {
  if (emailProvider(config) === 'microsoft') {
    try {
      return await sendViaMicrosoft(config, input);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Microsoft send failed' };
    }
  }
  try {
    const host = config.smtp_host;
    const user = config.smtp_user;
    const pass = config.smtp_pass;
    if (!host || !user || !pass) return { ok: false, error: 'SMTP is not configured' };

    const port = Number(config.smtp_port) || 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      // 465 is implicit TLS; 587 starts plain and upgrades. `requireTLS`
      // makes that upgrade mandatory rather than opportunistic, so a
      // password is never sent over a cleartext connection because a
      // server failed to advertise STARTTLS.
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
    });

    // Bodies are HTML. Passing them as `text` shipped the markup itself
    // to the recipient — every reset link and sign-in code arrived as
    // visible <div style="..."> source. `html` renders it; the derived
    // `text` is the fallback for clients that refuse HTML, and its
    // presence also helps deliverability.
    const info = await transporter.sendMail({
      from: buildFromHeader(config.smtp_from, user),
      to: input.to,
      subject: input.subject,
      html: input.body,
      text: htmlToPlainText(input.body),
    });
    return { ok: true, providerId: info.messageId };
  } catch (err) {
    return {
      ok: false,
      error: explainSmtpError(err instanceof Error ? err.message : 'Email send failed'),
    };
  }
}

export async function sendPlatformWhatsApp(
  config: MessagingConfig,
  input: {
    to: string;
    body: string;
    metaTemplateName?: string | null;
    metaTemplateLanguage?: string | null;
    templateParams?: string[];
  },
): Promise<SendResult> {
  try {
    const phoneNumberId = config.wa_phone_id;
    const accessToken = config.wa_token;
    if (!phoneNumberId || !accessToken) {
      return { ok: false, error: 'Platform WhatsApp is not configured' };
    }

    // Business-initiated WhatsApp outside a 24-hour customer-service
    // window REQUIRES a Meta-approved template — free-form text is
    // rejected by Meta, not by us. When the template row names one, use
    // it; otherwise attempt free text and let Meta's error surface
    // honestly in the log rather than pretending it sent.
    const result = input.metaTemplateName
      ? await sendTemplateMessage({
          phoneNumberId,
          accessToken,
          to: input.to,
          templateName: input.metaTemplateName,
          language: input.metaTemplateLanguage || 'en',
          params: input.templateParams,
        })
      : await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: input.to,
          text: input.body,
        });

    // meta-api throws on failure (the catch below turns that into a
    // recorded error); a return value means Meta accepted the message.
    return { ok: true, providerId: result.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'WhatsApp send failed' };
  }
}

export async function sendPlatformSms(
  config: MessagingConfig,
  input: { to: string; body: string },
): Promise<SendResult> {
  try {
    const authkey = config.sms_authkey;
    const sender = config.sms_sender;
    if (!authkey || !sender) return { ok: false, error: 'SMS is not configured' };

    // MSG91 v5 flow-less transactional send. Indian DLT rules mean the
    // sender id and message content generally must match a registered
    // template — MSG91 enforces that server-side and its error comes back
    // verbatim into our log.
    const res = await fetch('https://control.msg91.com/api/v5/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey },
      body: JSON.stringify({
        sender,
        route: '4',
        country: '91',
        sms: [{ message: input.body, to: [input.to.replace(/\D/g, '')] }],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      type?: string;
      message?: string;
      request_id?: string;
    };
    if (!res.ok || json.type === 'error') {
      return { ok: false, error: json.message || `MSG91 returned ${res.status}` };
    }
    return { ok: true, providerId: json.request_id || json.message };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SMS send failed' };
  }
}
