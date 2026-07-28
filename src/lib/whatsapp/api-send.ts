import type { SupabaseClient } from '@supabase/supabase-js'
import { getWhatsAppProvider } from '@/lib/whatsapp/providers/factory'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import { withMetaErrorHint } from '@/lib/whatsapp/meta-error-hints'
import { findContactByPhoneDigits } from '@/lib/contacts/find-by-phone'
import { checkMessageLimit } from '@/lib/limits'
import type { MessageTemplate } from '@/types'

/**
 * Workspace-scoped WhatsApp send used by the public API (`/api/v1`).
 *
 * Encapsulates everything a caller must not get wrong: quota check,
 * contact/conversation resolution (creating them when the caller
 * supplies a bare phone number), the phone-variant retry loop, the
 * message row, and the conversation's last-message bookkeeping.
 *
 * Deliberately narrower than the dashboard's /api/whatsapp/send route:
 * no media, replies or chatbot auto-pause — an integration wants
 * "text or template to this recipient", and keeping the surface small
 * keeps the two paths from drifting in ways that matter.
 */

export type ApiSendType = 'text' | 'template'

export interface ApiSendArgs {
  /** Service-role or session client, already authorized for the workspace. */
  supabase: SupabaseClient
  workspaceId: string
  /** Attribution for created contacts. */
  userId: string | null
  /** Exactly one recipient selector is required. */
  conversationId?: string | null
  contactId?: string | null
  phone?: string | null
  /** Created only when resolving a brand-new contact from `phone`. */
  contactName?: string | null
  type: ApiSendType
  text?: string | null
  templateName?: string | null
  templateLanguage?: string | null
  templateParams?: string[] | null
}

export interface ApiSendResult {
  messageId: string
  whatsappMessageId: string
  conversationId: string
  contactId: string
  status: 'sent'
}

export class ApiSendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiSendError'
  }
}

