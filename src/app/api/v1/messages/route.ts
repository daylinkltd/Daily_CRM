import { requireApiKey } from '@/lib/auth/api-context'
import { ok, toApiErrorResponse, badRequest, ApiError } from '@/lib/api/v1/respond'
import {
  sendWhatsAppMessageForWorkspace,
  ApiSendError,
} from '@/lib/whatsapp/api-send'

/**
 * POST /api/v1/messages — send a WhatsApp message.
 * GET  /api/v1/messages — list messages with their delivery status.
 *
 * Both are scoped to the API key's workspace; a key can never read or
 * write another tenant's data.
 */

/** Map an ApiSendError onto the public envelope's code vocabulary. */
function toEnvelope(err: ApiSendError): ApiError {
  const code =
    err.status === 404
      ? 'not_found'
      : err.status === 403
        ? 'forbidden'
        : err.status === 400
          ? 'bad_request'
          : 'internal'
  return new ApiError(code, err.message, err.status)
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'messages:send')

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      throw badRequest('Invalid JSON body')
    }

    const type = (body.type as string) ?? 'text'
    if (type !== 'text' && type !== 'template') {
      throw badRequest('`type` must be "text" or "template"')
    }

    // Attribute created contacts to the key's creator when we still
    // have them; otherwise to any member of the workspace.
    let userId = ctx.createdBy
    if (!userId) {
      const { data: member } = await ctx.supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', ctx.accountId)
        .limit(1)
        .maybeSingle()
      userId = member?.user_id ?? null
    }

    try {
      const result = await sendWhatsAppMessageForWorkspace({
        supabase: ctx.supabase,
        workspaceId: ctx.accountId,
        userId,
        conversationId: (body.conversation_id as string) ?? null,
        contactId: (body.contact_id as string) ?? null,
        phone: (body.phone as string) ?? null,
        contactName: (body.name as string) ?? null,
        type,
        text: (body.text as string) ?? (body.content_text as string) ?? null,
        templateName: (body.template_name as string) ?? null,
        templateLanguage: (body.template_language as string) ?? null,
        templateParams: Array.isArray(body.template_params)
          ? (body.template_params as string[]).map(String)
          : null,
      })

      return ok(
        {
          id: result.messageId,
          whatsapp_message_id: result.whatsappMessageId,
          conversation_id: result.conversationId,
          contact_id: result.contactId,
          status: result.status,
        },
        201,
      )
    } catch (err) {
      if (err instanceof ApiSendError) throw toEnvelope(err)
      throw err
    }
  } catch (err) {
    return toApiErrorResponse(err)
  }
}

const MAX_LIMIT = 100

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'messages:read')
    const { searchParams } = new URL(request.url)

    const conversationId = searchParams.get('conversation_id')
    const contactId = searchParams.get('contact_id')
    const status = searchParams.get('status')
    const limitRaw = Number(searchParams.get('limit') ?? '25')
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_LIMIT)
      : 25
    const offsetRaw = Number(searchParams.get('offset') ?? '0')
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0

    // Resolve the workspace's conversations first — messages carry no
    // workspace_id of their own, so this is what keeps the query
    // inside the key's tenant.
    let convQuery = ctx.supabase
      .from('conversations')
      .select('id, contact_id')
      .eq('workspace_id', ctx.accountId)
    if (conversationId) convQuery = convQuery.eq('id', conversationId)
    if (contactId) convQuery = convQuery.eq('contact_id', contactId)

    const { data: convs, error: convError } = await convQuery
    if (convError) throw convError
    const convIds = (convs ?? []).map((c: { id: string }) => c.id)
    if (convIds.length === 0) {
      return ok({ messages: [], limit, offset, has_more: false })
    }

    let query = ctx.supabase
      .from('messages')
      .select(
        'id, conversation_id, sender_type, content_type, content_text, template_name, message_id, status, created_at',
      )
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit) // one extra row to detect has_more
    if (status) query = query.eq('status', status)

    const { data: rows, error } = await query
    if (error) throw error

    const page = (rows ?? []).slice(0, limit)
    return ok({
      messages: page.map((m: Record<string, unknown>) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        direction: m.sender_type === 'customer' ? 'inbound' : 'outbound',
        sender_type: m.sender_type,
        type: m.content_type,
        text: m.content_text,
        template_name: m.template_name,
        whatsapp_message_id: m.message_id,
        status: m.status,
        created_at: m.created_at,
      })),
      limit,
      offset,
      has_more: (rows ?? []).length > limit,
    })
  } catch (err) {
    return toApiErrorResponse(err)
  }
}
