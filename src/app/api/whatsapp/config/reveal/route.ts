import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'

/**
 * GET /api/whatsapp/config/reveal?workspace_id=…&field=access_token|app_secret|verify_token
 *
 * Returns the decrypted credential so the operator can eyeball it
 * against the Meta dashboard — the "show" (eye) toggle in Settings →
 * WhatsApp is useless without it, because the form only ever holds a
 * bullet placeholder and the real value never leaves the server.
 *
 * Gated to workspace owners/admins (a plain agent has no business
 * reading the account credentials) and rate-limited. Nothing is
 * logged: the value is returned to the caller and nowhere else.
 */

const REVEALABLE = new Set(['access_token', 'app_secret', 'verify_token'])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const field = searchParams.get('field') ?? 'access_token'

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspace_id is required' },
        { status: 400 }
      )
    }
    if (!REVEALABLE.has(field)) {
      return NextResponse.json({ error: 'Unknown field' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit(`reveal:${user.id}`, RATE_LIMITS.adminAction)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    // Only owners/admins may read credentials.
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: only workspace owners or admins can reveal credentials',
        },
        { status: 403 }
      )
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!config) {
      return NextResponse.json(
        { error: 'No WhatsApp configuration saved yet.' },
        { status: 404 }
      )
    }

    const stored = (config as Record<string, unknown>)[field]
    if (typeof stored !== 'string' || !stored) {
      return NextResponse.json(
        { error: 'This credential is not set.' },
        { status: 404 }
      )
    }

    // Values are stored encrypted; tolerate legacy plaintext rows.
    let value: string
    try {
      value = decrypt(stored)
    } catch {
      value = stored
    }

    return NextResponse.json(
      { field, value },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Error revealing WhatsApp credential:', error)
    return NextResponse.json(
      { error: 'Failed to reveal credential' },
      { status: 500 }
    )
  }
}
