import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp/meta-api'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { dispatchInboundToFlows } from '@/lib/flows/engine'
import {
  handleTemplateWebhookChange,
  isTemplateWebhookField,
} from '@/lib/whatsapp/template-webhook'
import { processChatbotReply } from '@/lib/chatbot/processor'

// Lazy-initialized to avoid build-time crash when env vars are missing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}



interface WhatsAppMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string; caption?: string }
  video?: { id: string; mime_type: string; caption?: string }
  document?: { id: string; mime_type: string; filename?: string; caption?: string }
  audio?: { id: string; mime_type: string }
  sticker?: { id: string; mime_type: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  reaction?: { message_id: string; emoji: string }
  /**
   * Set when the customer taps a button or list row on an interactive
   * message we sent. `button_reply.id` / `list_reply.id` is whatever id
   * we put on the button/row when sending — the Flows engine uses this
   * to advance the per-contact run.
   */
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
}

interface WhatsAppWebhookEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product: string
      metadata: {
        display_phone_number: string
        phone_number_id: string
      }
      contacts?: Array<{
        profile: { name: string }
        wa_id: string
      }>
      messages?: WhatsAppMessage[]
      statuses?: Array<{
        id: string
        status: string
        timestamp: string
        recipient_id: string
      }>
    }
    field: string
  }>
}

