// ============================================================
// /api/whatsapp/bridge — pairing lifecycle for the WhatsApp Bridge.
//
//   GET  ?workspace_id=…            → live status (+ QR while pairing)
//   POST { workspace_id, action }   → action: 'pair' | 'logout'
//
// 'pair' starts (or refreshes) QR pairing on the bridge AND saves the
// workspace's whatsapp_config row as provider 'bridge', so the moment
// the phone scans, sends and the inbox flow through the bridge with no
// further setup. 'logout' unlinks the device and marks the config
// disconnected — the row stays, so reconnecting is one scan.
//
// Membership-gated like /api/whatsapp/config; the bridge itself is
// reachable only from the server (X-Bridge-Key), never from browsers.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/whatsapp/encryption'
import { bridgeLogout, bridgePair, bridgeStatus } from '@/lib/whatsapp/providers/bridge-provider'

export const dynamic = 'force-dynamic'

async function requireMember(request: NextRequest, workspaceId: string | null) {
  if (!workspaceId) {
    return { error: NextResponse.json({ error: 'workspace_id is required' }, { status: 400 }) }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: member } = await supabase
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, member }
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id')
  const auth = await requireMember(request, workspaceId)
  if ('error' in auth) return auth.error

  try {
    const status = await bridgeStatus(workspaceId!)
    return NextResponse.json(status)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bridge unreachable' },
      { status: 502 },
    )
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { workspace_id: workspaceId, action } = body as {
    workspace_id?: string
    action?: string
  }
  const auth = await requireMember(request, workspaceId ?? null)
  if ('error' in auth) return auth.error

  try {
    if (action === 'pair') {
      // Save (or repoint) the config row first, so the connected event
      // arriving seconds later finds its tenant.
      const admin = createAdminClient()
      const { data: existing } = await admin
        .from('whatsapp_config')
        .select('id')
        .eq('workspace_id', workspaceId!)
        .maybeSingle()
      const row = {
        user_id: auth.user.id,
        workspace_id: workspaceId!,
        provider: 'bridge',
        phone_number_id: workspaceId!, // the bridge instance id
        // Placeholder: the bridge authenticates with a server-side env
        // key; nothing per-tenant is secret. Encrypted anyway so every
        // row in the column has one shape.
        access_token: encrypt('bridge-managed'),
        status: 'disconnected',
      }
      const write = existing
        ? await admin.from('whatsapp_config').update(row).eq('id', existing.id)
        : await admin.from('whatsapp_config').insert(row)
      if (write.error) {
        return NextResponse.json({ error: write.error.message }, { status: 500 })
      }

      const status = await bridgePair(workspaceId!)
      return NextResponse.json(status)
    }

    if (action === 'logout') {
      await bridgeLogout(workspaceId!)
      const admin = createAdminClient()
      await admin
        .from('whatsapp_config')
        .update({ status: 'disconnected' })
        .eq('workspace_id', workspaceId!)
        .eq('provider', 'bridge')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "action must be 'pair' or 'logout'" }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bridge unreachable' },
      { status: 502 },
    )
  }
}