export async function sendWhatsAppMessageForWorkspace(
  args: ApiSendArgs,
): Promise<ApiSendResult> {
  const {
    supabase,
    workspaceId,
    userId,
    conversationId,
    contactId,
    phone,
    contactName,
    type,
    text,
    templateName,
    templateLanguage,
    templateParams,
  } = args

  if (type === 'text' && !text?.trim()) {
    throw new ApiSendError('`text` is required when type is "text"', 400)
  }
  if (type === 'template' && !templateName?.trim()) {
    throw new ApiSendError(
      '`template_name` is required when type is "template"',
      400,
    )
  }
  if (!conversationId && !contactId && !phone) {
    throw new ApiSendError(
      'One of `conversation_id`, `contact_id` or `phone` is required',
      400,
    )
  }

  // ── Resolve the recipient, always inside this workspace ───────────
  let contact: { id: string; phone: string } | null = null
  let conversation: { id: string } | null = null

  if (conversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('id, contact:contacts(id, phone)')
      .eq('id', conversationId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!data) throw new ApiSendError('Conversation not found', 404)
    conversation = { id: data.id }
    const c = Array.isArray(data.contact) ? data.contact[0] : data.contact
    if (!c?.phone) {
      throw new ApiSendError('That conversation has no contact phone number', 400)
    }
    contact = { id: c.id, phone: c.phone }
  } else if (contactId) {
    const { data } = await supabase
      .from('contacts')
      .select('id, phone')
      .eq('id', contactId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!data) throw new ApiSendError('Contact not found', 404)
    contact = { id: data.id, phone: data.phone }
  } else if (phone) {
    const sanitized = sanitizePhoneForMeta(phone)
    if (!isValidE164(sanitized)) {
      throw new ApiSendError(
        'Invalid phone number — include the country code, e.g. +919876543210',
        400,
      )
    }
    // Digit-normalized match so the API never creates a duplicate of a
    // contact that's already stored in another format.
    const existing = await findContactByPhoneDigits(
      supabase,
      workspaceId,
      sanitized,
    )
    if (existing) {
      contact = { id: existing.id, phone: existing.phone }
    } else {
      const { data: created, error } = await supabase
        .from('contacts')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          name: contactName?.trim() || sanitized,
          phone: sanitized,
        })
        .select('id, phone')
        .single()
      if (error || !created) {
        throw new ApiSendError(
          `Could not create the contact: ${error?.message ?? 'unknown error'}`,
          500,
        )
      }
      contact = { id: created.id, phone: created.phone }
    }
  }

  if (!contact) throw new ApiSendError('Could not resolve a recipient', 400)

  // ── Plan quota ───────────────────────────────────────────────────
  const limitCheck = await checkMessageLimit(workspaceId)
  if (!limitCheck.allowed) {
    throw new ApiSendError(
      limitCheck.error || 'Message limit reached for the current plan.',
      403,
    )
  }

  // ── Provider config ──────────────────────────────────────────────
  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (!config) {
    throw new ApiSendError(
      'WhatsApp is not configured for this workspace.',
      400,
    )
  }

  let accessToken: string
  try {
    accessToken = decrypt(config.access_token)
  } catch {
    throw new ApiSendError(
      'The stored WhatsApp access token could not be decrypted. Re-save it in Settings.',
      500,
    )
  }
  const provider = getWhatsAppProvider(config.provider || 'meta')

  // Template row, so language + media headers + buttons reach Meta.
  let templateRow: MessageTemplate | undefined
  let language = templateLanguage || undefined
  if (type === 'template' && templateName) {
    let q = supabase
      .from('message_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('name', templateName)
    if (language) q = q.eq('language', language)
    const { data: rows } = await q.limit(1)
    if (rows && rows.length > 0) {
      templateRow = rows[0] as MessageTemplate
      language = language || templateRow.language
    }
  }

  // ── Ensure a conversation exists ──────────────────────────────────
  if (!conversation) {
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('contact_id', contact.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
    if (existingConv && existingConv.length > 0) {
      conversation = { id: existingConv[0].id }
    } else {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          contact_id: contact.id,
          status: 'open',
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (error || !created) {
        throw new ApiSendError(
          `Could not create a conversation: ${error?.message ?? 'unknown error'}`,
          500,
        )
      }
      conversation = { id: created.id }
    }
  }

  // ── Send, retrying trunk-prefix variants ─────────────────────────
  const sanitized = sanitizePhoneForMeta(contact.phone)
  const attempt = async (to: string): Promise<string> => {
    if (type === 'template') {
      const res = await provider.sendTemplate({
        phoneId: config.phone_number_id,
        wabaId: config.waba_id,
        token: accessToken,
        to,
        templateName: templateName!,
        params: templateParams ?? [],
        language,
        template: templateRow,
      })
      return res.messageId
    }
    const res = await provider.sendMessage({
      phoneId: config.phone_number_id,
      wabaId: config.waba_id,
      token: accessToken,
      to,
      text: text!,
    })
    return res.messageId
  }

  let whatsappMessageId = ''
  let workingPhone = sanitized
  let lastError: unknown = null
  for (const variant of phoneVariants(sanitized)) {
    try {
      whatsappMessageId = await attempt(variant)
      workingPhone = variant
      lastError = null
      break
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!isRecipientNotAllowedError(message)) {
        lastError = err
        break
      }
      lastError = err
    }
  }
  if (lastError) {
    const message =
      lastError instanceof Error ? lastError.message : String(lastError)
    throw new ApiSendError(`WhatsApp API error: ${withMetaErrorHint(message)}`, 502)
  }

  if (workingPhone !== sanitized) {
    await supabase
      .from('contacts')
      .update({ phone: workingPhone })
      .eq('id', contact.id)
  }

  // ── Persist. The message is already delivered, so a schema gap must
  // not lose it (see /api/whatsapp/send for the same reasoning). ────
  const { data: row, error: insertError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender_type: 'agent',
      content_type: type,
      content_text: type === 'text' ? text : null,
      template_name: type === 'template' ? templateName : null,
      message_id: whatsappMessageId,
      status: 'sent',
    })
    .select('id')
    .single()

  if (insertError || !row) {
    throw new ApiSendError(
      `The message was delivered on WhatsApp but could not be saved: ${insertError?.message ?? 'unknown error'}`,
      500,
    )
  }

  await supabase
    .from('conversations')
    .update({
      last_message_text: type === 'text' ? text : `[${type}]`,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  return {
    messageId: row.id,
    whatsappMessageId,
    conversationId: conversation.id,
    contactId: contact.id,
    status: 'sent',
  }
}