// GET - Webhook verification
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      // Return 200 for simple uptime pings or third-party provider test checks
      return NextResponse.json(
        { status: 'active', message: 'Daily CRM Webhook is active' },
        { status: 200 }
      )
    }

    // Fetch all whatsapp configs to check verify tokens
    const { data: configs, error: configError } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('id, verify_token')

    if (configError || !configs) {
      console.error('Error fetching configs for verification:', configError)
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      )
    }

    // Check if any config's verify_token matches. Also collect the
    // matching row so we can opportunistically upgrade its token to
    // GCM if it was still in the legacy CBC format.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedConfig: any = null
    for (const config of configs) {
      if (!config.verify_token) continue
      try {
        const decrypted = decrypt(config.verify_token)
        if (decrypted === verifyToken || config.verify_token === verifyToken) {
          matchedConfig = config
          break
        }
      } catch {
        if (config.verify_token === verifyToken) {
          matchedConfig = config
          break
        }
      }
    }

    if (matchedConfig) {
      // Fire-and-forget GCM upgrade. Safe to run on every subscribe
      // since it's a no-op once the column is already GCM.
      if (isLegacyFormat(matchedConfig.verify_token)) {
        void supabaseAdmin()
          .from('whatsapp_config')
          .update({ verify_token: encrypt(verifyToken) })
          .eq('id', matchedConfig.id)
          .then(({ error }: { error: unknown }) => {
            if (error) {
              console.warn(
                '[webhook] verify_token GCM upgrade failed:',
                (error as { message?: string })?.message ?? error,
              )
            }
          })
      }
      // Return challenge as plain text
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return NextResponse.json(
      { error: 'Verification token mismatch' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in webhook GET verification:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export interface WebhookLogEntry {
  id: string
  timestamp: string
  method: string
  signature: string | null
  userAgent: string | null
  rawBody: string
  status: number
  error?: string | null
}

export const recentWebhookLogs: WebhookLogEntry[] = []

export function recordWebhookLog(entry: Omit<WebhookLogEntry, 'id' | 'timestamp'>) {
  const logItem: WebhookLogEntry = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    ...entry,
  }
  recentWebhookLogs.unshift(logItem)
  if (recentWebhookLogs.length > 50) {
    recentWebhookLogs.pop()
  }
}

// POST - Receive messages
export async function POST(request: Request) {
  // Read raw body first so we can HMAC-verify the exact bytes Meta
  // signed. request.json() would re-encode and break the signature.
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const userAgent = request.headers.get('user-agent')

  let body: { entry?: WhatsAppWebhookEntry[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    recordWebhookLog({
      method: 'POST',
      signature,
      userAgent,
      rawBody: rawBody.slice(0, 500),
      status: 400,
      error: 'Invalid JSON',
    })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Normalize flat ApiAuto payload to standard WhatsApp entry structure
  if (!body.entry && (body as any).phoneid) {
    const flat = body as any
    body.entry = [
      {
        id: String(flat.phoneid),
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '',
                phone_number_id: String(flat.phoneid),
              },
              contacts: [
                {
                  profile: { name: flat.name || flat.mobile || 'WhatsApp User' },
                  wa_id: String(flat.mobile || ''),
                },
              ],
              messages: [
                {
                  id: flat.msgId || `apiauto-${flat.mobile || 'unknown'}-${Date.now()}`,
                  from: String(flat.mobile || ''),
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: flat.message || '' },
                },
              ],
            },
          },
        ],
      },
    ]
  }





  // Determine if signature verification can be safely bypassed.
  // Strategy:
  // 1. If the payload contains phone_number_ids we recognise as 'apiauto' -> bypass
  // 2. If NO Meta signature header is present at all AND there is at least one
  //    apiauto workspace in the DB -> bypass (handles cases where ApiAuto doesn't
  //    include phone_number_id in the top-level metadata field we expect)
  // 3. Otherwise enforce Meta HMAC signature.
  let requiresSignature = true
  let matchedAnyConfig = false
  const phoneIds = new Set<string>()

  if (body.entry) {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta = change.value.metadata as any
        // ApiAuto may send phone_number_id at different paths — check all common ones
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = change.value as any
        const pid =
          meta?.phone_number_id ||
          meta?.phoneId ||
          val?.phone_number_id ||
          entry.id  // some providers use the entry id as the phone identifier
        if (pid) phoneIds.add(String(pid))
      }
    }
  }

  const { data: dbConfigs } = await supabaseAdmin()
    .from('whatsapp_config')
    .select('*')

  if (phoneIds.size > 0 && dbConfigs) {
    const matchingConfigs = dbConfigs.filter((c: { phone_number_id?: string; waba_id?: string }) => {
      const cPhone = c.phone_number_id?.trim()
      const cWaba = c.waba_id?.trim()
      return Array.from(phoneIds).some(
        (pid) =>
          (cPhone && (cPhone === pid || pid.includes(cPhone))) ||
          (cWaba && (cWaba === pid || pid.includes(cWaba)))
      )
    })
    if (matchingConfigs.length > 0) {
      matchedAnyConfig = true
      requiresSignature = matchingConfigs.some((c: { provider?: string }) => c.provider === 'meta')
    }
  }

  // Fallback: no signature header + at least one apiauto workspace —
  // but ONLY when the payload matched no known config. A payload that
  // names a known Meta phone_number_id must always carry a valid
  // signature; without this guard, one apiauto tenant anywhere on the
  // instance would let anonymous callers inject forged inbound
  // messages into every Meta tenant's inbox. Unmatched payloads are
  // dropped by the tenant-isolation check in processWebhook anyway.
  if (requiresSignature && !signature && !matchedAnyConfig && dbConfigs) {
    const hasApiAuto = dbConfigs.some((c: { provider?: string }) => c.provider === 'apiauto')
    if (hasApiAuto) {
      console.log('[webhook] No signature header — allowing through for apiauto workspace')
      requiresSignature = false
    }
  }

  if (requiresSignature && !verifyMetaWebhookSignature(rawBody, signature, dbConfigs ?? [])) {
    console.warn('[webhook] rejected request with invalid signature. Body preview:', rawBody.slice(0, 200))
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Await processWebhook to guarantee serverless execution context stays alive
  // until all database writes (contacts, conversations, messages) are complete.
  try {
    await processWebhook(body)
  } catch (error) {
    console.error('Error processing webhook:', error)
  }

  recordWebhookLog({
    method: 'POST',
    signature,
    userAgent,
    rawBody: rawBody.slice(0, 1000),
    status: 200,
  })

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function processWebhook(body: { entry?: WhatsAppWebhookEntry[] }) {
  if (!body.entry) return

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      // Template-lifecycle events (status / quality / components
      // updates from Meta) come in on a different change.field and
      // have a different value shape — route them through the
      // dedicated handler. Skip the messaging branches below so we
      // don't try to read message-shaped fields off a template event.
      if (isTemplateWebhookField(change.field)) {
        await handleTemplateWebhookChange(
          { field: change.field, value: change.value as unknown },
          supabaseAdmin(),
        )
        continue
      }

      const value = change.value

      // Handle status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          await handleStatusUpdate(status)
        }
      }

      // Handle incoming messages
      if (!value.messages || !Array.isArray(value.messages) || value.messages.length === 0) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = value.metadata as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = value as any
      const phoneNumberId =
        meta?.phone_number_id ||
        meta?.phoneId ||
        val?.phone_number_id ||
        entry.id

      // Find user's config by phone_number_id with smart fallbacks
      const { data: configs } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('*')

      // Strict Multi-Tenant SaaS Isolation: Match config strictly by phone_number_id or waba_id.
      // NEVER fall back to another tenant's workspace config to prevent cross-tenant data leakage.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let config: any = null
      if (configs && configs.length > 0) {
        const pId = String(phoneNumberId).trim()
        const eId = String(entry.id).trim()

        config = configs.find(
          (c: { phone_number_id?: string; waba_id?: string }) => {
            const cPhone = c.phone_number_id?.trim()
            const cWaba = c.waba_id?.trim()
            return (
              (cPhone && (cPhone === pId || cPhone === eId || pId.includes(cPhone))) ||
              (cWaba && (cWaba === pId || cWaba === eId || pId.includes(cWaba)))
            )
          }
        )
      }

      if (!config) {
        console.error(
          `[webhook] TENANT ISOLATION GUARANTEE: Unmatched incoming payload (phone_number_id: ${phoneNumberId}, entry_id: ${entry.id}). Dropping request to prevent cross-tenant data leakage.`
        )
        continue
      }

      const decryptedAccessToken = decrypt(config.access_token)

      // Ensure config has a valid workspace_id
      let resolvedWorkspaceId = config.workspace_id
      if (!resolvedWorkspaceId && config.user_id) {
        const { data: member } = await supabaseAdmin()
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', config.user_id)
          .limit(1)
          .maybeSingle()

        if (member?.workspace_id) {
          resolvedWorkspaceId = member.workspace_id
          void supabaseAdmin()
            .from('whatsapp_config')
            .update({ workspace_id: resolvedWorkspaceId })
            .eq('id', config.id)
        }
      }

      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i]
        const contact =
          (value.contacts && (value.contacts[i] || value.contacts[0])) ||
          { profile: { name: message.from }, wa_id: message.from }

        await processMessage(
          message,
          contact,
          config.user_id,
          decryptedAccessToken,
          resolvedWorkspaceId
        )
      }
    }
  }
}

