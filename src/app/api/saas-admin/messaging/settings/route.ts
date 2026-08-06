import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';
import { channelStatuses } from '@/lib/saas-admin/messaging';
import {
  MESSAGING_SETTINGS,
  loadMessagingConfig,
  saveMessagingSettings,
} from '@/lib/saas-admin/messaging-config';

export const dynamic = 'force-dynamic';

/**
 * GET — the settings FORM state, which is not the settings VALUES.
 *
 * Secrets never leave the server, not even masked: the form learns only
 * "set" or "not set" plus where the value came from (console vs env
 * fallback). Non-secret values (host, sender id) do round-trip, because
 * an admin editing the SMTP host needs to see the current one.
 */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;

  const [config, { data: rows }] = await Promise.all([
    loadMessagingConfig(admin),
    admin.from('platform_settings').select('key, updated_at'),
  ]);
  const dbKeys = new Set((rows ?? []).map((r) => r.key));

  return NextResponse.json({
    fields: MESSAGING_SETTINGS.map((def) => ({
      key: def.key,
      label: def.label,
      channel: def.channel,
      secret: def.secret,
      required: def.required,
      placeholder: def.placeholder,
      set: Boolean(config[def.key]),
      /** Editable value only for non-secrets. */
      value: def.secret ? null : (config[def.key] ?? ''),
      source: dbKeys.has(def.key) ? 'settings' : config[def.key] ? 'env' : null,
    })),
    channels: channelStatuses(config),
  });
}

/** POST — save. Empty fields untouched; "-" clears back to env/unset. */
export async function POST(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, actor, audit } = guard.ctx;

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, string> = {};
  for (const def of MESSAGING_SETTINGS) {
    if (typeof body[def.key] === 'string') updates[def.key] = body[def.key];
  }

  try {
    const { saved, cleared } = await saveMessagingSettings(admin, updates, actor.id);

    // Keys only — never a value, secret or not. The audit table is the
    // last place a credential should ever appear.
    await audit({
      action: 'messaging.settings_updated',
      targetType: 'settings',
      details: { saved, cleared },
    });

    const config = await loadMessagingConfig(admin);
    return NextResponse.json({ ok: true, saved, cleared, channels: channelStatuses(config) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    );
  }
}
