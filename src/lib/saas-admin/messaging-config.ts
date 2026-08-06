import type { SupabaseClient } from '@supabase/supabase-js';

import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

/**
 * Messaging channel credentials, stored in `platform_settings` and edited
 * from the console — not in the deployment environment.
 *
 * WHY THE DATABASE AND NOT COOLIFY. The person running the platform day
 * to day rotates an SMTP password or swaps the WhatsApp token; making
 * that a deploy-time operation means every credential change needs the
 * person who holds the Coolify login and a restart. Settings rows change
 * at runtime, take effect on the next send, and are audit-logged like
 * every other console action.
 *
 * SECRETS ARE ENCRYPTED AT REST with the same AES-256-GCM scheme as
 * tenant WhatsApp tokens (ENCRYPTION_KEY), so a database read alone never
 * yields a usable credential. Non-secret values (host, port, sender id)
 * stay plaintext — encrypting a hostname buys nothing and makes the row
 * unreadable in support sessions.
 *
 * ENV VARS REMAIN A FALLBACK, read only when the database has no row for
 * that key. Existing deployments keep working; the console takes
 * precedence the moment a value is saved there.
 */

export interface SettingDef {
  key: string;
  label: string;
  channel: 'email' | 'whatsapp' | 'sms';
  secret: boolean;
  required: boolean;
  placeholder: string;
  /** Env var honoured when no DB row exists. */
  envFallback: string;
}

export const MESSAGING_SETTINGS: SettingDef[] = [
  // Email (SMTP)
  { key: 'smtp_host', label: 'SMTP host', channel: 'email', secret: false, required: true, placeholder: 'smtp.zoho.in', envFallback: 'PLATFORM_SMTP_HOST' },
  { key: 'smtp_port', label: 'SMTP port', channel: 'email', secret: false, required: false, placeholder: '465', envFallback: 'PLATFORM_SMTP_PORT' },
  { key: 'smtp_user', label: 'SMTP username', channel: 'email', secret: false, required: true, placeholder: 'no-reply@dailybuz.com', envFallback: 'PLATFORM_SMTP_USER' },
  { key: 'smtp_pass', label: 'SMTP password', channel: 'email', secret: true, required: true, placeholder: '••••••••', envFallback: 'PLATFORM_SMTP_PASS' },
  { key: 'smtp_from', label: 'From address', channel: 'email', secret: false, required: false, placeholder: '"Dailybuz" <no-reply@dailybuz.com>', envFallback: 'PLATFORM_SMTP_FROM' },
  // WhatsApp (Meta Cloud API)
  { key: 'wa_phone_id', label: 'WhatsApp phone number ID', channel: 'whatsapp', secret: false, required: true, placeholder: '123456789012345', envFallback: 'PLATFORM_WA_PHONE_ID' },
  { key: 'wa_token', label: 'WhatsApp access token', channel: 'whatsapp', secret: true, required: true, placeholder: '••••••••', envFallback: 'PLATFORM_WA_TOKEN' },
  // SMS (MSG91)
  { key: 'sms_authkey', label: 'MSG91 auth key', channel: 'sms', secret: true, required: true, placeholder: '••••••••', envFallback: 'PLATFORM_MSG91_AUTHKEY' },
  { key: 'sms_sender', label: 'MSG91 sender ID (DLT)', channel: 'sms', secret: false, required: true, placeholder: 'DLYBUZ', envFallback: 'PLATFORM_MSG91_SENDER' },
];

/** Resolved plaintext config, ready for the senders. Server-side only. */
export type MessagingConfig = Record<string, string>;

/**
 * Load every messaging setting, decrypting secrets, falling back to env.
 *
 * A decrypt failure (rotated ENCRYPTION_KEY, mangled row) logs and yields
 * the env fallback rather than throwing: one bad row must not take every
 * channel down.
 */
export async function loadMessagingConfig(admin: SupabaseClient): Promise<MessagingConfig> {
  const { data } = await admin
    .from('platform_settings')
    .select('key, value, is_secret')
    .in('key', MESSAGING_SETTINGS.map((s) => s.key));

  const byKey: Record<string, { value: string; is_secret: boolean }> = {};
  for (const row of data ?? []) byKey[row.key] = row;

  const config: MessagingConfig = {};
  for (const def of MESSAGING_SETTINGS) {
    const row = byKey[def.key];
    if (row) {
      try {
        config[def.key] = row.is_secret ? decrypt(row.value) : row.value;
        continue;
      } catch (err) {
        console.error(`[messaging-config] decrypt failed for ${def.key}:`, err instanceof Error ? err.message : err);
      }
    }
    const env = process.env[def.envFallback]?.trim();
    if (env) config[def.key] = env;
  }
  return config;
}

/**
 * Save settings from the console. Empty string = leave unchanged (the UI
 * never round-trips secrets, so an untouched password field arrives
 * empty); the literal "-" clears a value.
 */
export async function saveMessagingSettings(
  admin: SupabaseClient,
  updates: Record<string, string>,
  updatedBy: string,
): Promise<{ saved: string[]; cleared: string[] }> {
  const saved: string[] = [];
  const cleared: string[] = [];

  for (const def of MESSAGING_SETTINGS) {
    const raw = updates[def.key];
    if (raw === undefined || raw === '') continue;

    if (raw === '-') {
      await admin.from('platform_settings').delete().eq('key', def.key);
      cleared.push(def.key);
      continue;
    }

    const value = def.secret ? encrypt(raw.trim()) : raw.trim();
    const { error } = await admin.from('platform_settings').upsert({
      key: def.key,
      value,
      is_secret: def.secret,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Saving ${def.label} failed: ${error.message}`);
    saved.push(def.key);
  }

  return { saved, cleared };
}