// The happy-path status ladder — pending → sent → delivered → read →
// replied. Webhook replays must never regress a recipient back down
// this ladder.
//
// `failed` is NOT on this ladder. It's a terminal side branch that is
// only valid from the early states (pending / sent) — once Meta has
// delivered or the user has read or replied, a later "failed" status
// event is a bug in Meta's pipeline or a spoof attempt and must be
// ignored.
const RECIPIENT_STATUS_LADDER = [
  'pending',
  'sent',
  'delivered',
  'read',
  'replied',
] as const

function ladderLevel(s: string): number {
  const idx = (RECIPIENT_STATUS_LADDER as readonly string[]).indexOf(s)
  return idx < 0 ? -1 : idx
}

/**
 * Can a recipient transition from `current` to `incoming`?
 *   - Along the ladder, only forward moves are allowed.
 *   - `failed` is accepted only from `pending` or `sent`; it's refused
 *     once the recipient has reached any of the success states.
 */
function isValidStatusTransition(current: string, incoming: string): boolean {
  if (incoming === 'failed') {
    return current === 'pending' || current === 'sent'
  }
  if (current === 'failed') {
    return false // failed is terminal
  }
  const ci = ladderLevel(current)
  const ii = ladderLevel(incoming)
  if (ii < 0) return false // unknown incoming status
  if (ci < 0) return true // unknown current — accept anything on the ladder
  return ii > ci
}

