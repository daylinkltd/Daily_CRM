import nodemailer from 'nodemailer';

import { BRAND } from '@/config/brand';
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/meta-api';

/**
 * Platform outbound channels — Dailybuz-the-company messaging its
 * tenants, from the SaaS console.
 *
 * SEPARATE FROM TENANT MESSAGING BY CONSTRUCTION. Tenants message their
 * customers with their own connected numbers and mailboxes; the platform
 * messages tenants with ITS OWN credentials, all environment variables:
 *
 *   Email     PLATFORM_SMTP_HOST / PORT / USER / PASS / FROM
 *   WhatsApp  PLATFORM_WA_PHONE_ID / PLATFORM_WA_TOKEN
 *   SMS       PLATFORM_MSG91_AUTHKEY / PLATFORM_MSG91_SENDER  (MSG91)
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

export function channelStatuses(): ChannelStatus[] {
  const smtpVars = ['PLATFORM_SMTP_HOST', 'PLATFORM_SMTP_USER', 'PLATFORM_SMTP_PASS'];
  const waVars = ['PLATFORM_WA_PHONE_ID', 'PLATFORM_WA_TOKEN'];
  const smsVars = ['PLATFORM_MSG91_AUTHKEY', 'PLATFORM_MSG91_SENDER'];

  const missing = (vars: string[]) => vars.filter((v) => !process.env[v]?.trim());

  const smtpMissing = missing(smtpVars);
  const waMissing = missing(waVars);
  const smsMissing = missing(smsVars);

  return [
    {
      channel: 'email',
      configured: smtpMissing.length === 0,
      missing: smtpMissing,
      identity:
        smtpMissing.length === 0
          ? process.env.PLATFORM_SMTP_FROM || process.env.PLATFORM_SMTP_USER || null
          : null,
    },
    {
      channel: 'whatsapp',
      configured: waMissing.length === 0,
      missing: waMissing,
      identity: waMissing.length === 0 ? `phone id ${process.env.PLATFORM_WA_PHONE_ID}` : null,
    },
    {
      channel: 'sms',
      configured: smsMissing.length === 0,
      missing: smsMissing,
      identity: smsMissing.length === 0 ? process.env.PLATFORM_MSG91_SENDER! : null,
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

export async function sendPlatformEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  try {
    const host = process.env.PLATFORM_SMTP_HOST;
    const user = process.env.PLATFORM_SMTP_USER;
    const pass = process.env.PLATFORM_SMTP_PASS;
    if (!host || !user || !pass) return { ok: false, error: 'SMTP is not configured' };

    const port = Number(process.env.PLATFORM_SMTP_PORT) || 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: process.env.PLATFORM_SMTP_FROM || `"${BRAND.name}" <${user}>`,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    return { ok: true, providerId: info.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
}

export async function sendPlatformWhatsApp(input: {
  to: string;
  body: string;
  metaTemplateName?: string | null;
  metaTemplateLanguage?: string | null;
  templateParams?: string[];
}): Promise<SendResult> {
  try {
    const phoneNumberId = process.env.PLATFORM_WA_PHONE_ID;
    const accessToken = process.env.PLATFORM_WA_TOKEN;
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

export async function sendPlatformSms(input: { to: string; body: string }): Promise<SendResult> {
  try {
    const authkey = process.env.PLATFORM_MSG91_AUTHKEY;
    const sender = process.env.PLATFORM_MSG91_SENDER;
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
