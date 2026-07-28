import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWhatsAppProvider } from '@/lib/whatsapp/providers/factory'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import { withMetaErrorHint } from '@/lib/whatsapp/meta-error-hints'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import { checkMessageLimit } from '@/lib/limits'
import type { MessageTemplate } from '@/types'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Per-user rate limit. Bucket key is scoped to this route so
    // `/broadcast` has an independent budget.
    const limit = checkRateLimit(`send:${user.id}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      conversation_id,
      message_type,
      content_text,
      media_url,
      filename,
      template_name,
      template_language,
      template_params,
      template_message_params,
      reply_to_message_id,
    } = body

    if (!conversation_id || !message_type) {
      return NextResponse.json(
        { error: 'conversation_id and message_type are required' },
        { status: 400 }
      )
    }

    const MEDIA_KINDS = ['image', 'video', 'document', 'audio'] as const
    type MediaKind = (typeof MEDIA_KINDS)[number]
    const isMediaSend = (MEDIA_KINDS as readonly string[]).includes(message_type)

    if (!isMediaSend && message_type !== 'text' && message_type !== 'template') {
      return NextResponse.json(
        { error: `Unsupported message_type "${message_type}"` },
        { status: 400 }
      )
    }

    if (message_type === 'text' && !content_text) {
      return NextResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 }
      )
    }

    if (message_type === 'template' && !template_name) {
      return NextResponse.json(
        { error: 'template_name is required for template messages' },
        { status: 400 }
      )
    }

    if (isMediaSend && !media_url) {
      return NextResponse.json(
        { error: `media_url is required for ${message_type} messages` },
        { status: 400 }
      )
    }

    // Meta caps media captions at 1024 chars — mirror the composer's limit
    // here so direct API callers get a clear error instead of a Meta 400.
    if (isMediaSend && typeof content_text === 'string' && content_text.length > 1024) {
      return NextResponse.json(
        { error: 'Media captions are limited to 1024 characters' },
        { status: 400 }
      )
    }

    // Fetch conversation with its workspace_id (workspace-scoped RLS applied)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const contact = conversation.contact
    if (!contact?.phone) {
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      )
    }

    // Sanitize and validate phone
    const sanitizedPhone = sanitizePhoneForMeta(contact.phone)
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Fetch WhatsApp config scoped by workspace_id
    const workspaceId = conversation.workspace_id

    // Check message quota limits
    const limitCheck = await checkMessageLimit(workspaceId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.error || 'Message limit reached. Please upgrade your plan.' },
        { status: 403 }
      );
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured for this workspace. Please set up your WhatsApp integration first.' },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    // Self-heal legacy CBC-encrypted tokens (fire-and-forget)
    if (isLegacyFormat(config.access_token)) {
      void supabase
        .from('whatsapp_config')
        .update({ access_token: encrypt(accessToken) })
        .eq('id', config.id)
        .then(({ error }) => {
          if (error) {
            console.warn(
              '[whatsapp/send] access_token GCM upgrade failed:',
              error.message,
            )
          }
        })
    }

    // Resolve the correct provider driver
    const provider = getWhatsAppProvider(config.provider || 'meta')

    if (isMediaSend && typeof provider.sendMedia !== 'function') {
      return NextResponse.json(
        { error: `Media messages are not supported for the "${config.provider || 'meta'}" provider` },
        { status: 400 }
      )
    }

    // Quoted reply — resolve the parent message's provider (Meta) id so
    // the send carries a `context` and renders as a reply on the
    // recipient's phone. Scoped to the same conversation so a client
    // can't quote across threads/workspaces. Missing/unsent parents are
    // ignored rather than failing the send.
    let contextMessageId: string | undefined
    let replyToMessageId: string | null = null
    if (reply_to_message_id) {
      const { data: parentMsg } = await supabase
        .from('messages')
        .select('id, message_id')
        .eq('id', reply_to_message_id)
        .eq('conversation_id', conversation_id)
        .maybeSingle()
      if (parentMsg) {
        replyToMessageId = parentMsg.id
        if (parentMsg.message_id) contextMessageId = parentMsg.message_id
      }
    }

    // Template sends: load the workspace's template row so the structured
    // send-builder path (media headers, URL-button variables) is used and
    // the correct language code is sent — Meta rejects a template when the
    // language doesn't match an approved translation.
    let templateRow: MessageTemplate | undefined
    let templateLanguage: string | undefined =
      typeof template_language === 'string' && template_language
        ? template_language
        : undefined
    if (message_type === 'template') {
      let templateQuery = supabase
        .from('message_templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('name', template_name)
      if (templateLanguage) {
        templateQuery = templateQuery.eq('language', templateLanguage)
      }
      const { data: rows } = await templateQuery.limit(1)
      if (rows && rows.length > 0) {
        templateRow = rows[0] as MessageTemplate
        templateLanguage = templateLanguage || templateRow.language
      }
    }

    // Structured per-send template values (body/header/button params).
    // Whitelisted so arbitrary client JSON can't reach the send builder.
    const messageParams =
      message_type === 'template' &&
      template_message_params &&
      typeof template_message_params === 'object'
        ? {
            body: Array.isArray(template_message_params.body)
              ? template_message_params.body
              : undefined,
            headerText:
              typeof template_message_params.headerText === 'string'
                ? template_message_params.headerText
                : undefined,
            buttonParams:
              template_message_params.buttonParams &&
              typeof template_message_params.buttonParams === 'object'
                ? template_message_params.buttonParams
                : undefined,
          }
        : undefined

    // Build a unified send function using the driver
    const attempt = async (phone: string): Promise<string> => {
      if (message_type === 'template') {
        const result = await provider.sendTemplate({
          phoneId: config.phone_number_id,
          wabaId: config.waba_id,
          token: accessToken,
          to: phone,
          templateName: template_name,
          params: template_params || [],
          language: templateLanguage,
          template: templateRow,
          messageParams,
          contextMessageId,
        })
        return result.messageId
      }
      if (isMediaSend) {
        const result = await provider.sendMedia!({
          phoneId: config.phone_number_id,
          wabaId: config.waba_id,
          token: accessToken,
          to: phone,
          kind: message_type as MediaKind,
          link: media_url,
          caption: content_text || undefined,
          filename: typeof filename === 'string' ? filename : undefined,
          contextMessageId,
        })
        return result.messageId
      }
      const result = await provider.sendMessage({
        phoneId: config.phone_number_id,
        wabaId: config.waba_id,
        token: accessToken,
        to: phone,
        text: content_text,
        contextMessageId,
      })
      return result.messageId
    }

    // Phone-variant retry loop (important for Meta sandbox & trunk-0 numbers)
    let waMessageId = ''
    let workingPhone = sanitizedPhone

    try {
      const variants = phoneVariants(sanitizedPhone)
      let lastError: unknown = null

      for (const variant of variants) {
        try {
          waMessageId = await attempt(variant)
          workingPhone = variant
          lastError = null
          break
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          // Only retry when Meta specifically rejects the recipient;
          // other errors (bad token, invalid template) should surface immediately.
          if (!isRecipientNotAllowedError(message)) {
            throw err
          }
          lastError = err
          console.warn(`[whatsapp/send] variant "${variant}" rejected, trying next…`)
        }
      }

      if (lastError) throw lastError
    } catch (err) {
      const message = err instanceof Error ? err.message : 'API error'
      console.error('WhatsApp send failed for all variants:', message)
      return NextResponse.json(
        { error: `WhatsApp API error: ${withMetaErrorHint(message)}` },
        { status: 502 }
      )
    }

    // Auto-correct the contact's stored phone number if an alternate variant succeeded
    if (workingPhone !== sanitizedPhone) {
      console.log(
        `[whatsapp/send] Auto-corrected contact phone: ${sanitizedPhone} → ${workingPhone}`
      )
      await supabase
        .from('contacts')
        .update({ phone: workingPhone })
        .eq('id', contact.id)
    }

    // Insert message into DB.
    //
    // At this point WhatsApp has ALREADY delivered the message, so a
    // failed insert loses it from the CRM permanently. Optional columns
    // (reply_to_message_id — migration 070) are therefore stripped and
    // retried rather than failing the whole write: the reply-quote link
    // is worth far less than the message itself.
    const baseRow: Record<string, unknown> = {
      conversation_id,
      sender_type: 'agent',
      content_type: message_type,
      content_text: content_text || null,
      media_url: media_url || null,
      template_name: template_name || null,
      message_id: waMessageId,
      status: 'sent',
    }

    const insertMessage = async (row: Record<string, unknown>) =>
      supabase.from('messages').insert(row).select().single()

    let { data: messageRecord, error: msgError } = await insertMessage({
      ...baseRow,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    })

    const isMissingColumn = (e: { code?: string; message?: string } | null) =>
      e?.code === 'PGRST204' ||
      e?.code === '42703' ||
      /could not find the .* column|column .* does not exist/i.test(e?.message ?? '')

    if (msgError && replyToMessageId && isMissingColumn(msgError)) {
      console.warn(
        '[whatsapp/send] messages.reply_to_message_id is missing — run migration 070. Saving without the reply link.',
      )
      ;({ data: messageRecord, error: msgError } = await insertMessage(baseRow))
    }

    if (msgError || !messageRecord) {
      console.error('Error inserting sent message:', msgError)
      return NextResponse.json(
        {
          error: `The message was delivered on WhatsApp but could not be saved to the CRM: ${msgError?.message ?? 'unknown error'}`,
          whatsapp_message_id: waMessageId,
          delivered: true,
        },
        { status: 500 }
      )
    }

    // Fetch chatbot configuration to see if we should auto-pause the chatbot
    let botStatusUpdates: Record<string, any> = {}
    const { data: chatbotConfig } = await supabase
      .from('chatbot_config')
      .select('is_enabled, auto_pause_duration')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (chatbotConfig && chatbotConfig.is_enabled && chatbotConfig.auto_pause_duration !== 0) {
      botStatusUpdates = {
        bot_status: 'paused',
        bot_paused_until: chatbotConfig.auto_pause_duration > 0
          ? new Date(Date.now() + chatbotConfig.auto_pause_duration * 60 * 1000).toISOString()
          : null
      }
    }

    // Update conversation last message & bot status
    await supabase
      .from('conversations')
      .update({
        last_message_text: content_text || `[${message_type}]`,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...botStatusUpdates
      })
      .eq('id', conversation_id)

    return NextResponse.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: waMessageId,
    })
  } catch (error) {
    console.error('Error in WhatsApp send POST:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