async function handleStatusUpdate(status: {
  id: string
  status: string
  timestamp: string
  recipient_id: string
}) {
  // 1) Mirror onto messages (legacy behavior) — Meta's status values
  //    already match the CHECK constraint on messages.status. Apply
  //    the same forward-only ladder as broadcast_recipients so an
  //    out-of-order delivery receipt can't regress a `read` message
  //    back to `delivered` (read ticks flickering off in the inbox).
  const { data: msgRows, error: msgFetchErr } = await supabaseAdmin()
    .from('messages')
    .select('id, status')
    .eq('message_id', status.id)

  if (msgFetchErr) {
    console.error('Error fetching message for status update:', msgFetchErr)
  } else if (msgRows) {
    for (const msgRow of msgRows) {
      if (!isValidStatusTransition(msgRow.status, status.status)) continue
      const { error: msgErr } = await supabaseAdmin()
        .from('messages')
        .update({ status: status.status })
        .eq('id', msgRow.id)
      if (msgErr) {
        console.error('Error updating message status:', msgErr)
      }
    }
  }

  // 2) Mirror onto broadcast_recipients via whatsapp_message_id
  //    (added in migration 003). The aggregate trigger on
  //    broadcast_recipients re-derives the parent broadcast's
  //    sent/delivered/read/failed counts automatically.
  //    Guard the timestamp — a non-numeric value would make
  //    toISOString() throw and abort the whole webhook batch.
  const tsMs = parseInt(status.timestamp) * 1000
  const tsIso = Number.isFinite(tsMs)
    ? new Date(tsMs).toISOString()
    : new Date().toISOString()

  const { data: recipient, error: recFetchErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .select('id, status')
    .eq('whatsapp_message_id', status.id)
    .maybeSingle()

  if (recFetchErr) {
    console.error('Error fetching broadcast recipient:', recFetchErr)
    return
  }
  if (!recipient) return // message wasn't part of a broadcast — fine

  // Guard transitions — forward-only on the success ladder, and
  // `failed` only from pre-delivered states.
  if (!isValidStatusTransition(recipient.status, status.status)) return

  const update: Record<string, unknown> = { status: status.status }
  if (status.status === 'sent' && !('sent_at' in update)) update.sent_at = tsIso
  if (status.status === 'delivered') update.delivered_at = tsIso
  if (status.status === 'read') update.read_at = tsIso

  const { error: recUpdateErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .update(update)
    .eq('id', recipient.id)

  if (recUpdateErr) {
    console.error('Error updating broadcast recipient status:', recUpdateErr)
  }
}

/**
 * If an inbound message's sender is on a still-unreplied
 * broadcast_recipients row, flip it to `replied` so the reply count
 * advances on the parent broadcast.
 *
 * Runs on a best-effort basis — failures here must not break the
 * main inbound-message flow, so errors are swallowed with a log.
 */
async function flagBroadcastReplyIfAny(userId: string, contactId: string) {
  try {
    // Most recent outbound broadcast that hasn't been replied to yet.
    const { data: recs, error } = await supabaseAdmin()
      .from('broadcast_recipients')
      .select('id, status, broadcast_id, broadcasts!inner(user_id)')
      .eq('contact_id', contactId)
      .eq('broadcasts.user_id', userId)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !recs || recs.length === 0) return

    const row = recs[0]
    const { error: updErr } = await supabaseAdmin()
      .from('broadcast_recipients')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', row.id)

    if (updErr) {
      console.error('Error marking broadcast recipient replied:', updErr)
    }
  } catch (err) {
    console.error('flagBroadcastReplyIfAny failed:', err)
  }
}

async function processMessage(
  message: WhatsAppMessage,
  contact: { profile: { name: string }; wa_id: string },
  userId: string,
  accessToken: string,
  workspaceId: string
) {
  const senderPhone = normalizePhone(message.from)
  const contactName = contact.profile.name

  // Parse message content based on type
  const { contentText, mediaUrl, mediaType } = await parseMessageContent(
    message,
    accessToken
  )

  // Find or create contact
  const contactOutcome = await findOrCreateContact(
    userId,
    senderPhone,
    contactName,
    workspaceId
  )
  if (!contactOutcome) return
  const contactRecord = contactOutcome.contact

  // Find or create conversation
  const conversation = await findOrCreateConversation(
    userId,
    contactRecord.id,
    workspaceId
  )
  if (!conversation) return

  // Insert message — field names MUST match the messages table schema
  // (see supabase/migrations/001_initial_schema.sql):
  //   conversation_id, sender_type, content_type, content_text,
  //   media_url, template_name, message_id, status, created_at
  // `mediaType` is intentionally unused — the schema has no media_type
  // column; the MIME type is only used to construct the proxy URL during
  // parseMessageContent. Silence the unused-var warning:
  void mediaType

  // The messages.content_type CHECK constraint only allows:
  //   text, image, document, audio, video, location, template
  // Map incoming WhatsApp types that aren't in that list to the closest
  // allowed value so the INSERT doesn't fail with a constraint error.
  const ALLOWED_CONTENT_TYPES = new Set([
    'text', 'image', 'document', 'audio', 'video', 'location', 'template', 'interactive',
  ])
  const contentType = ALLOWED_CONTENT_TYPES.has(message.type)
    ? message.type
    : message.type === 'sticker'
      ? 'image'   // stickers are images
      : 'text'    // reaction, unknown → text fallback

  // Determine whether this is the contact's very first inbound message
  // BEFORE we insert, so the count is accurate. Covers the case where
  // the contact row already exists (manual add / CSV import) but they've
  // never messaged us before — which new_contact_created wouldn't catch.
  const { count: priorCustomerMsgCount } = await supabaseAdmin()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'customer')
  const isFirstInboundMessage = (priorCustomerMsgCount ?? 0) === 0

  // Guard the timestamp — a malformed value would make toISOString()
  // throw and drop every remaining message in this webhook batch.
  const msgTsMs = parseInt(message.timestamp) * 1000
  const msgCreatedAt = Number.isFinite(msgTsMs)
    ? new Date(msgTsMs).toISOString()
    : new Date().toISOString()

  const { error: msgError } = await supabaseAdmin().from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'customer',
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl,
    message_id: message.id,
    status: 'delivered',
    created_at: msgCreatedAt,
  })

  if (msgError) {
    console.error('Error inserting message:', msgError)
    return
  }

  // Update conversation. The unread counter uses an atomic SQL
  // increment (migration 053) — a client-side read-modify-write loses
  // counts when two messages of one webhook batch land concurrently.
  // Falls back to the racy version when the RPC isn't installed yet.
  const { error: rpcErr } = await supabaseAdmin().rpc(
    'record_inbound_conversation_update',
    {
      p_conversation_id: conversation.id,
      p_last_message_text: contentText || `[${message.type}]`,
    }
  )
  if (rpcErr) {
    const { error: convError } = await supabaseAdmin()
      .from('conversations')
      .update({
        last_message_text: contentText || `[${message.type}]`,
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)

    if (convError) {
      console.error('Error updating conversation:', convError)
    }
  }

  // If this contact was a recent broadcast recipient, flag the reply
  // so the broadcast's `replied_count` advances (via the aggregate
  // trigger installed in migration 003).
  await flagBroadcastReplyIfAny(userId, contactRecord.id)

  // ============================================================
  // Flow runner dispatch.
  //
  // If the runner consumes the message (it either advanced an active
  // run or started a new one), we suppress the `new_message_received`
  // + `keyword_match` automation triggers for this inbound. Customer
  // is navigating the bot menu, not sending a fresh trigger word
  // that should fork into automations.
  //
  // The relationship-level triggers (`new_contact_created`,
  // `first_inbound_message`) still fire even when consumed — those
  // are about WHO is messaging, not what they said.
  //
  // Awaited (not fire-and-forget) because we need the `consumed`
  // result before deciding whether to dispatch automations. The
  // runner has its own try/catch and never throws. Accounts with
  // no active flows take the runner's early-exit "no_match" path
  // basically for free (one indexed SELECT for the active run).
  // ============================================================
  const flowResult = await dispatchInboundToFlows({
    accountId: userId,
    userId,
    contactId: contactRecord.id,
    conversationId: conversation.id,
    message: {
      kind: 'text',
      text: contentText ?? message.text?.body ?? '',
      meta_message_id: message.id,
    },
    isFirstInboundMessage,
  })
  const flowConsumed = flowResult.consumed

  // Fire any automations that react to this webhook event. All dispatches
  // run here (not earlier) so the contact, conversation, and inbound
  // message all exist before any step — including send_message — runs.
  // Fire-and-forget: a slow or failing automation must not block the
  // webhook's 200 OK response to Meta.
  const inboundText = contentText ?? message.text?.body ?? ''
  const automationTriggers: (
    | 'new_contact_created'
    | 'first_inbound_message'
    | 'new_message_received'
    | 'keyword_match'
  )[] = []
  // Content-level triggers are suppressed when a flow consumed the
  // message — see the comment block above.
  if (!flowConsumed) {
    automationTriggers.push('new_message_received', 'keyword_match')
  }
  // new_contact_created fires only when the webhook just auto-created the
  // contact row. first_inbound_message fires whenever this is the contact's
  // first-ever customer-sent message — a superset that also catches
  // manually-imported contacts sending for the first time. We dispatch both
  // so users can pick whichever semantic they want; an automation that
  // listens to only one trigger runs only when that trigger matches.
  if (contactOutcome.wasCreated) automationTriggers.unshift('new_contact_created')
  if (isFirstInboundMessage) automationTriggers.unshift('first_inbound_message')
  for (const triggerType of automationTriggers) {
    runAutomationsForTrigger({
      userId,
      triggerType,
      contactId: contactRecord.id,
      context: {
        message_text: inboundText,
        conversation_id: conversation.id,
      },
    }).catch((err) => console.error('[automations] dispatch failed:', err))
  }

  // Trigger AI Chatbot response asynchronously
  if (contentText) {
    processChatbotReply({
      workspaceId,
      conversationId: conversation.id,
      contactId: contactRecord.id,
      messageText: contentText,
    }).catch((err) => {
      console.error('[chatbot] processor failed:', err)
    })
  }
}

