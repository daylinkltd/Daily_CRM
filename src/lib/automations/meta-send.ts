import { getWhatsAppProvider } from '@/lib/whatsapp/providers/factory'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import { supabaseAdmin } from './admin-client'

// ------------------------------------------------------------
// Automation-side WhatsApp sender (multi-provider aware).
//
// Accepts either workspaceId directly, or resolves it from userId
// via the workspace_members table for backward compatibility with
// the existing engine.ts call sites (which pass userId).
// ------------------------------------------------------------

interface SendTextArgs {
  /** Preferred: workspace-scoped lookup */
  workspaceId?: string
  /** Legacy fallback: resolved to workspaceId via workspace_members */
  userId?: string
  conversationId: string
  contactId: string
  text: string
}

interface SendTemplateArgs {
  workspaceId?: string
  userId?: string
  conversationId: string
  contactId: string
  templateName: string
  language?: string
  params?: string[]
}

export async function engineSendText(args: SendTextArgs): Promise<{ whatsapp_message_id: string }> {
  return sendViaProvider({ ...args, kind: 'text' })
}

export async function engineSendTemplate(
  args: SendTemplateArgs,
): Promise<{ whatsapp_message_id: string }> {
  return sendViaProvider({ ...args, kind: 'template' })
}

type SendInput =
  | (SendTextArgs & { kind: 'text' })
  | (SendTemplateArgs & { kind: 'template' })

/**
 * Resolves workspaceId. Prefers the directly passed workspaceId;
 * if absent, resolves via the first workspace_members row for userId.
 */
async function resolveWorkspaceId(input: SendInput): Promise<string> {
  if (input.workspaceId) return input.workspaceId

  if (!input.userId) {
    throw new Error('meta-send: either workspaceId or userId must be provided')
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', input.userId)
    .limit(1)
    .maybeSingle()

  if (error || !data?.workspace_id) {
    throw new Error(`meta-send: failed to resolve workspace for user ${input.userId}`)
  }

  return data.workspace_id
}

async function sendViaProvider(input: SendInput): Promise<{ whatsapp_message_id: string }> {
  const db = supabaseAdmin()

  const workspaceId = await resolveWorkspaceId(input)

  // Fetch contact — scope by workspace_id for security
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', input.contactId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (contactErr || !contact?.phone) {
    throw new Error('contact not found for this workspace')
  }

  const sanitized = sanitizePhoneForMeta(contact.phone)
  if (!isValidE164(sanitized)) {
    throw new Error(`contact phone invalid: ${contact.phone}`)
  }

  // Fetch WhatsApp config scoped to the workspace
  const { data: config, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (configErr || !config) {
    throw new Error('WhatsApp not configured for this workspace')
  }

  const accessToken = decrypt(config.access_token)
  const driver = getWhatsAppProvider(config.provider || 'meta')

  const attempt = async (phone: string): Promise<string> => {
    if (input.kind === 'template') {
      const r = await driver.sendTemplate({
        phoneId: config.phone_number_id,
        wabaId: config.waba_id,
        token: accessToken,
        to: phone,
        templateName: input.templateName,
        params: input.params,
      })
      return r.messageId
    }
    const r = await driver.sendMessage({
      phoneId: config.phone_number_id,
      wabaId: config.waba_id,
      token: accessToken,
      to: phone,
      text: input.text,
    })
    return r.messageId
  }

  // Phone-variant retry loop — same resilience as the manual send route
  const variants = phoneVariants(sanitized)
  let workingPhone = sanitized
  let waMessageId = ''
  let lastError: unknown = null

  for (const v of variants) {
    try {
      waMessageId = await attempt(v)
      workingPhone = v
      lastError = null
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!isRecipientNotAllowedError(msg)) throw err
      lastError = err
    }
  }
  if (lastError) throw lastError

  if (workingPhone !== sanitized) {
    await db.from('contacts').update({ phone: workingPhone }).eq('id', contact.id)
  }

  // Persist the sent message so it appears in the inbox
  const content_type = input.kind === 'template' ? 'template' : 'text'
  const content_text = input.kind === 'text' ? input.text : null
  const template_name = input.kind === 'template' ? input.templateName : null

  const { error: msgErr } = await db.from('messages').insert({
    conversation_id: input.conversationId,
    sender_type: 'bot',
    content_type,
    content_text,
    template_name,
    message_id: waMessageId,
    status: 'sent',
  })

  if (msgErr) {
    throw new Error(`sent to provider but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text:
        input.kind === 'template' ? `[template:${input.templateName}]` : input.text,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.conversationId)

  return { whatsapp_message_id: waMessageId }
}
