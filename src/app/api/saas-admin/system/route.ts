import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/saas-admin/system — configuration and health.
 *
 * ============================================================
 * THIS ENDPOINT NEVER RETURNS A SECRET VALUE. NOT MASKED, NOT
 * PARTIAL, NOT THE LAST FOUR CHARACTERS.
 * ============================================================
 *
 * The question an operator actually needs answered is "is this
 * configured?", and a boolean answers it completely. Returning even a
 * masked value puts the secret in an HTTP response, a browser cache, a
 * proxy log and a screenshot — and "last four characters" is a real aid
 * to anyone brute-forcing the rest.
 *
 * `length` is included because it distinguishes the two failure modes
 * that actually happen: a variable someone set to an empty string, and a
 * key truncated when it was pasted.
 */

interface ConfigItem {
  key: string;
  label: string;
  /** What breaks when it is missing. */
  purpose: string;
  configured: boolean;
  length: number;
  /** Missing = the feature is dead, not merely degraded. */
  required: boolean;
}

function inspect(
  key: string,
  label: string,
  purpose: string,
  required: boolean,
): ConfigItem {
  const value = process.env[key] ?? '';
  return { key, label, purpose, configured: value.trim().length > 0, length: value.length, required };
}

export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;

  const config: Record<string, ConfigItem[]> = {
    Database: [
      inspect('NEXT_PUBLIC_SUPABASE_URL', 'Supabase URL', 'Everything.', true),
      inspect('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Anon key', 'Client-side access under RLS.', true),
      inspect('SUPABASE_SERVICE_ROLE_KEY', 'Service-role key', 'This console, and server jobs.', true),
    ],
    Payments: [
      inspect('DAYLINK_PAY_SECRET', 'Daylink hub secret', 'Signs the checkout hand-off. Without it, no one can pay.', true),
      inspect('DAYLINK_PAY_URL', 'Daylink hub URL', 'Defaults to https://daylink.in/pay.', false),
      inspect('DAYLINK_HUB_API', 'Hub API base', 'Server-to-server order creation.', false),
    ],
    WhatsApp: [
      inspect('META_APP_SECRET', 'Meta app secret', 'Verifies inbound webhook signatures.', true),
      inspect('META_VERIFY_TOKEN', 'Webhook verify token', "Meta's subscription handshake.", false),
      inspect('ENCRYPTION_KEY', 'Encryption key', 'Encrypts stored tenant access tokens at rest.', true),
    ],
    Compliance: [
      inspect('GSP_API_BASE_URL', 'GSP base URL', 'E-invoice IRN registration. Not connected yet.', false),
      inspect('GSP_API_KEY', 'GSP key', 'E-invoice IRN registration. Not connected yet.', false),
    ],
    'Platform messaging': [
      inspect('PLATFORM_SMTP_HOST', 'SMTP host', 'Outbound platform email (trial nudges, receipts).', false),
      inspect('PLATFORM_SMTP_USER', 'SMTP user', 'Login for the platform mailbox.', false),
      inspect('PLATFORM_SMTP_PASS', 'SMTP password', 'Login for the platform mailbox.', false),
      inspect('PLATFORM_SMTP_FROM', 'From address', 'Defaults to the SMTP user when unset.', false),
      inspect('PLATFORM_WA_PHONE_ID', 'Platform WhatsApp phone id', 'Dailybuz-to-tenant WhatsApp. Separate from tenant numbers.', false),
      inspect('PLATFORM_WA_TOKEN', 'Platform WhatsApp token', 'Dailybuz-to-tenant WhatsApp. Separate from tenant numbers.', false),
      inspect('PLATFORM_MSG91_AUTHKEY', 'MSG91 auth key', 'Platform SMS via MSG91.', false),
      inspect('PLATFORM_MSG91_SENDER', 'MSG91 sender id', 'DLT-registered 6-char sender id.', false),
    ],
    Console: [
      inspect('ADMIN_SEED_SECRET', 'Admin seed secret', 'Gates the super-admin seed endpoint. Unset = endpoint disabled, which is the safe state.', false),
    ],
  };

  // A real query, not a ping: this proves the service role can still read,
  // which is what actually breaks when a key is rotated badly.
  const startedAt = Date.now();
  const { error: dbError } = await admin
    .from('workspaces')
    .select('id', { count: 'exact', head: true });
  const dbLatencyMs = Date.now() - startedAt;

  const missingRequired = Object.values(config)
    .flat()
    .filter((c) => c.required && !c.configured)
    .map((c) => c.key);

  return NextResponse.json({
    config,
    health: {
      database: dbError ? 'error' : 'ok',
      databaseError: dbError?.message ?? null,
      dbLatencyMs,
      environment: process.env.NODE_ENV ?? 'unknown',
      missingRequired,
    },
  });
}