async function parseMessageContent(
  message: WhatsAppMessage,
  accessToken: string
): Promise<{
  contentText: string | null
  mediaUrl: string | null
  mediaType: string | null
}> {
  // getMediaUrl signature is (mediaId, accessToken) — earlier code had
  // the args swapped, so every verification hit an invalid Meta URL and
  // fell through to the catch block, leaving mediaUrl as null. That's
  // why images showed up as empty bubbles in the inbox.
  const verifyAndBuildUrl = async (
    mediaId: string
  ): Promise<string | null> => {
    try {
      await getMediaUrl({ mediaId, accessToken })
      return `/api/whatsapp/media/${mediaId}`
    } catch (error) {
      console.error(
        `Failed to verify media ${mediaId} with Meta:`,
        error instanceof Error ? error.message : error
      )
      return null
    }
  }

  switch (message.type) {
    case 'text':
      return {
        contentText: message.text?.body || null,
        mediaUrl: null,
        mediaType: null,
      }

    case 'image':
      if (message.image?.id) {
        return {
          contentText: message.image.caption || null,
          mediaUrl: await verifyAndBuildUrl(message.image.id),
          mediaType: message.image.mime_type,
        }
      }
      return { contentText: null, mediaUrl: null, mediaType: null }

    case 'video':
      if (message.video?.id) {
        return {
          contentText: message.video.caption || null,
          mediaUrl: await verifyAndBuildUrl(message.video.id),
          mediaType: message.video.mime_type,
        }
      }
      return { contentText: null, mediaUrl: null, mediaType: null }

    case 'document':
      if (message.document?.id) {
        return {
          contentText:
            message.document.caption || message.document.filename || null,
          mediaUrl: await verifyAndBuildUrl(message.document.id),
          mediaType: message.document.mime_type,
        }
      }
      return { contentText: null, mediaUrl: null, mediaType: null }

    case 'audio':
      if (message.audio?.id) {
        return {
          contentText: null,
          mediaUrl: await verifyAndBuildUrl(message.audio.id),
          mediaType: message.audio.mime_type,
        }
      }
      return { contentText: null, mediaUrl: null, mediaType: null }

    case 'sticker':
      // Stickers are images under the hood. Treat them as such so the
      // MessageBubble renders the <img>. The caller maps the DB
      // content_type to 'image' for the CHECK constraint.
      if (message.sticker?.id) {
        return {
          contentText: null,
          mediaUrl: await verifyAndBuildUrl(message.sticker.id),
          mediaType: message.sticker.mime_type,
        }
      }
      return { contentText: null, mediaUrl: null, mediaType: null }

    case 'location':
      if (message.location) {
        const loc = message.location
        const locationText = [loc.name, loc.address, `${loc.latitude},${loc.longitude}`]
          .filter(Boolean)
          .join(' - ')
        return {
          contentText: locationText,
          mediaUrl: null,
          mediaType: null,
        }
      }
      return { contentText: null, mediaUrl: null, mediaType: null }

    case 'reaction':
      return {
        contentText: message.reaction?.emoji || null,
        mediaUrl: null,
        mediaType: null,
      }

    case 'interactive': {
      // The customer tapped a reply button or a list row on a message
      // we previously sent. Meta delivers `interactive.button_reply` for
      // 3-button messages and `interactive.list_reply` for list messages.
      // Use the human-readable title as contentText so the inbox bubble
      // renders the tap legibly, and return null for media fields.
      const reply =
        message.interactive?.button_reply ?? message.interactive?.list_reply
      if (reply?.id) {
        return {
          contentText: reply.title || reply.id,
          mediaUrl: null,
          mediaType: null,
        }
      }
      return {
        contentText: '[Interactive reply]',
        mediaUrl: null,
        mediaType: null,
      }
    }

    default:
      return {
        contentText: `[Unsupported message type: ${message.type}]`,
        mediaUrl: null,
        mediaType: null,
      }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContactRow = any

interface ContactOutcome {
  contact: ContactRow
  /** True when this call created the row; drives new_contact_created
   *  automation dispatch in processMessage. */
  wasCreated: boolean
}

async function findExistingContactByPhone(
  workspaceId: string,
  phone: string
): Promise<ContactRow | null> {
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  const suffix = normalized.length >= 8 ? normalized.slice(-8) : normalized

  let query = supabaseAdmin().from('contacts').select('*')
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  }
  const { data, error } = await query.like('phone', `%${suffix}`)

  if (error || !data) return null

  return (data as ContactRow[]).find((c) => phonesMatch(c.phone, phone)) ?? null
}

async function findOrCreateContact(
  userId: string,
  phone: string,
  name: string,
  workspaceId: string
): Promise<ContactOutcome | null> {
  const existingContact = await findExistingContactByPhone(workspaceId, phone)

  if (existingContact) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: Record<string, any> = {}
    if (name && name !== existingContact.name) {
      updatePayload.name = name
    }
    if (workspaceId && !existingContact.workspace_id) {
      updatePayload.workspace_id = workspaceId
    }
    if (Object.keys(updatePayload).length > 0) {
      updatePayload.updated_at = new Date().toISOString()
      await supabaseAdmin()
        .from('contacts')
        .update(updatePayload)
        .eq('id', existingContact.id)
    }
    return { contact: existingContact, wasCreated: false }
  }

  // Create new contact
  const { data: newContact, error: createError } = await supabaseAdmin()
    .from('contacts')
    .insert({
      user_id: userId,
      phone,
      name: name || phone,
      workspace_id: workspaceId || null,
    })
    .select()
    .single()

  if (createError) {
    // SQLSTATE 23505: Unique constraint violation (lost insert race)
    // Re-resolve existing contact row instead of dropping the message
    if ((createError as { code?: string })?.code === '23505') {
      const raced = await findExistingContactByPhone(workspaceId, phone)
      if (raced) return { contact: raced, wasCreated: false }
    }
    console.error('Error creating contact:', createError)
    return null
  }

  return { contact: newContact, wasCreated: true }
}

