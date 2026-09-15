// ============================================================
// POST /api/whatsapp/bridge-webhook — events from the Dailybuz
// WhatsApp Bridge (whatsapp-bridge/), HMAC-signed.
//
// The bridge is our own service, but its events are still verified
// like a stranger's: hex HMAC-SHA256 of the raw body against
// WHATSAPP_BRIDGE_WEBHOOK_SECRET, compared in constant time. A payload
// that fails the check is a 401, not a warning.
//
// Inbound messages reuse the SAME contact/conversation machinery as
// the Meta webhook (exported from ./../webhook/route) so a customer
// who messages over the bridge lands in the same inbox thread they'd
// land in over the Cloud API. Media the bridge saved is referenced via
// the authenticated /api/whatsapp/bridge-media proxy.
// ============================================================

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  findOrCreateContact,
  findOrCreateConversation,
  handleStatusUpdate,
} from '../webhook/route'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface BridgeEvent {
  instance_id?: string
  event?: string
  ts?: number
  data?: {
    id?: string
    from?: string
    push_name?: string
    timestamp?: number
    type?: string
    text?: string
    caption?: string
    filename?: string
    media_path?: string
    mimetype?: string
    latitude?: number
    longitude?: number
    message_ids?: string[]
    status?: string
    phone?: string
  }
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_BRIDGE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Bridge webhook is not configured' }, { status: 503 })
  }

  const raw = await request.text()
  const signature = request.headers.get('x-bridge-signature') ?? ''
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const sigBuf = Buffer.from(signature, 'utf8')
  const expBuf = Buffer.from(expected, 'utf8')
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: BridgeEvent
  try {
    body = JSON.parse(raw) as BridgeEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const instanceId = body.instance_id
  const event = body.event
  const data = body.data ?? {}
  if (!instanceId || !event) {
    return NextResponse.json({ error: 'instance_id and event are required' }, { status: 400 })
  }

  // The instance id IS the workspace id; the config row anchors tenant
  // isolation exactly like phone_number_id does for Meta.
  const { data: config } = await admin()
    .from('whatsapp_config')
    .select('workspace_id, user_id, phone_number_id, provider')
    .eq('provider', 'bridge')
    .eq('phone_number_id', instanceId)
    .maybeSingle()
  if (!config) {
    // Unknown instance: acknowledge so the bridge stops retrying, but
    // do nothing — never guess a tenant.
    console.warn(`[bridge-webhook] event for unknown instance ${instanceId}`)
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    switch (event) {
      case 'connected':
      case 'pair_success':
        await admin()
          .from('whatsapp_config')
          .update({ status: 'connected', connected_at: new Date().toISOString() })
          .eq('workspace_id', config.workspace_id)
          .eq('provider', 'bridge')
        break

      case 'disconnected':
      case 'logged_out':
        await admin()
          .from('whatsapp_config')
          .update({ status: 'disconnected' })
          .eq('workspace_id', config.workspace_id)
          .eq('provider', 'bridge')
        break

      case 'status':
        for (const id of data.message_ids ?? []) {
          await handleStatusUpdate({
            id,
            status: data.status === 'read' ? 'read' : 'delivered',
            timestamp: String(body.ts ?? Math.floor(Date.now() / 1000)),
            recipient_id: data.from ?? '',
          })
        }
        break

      case 'message': {
        if (!data.from || !data.id) break

        const contactOutcome = await findOrCreateContact(
          config.user_id,
          data.from,
          data.push_name || data.from,
          config.workspace_id,
        )
        if (!contactOutcome) break
        const conversation = await findOrCreateConversation(
          config.user_id,
          contactOutcome.contact.id,
          config.workspace_id,
        )
        if (!conversation) break

        // messages.content_type CHECK list — same mapping rule as the
        // Meta webhook. Location becomes text (lat,lng) because the
        // bridge has no Meta location card to reference.
        const kind = data.type ?? 'text'
        const contentType = ['text', 'image', 'document', 'audio', 'video'].includes(kind)
          ? kind
          : 'text'
        const contentText =
          kind === 'location'
            ? `📍 Location: ${data.latitude}, ${data.longitude}`
            : (data.text || data.caption || (kind === 'document' ? data.filename : null) || null)
        const mediaUrl = data.media_path
          ? `/api/whatsapp/bridge-media?path=${encodeURIComponent(data.media_path)}`
          : null

        const createdAt = data.timestamp
          ? new Date(data.timestamp * 1000).toISOString()
          : new Date().toISOString()

        const { error: msgError } = await admin().from('messages').insert({
          conversation_id: conversation.id,
          sender_type: 'customer',
          content_type: contentType,
          content_text: contentText,
          media_url: mediaUrl,
          message_id: data.id,
          status: 'delivered',
          created_at: createdAt,
        })
        if (msgError) {
          console.error('[bridge-webhook] message insert:', msgError)
          break
        }

        // Same atomic unread bump the Meta webhook uses (migration 053),
        // with the same racy fallback for databases without the RPC.
        const preview = contentText || `[${kind}]`
        const { error: rpcErr } = await admin().rpc('record_inbound_conversation_update', {
          p_conversation_id: conversation.id,
          p_last_message_text: preview,
        })
        if (rpcErr) {
          await admin()
            .from('conversations')
            .update({
              last_message_text: preview,
              last_message_at: createdAt,
              status: 'open',
            })
            .eq('id', conversation.id)
        }
        break
      }

      default:
        break // future event kinds are ignored, not errors
    }
  } catch (err) {
    console.error('[bridge-webhook] processing failed:', err)
    // 500 so the bridge retries — its retry ladder is short and logged.
    return NextResponse.json({ error: 'processing failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
