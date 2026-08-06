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

export function channelStatuses(config: MessagingConfig): ChannelStatus[] {
  const smtpKeys = ['smtp_host', 'smtp_user', 'smtp_pass'];
  const waKeys = ['wa_phone_id', 'wa_token'];
  const smsKeys = ['sms_authkey', 'sms_sender'];

  const missing = (keys: string[]) => keys.filter((k) => !config[k]?.trim());

  const smtpMissing = missing(smtpKeys);
  const waMissing = missing(waKeys);
  const smsMissing = missing(smsKeys);

  return [
    {
      channel: 'email',
      configured: smtpMissing.length === 0,
      missing: smtpMissing,
      identity:
        smtpMissing.length === 0 ? config.smtp_from || config.smtp_user || null : null,
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

export async function sendPlatformEmail(
  config: MessagingConfig,
  input: {
    to: string;
    subject: string;
    body: string;
  },
): Promise<SendResult> {
  try {
    const host = config.smtp_host;
    const user = config.smtp_user;
    const pass = config.smtp_pass;
    if (!host || !user || !pass) return { ok: false, error: 'SMTP is not configured' };

    const port = Number(config.smtp_port) || 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: config.smtp_from || `"${BRAND.name}" <${user}>`,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    return { ok: true, providerId: info.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Email send failed' };
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
