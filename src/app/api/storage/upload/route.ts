import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminSb } from '@supabase/supabase-js'

/**
 * Workspace-scoped media upload/delete for the public media buckets
 * (chat attachments, flow media, template headers).
 *
 * Uploads go through this route (service role) rather than directly
 * from the browser because the buckets have no storage RLS policies —
 * client-side uploads were silently impossible. Authorization is the
 * caller's session + workspace membership; objects are namespaced
 * under `account-<workspace_id>/` and deletes are only allowed inside
 * the caller's own prefix.
 */

const ALLOWED_BUCKETS = new Set(['chat-media', 'flow-media', 'employee-documents'])
// Buckets whose objects must never get a public URL.
const PRIVATE_BUCKETS = new Set(['employee-documents'])
const MAX_BYTES = 16 * 1024 * 1024 // matches the buckets' file_size_limit

function admin() {
  return createAdminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveWorkspaceId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  requested?: string | null
): Promise<string | null> {
  if (requested) {
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', requested)
      .eq('user_id', userId)
      .maybeSingle()
    return data?.workspace_id ?? null
  }
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  return data?.workspace_id ?? null
}

function buildPath(workspaceId: string, fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  const rawExt = dot >= 0 ? fileName.slice(dot + 1) : 'bin'
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'bin'
  const base =
    (dot >= 0 ? fileName.slice(0, dot) : fileName)
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'file'
  return `account-${workspaceId}/${Date.now()}-${base}.${ext}`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get('file')
    const bucket = String(form.get('bucket') ?? '')
    const requestedWorkspace = form.get('workspace_id')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds the 16 MB limit.' },
        { status: 413 }
      )
    }

    const workspaceId = await resolveWorkspaceId(
      supabase,
      user.id,
      typeof requestedWorkspace === 'string' ? requestedWorkspace : null
    )
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'No workspace membership found.' },
        { status: 403 }
      )
    }

    const path = buildPath(workspaceId, file.name)
    const bytes = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin()
      .storage.from(bucket)
      .upload(path, bytes, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    if (PRIVATE_BUCKETS.has(bucket)) {
      return NextResponse.json({ publicUrl: null, path })
    }

    const {
      data: { publicUrl },
    } = admin().storage.from(bucket).getPublicUrl(path)

    return NextResponse.json({ publicUrl, path })
  } catch (err) {
    console.error('[storage/upload] failed:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { bucket, path } = body as { bucket?: string; path?: string }
    if (!bucket || !ALLOWED_BUCKETS.has(bucket) || !path) {
      return NextResponse.json({ error: 'bucket and path required' }, { status: 400 })
    }

    // The object must live under one of the caller's workspace prefixes.
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
    const allowed = (memberships ?? []).some((m: { workspace_id: string }) =>
      path.startsWith(`account-${m.workspace_id}/`)
    )
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await admin().storage.from(bucket).remove([path])
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[storage/upload] delete failed:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
