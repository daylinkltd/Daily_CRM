// ============================================================
// Signed download URLs for private buckets.
//
// GET /api/storage/sign?bucket=employee-documents&path=<ws>/<file>
//
// The path's first segment is the workspace id; the caller must be
// an active member of that workspace. Returns a 5-minute signed URL.
// Only private buckets are signable — public buckets have public
// URLs and don't need this.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const SIGNABLE_BUCKETS = new Set(['employee-documents'])

function admin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const bucket = searchParams.get('bucket') ?? ''
  const path = searchParams.get('path') ?? ''

  if (!SIGNABLE_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 })
  }
  // Paths from /api/storage/upload look like `account-<workspaceId>/<file>`.
  const workspaceId = path.split('/')[0]?.replace(/^account-/, '')
  if (!workspaceId || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()
  if (!member) {
    return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
  }

  const { data, error } = await admin()
    .storage.from(bucket)
    .createSignedUrl(path, 300)
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed to sign URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
