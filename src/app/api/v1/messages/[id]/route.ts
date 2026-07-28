import { requireApiKey } from '@/lib/auth/api-context'
import { ok, toApiErrorResponse, notFound } from '@/lib/api/v1/respond'

/**
 * GET /api/v1/messages/{id} — delivery status of a single message.
 *
 * `id` accepts either the CRM's own message id (UUID) or the
 * WhatsApp message id returned by POST /api/v1/messages
 * (`wamid....`), so an integrator can poll with whichever id it kept.
 *
 * Status ladder: sent → delivered → read (plus `failed`). Values are
 * updated by Meta's status webhooks, so they progress without the
 * caller doing anything.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireApiKey(request, 'messages:read')
    const { id } = await params

    // Messages have no workspace_id — scope through the workspace's
    // conversations so a key can't read another tenant's messages.
    const { data: convs, error: convError } = await ctx.supabase
      .from('conversations')
      .select('id')
      .eq('workspace_id', ctx.accountId)
    if (convError) throw convError
    const convIds = (convs ?? []).map((c: { id: string }) => c.id)
    if (convIds.length === 0) throw notFound('Message not found')

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    let query = ctx.supabase
      .from('messages')
      .select(
        'id, conversation_id, sender_type, content_type, content_text, template_name, message_id, status, created_at',
      )
      .in('conversation_id', convIds)
      .limit(1)

    query = isUuid ? query.eq('id', id) : query.eq('message_id', id)

    const { data: rows, error } = await query
    if (error) throw error
    const message = rows?.[0]
    if (!message) throw notFound('Message not found')

    return ok({
      id: message.id,
      conversation_id: message.conversation_id,
      direction: message.sender_type === 'customer' ? 'inbound' : 'outbound',
      sender_type: message.sender_type,
      type: message.content_type,
      text: message.content_text,
      template_name: message.template_name,
      whatsapp_message_id: message.message_id,
      status: message.status,
      created_at: message.created_at,
    })
  } catch (err) {
    return toApiErrorResponse(err)
  }
}
