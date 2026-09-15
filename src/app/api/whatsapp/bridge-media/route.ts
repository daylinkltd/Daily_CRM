// ============================================================
// GET /api/whatsapp/bridge-media?path=<instance>/<file>
//
// Streams inbound media the bridge saved, to signed-in members of the
// workspace that owns it. The path's first segment IS the workspace id
// (bridge instance id), so authorisation is one membership check — a
// member of workspace A can never fetch workspace B's media by crafting
// a path, and the bridge itself stays unreachable from browsers.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PATH_RE = /^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._-]{1,200}$/

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? ''
  if (!PATH_RE.test(path)) {
    return NextResponse.json({ error: 'Invalid media path' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = path.split('/')[0]
  const { data: member } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bridgeUrl = (process.env.WHATSAPP_BRIDGE_URL || '').replace(/\/+$/, '')
  const bridgeKey = process.env.WHATSAPP_BRIDGE_API_KEY || ''
  if (!bridgeUrl || !bridgeKey) {
    return NextResponse.json({ error: 'Bridge is not configured' }, { status: 503 })
  }

  const upstream = await fetch(`${bridgeUrl}/media/${path}`, {
    headers: { 'X-Bridge-Key': bridgeKey },
    cache: 'no-store',
  })
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
      // Immutable by construction: the bridge never rewrites a saved file.
      'Cache-Control': 'private, max-age=86400, immutable',
    },
  })
}