async function findOrCreateConversation(userId: string, contactId: string, workspaceId: string) {
  // Look for existing conversation by contact_id first. The table has
  // no unique constraint on (workspace_id, contact_id), so duplicates
  // can exist — .maybeSingle() would error on >1 row and we'd insert
  // yet another duplicate. Take the most recent one instead.
  let query = supabaseAdmin().from('conversations').select('*').eq('contact_id', contactId)
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  }

  const { data: existingRows } = await query
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
  const existing = existingRows?.[0]

  if (existing) {
    if (workspaceId && !existing.workspace_id) {
      await supabaseAdmin()
        .from('conversations')
        .update({ workspace_id: workspaceId })
        .eq('id', existing.id)
      existing.workspace_id = workspaceId
    }
    return existing
  }

  // Create new conversation
  const { data: newConv, error: createError } = await supabaseAdmin()
    .from('conversations')
    .insert({
      user_id: userId,
      contact_id: contactId,
      workspace_id: workspaceId || null,
      status: 'open',
      bot_status: 'active',
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (createError) {
    if ((createError as { code?: string })?.code === '23505') {
      const raced = await supabaseAdmin()
        .from('conversations')
        .select('*')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1)
      if (raced.data?.[0]) return raced.data[0]
    }
    console.error('Error creating conversation:', createError)
    return null
  }

  return newConv
}
