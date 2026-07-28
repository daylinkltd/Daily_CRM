import {
  sendInteractiveButtons,
  sendInteractiveList,
  sendMediaMessage,
  sendTextMessage,
  type InteractiveButton,
  type InteractiveListSection,
  type MediaKind,
} from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import { supabaseAdmin } from './admin-client'
import { checkMessageLimit } from '@/lib/limits'

// ------------------------------------------------------------
// Flows-side Meta sender (interactive variants).
//
// Mirrors src/lib/automations/meta-send.ts (engineSendText /
// engineSendTemplate) but emits interactive button + list messages.
// Kept separate from the automations file so the two engines don't
// fight over each other's shape — once both stabilize, the
// phone-variant retry + DB persistence are obvious extraction
// candidates into a shared base.
//
// Tenancy: everything is workspace-scoped (migration 010 made
// workspace_id NOT NULL on contacts / conversations /
// whatsapp_config). The workspace is resolved from the conversation
// row — the run's conversation is the source of truth for which
// tenant is sending, same as /api/whatsapp/send.
// ------------------------------------------------------------

type AdminClient = ReturnType<typeof supabaseAdmin>

interface SendContext {
  workspaceId: string
  contact: { id: string; phone: string }
  config: Record<string, unknown> & {
    phone_number_id: string
    access_token: string
  }
  accessToken: string
  sanitizedPhone: string
}

/**
 * Shared lookup for every engine send:
 *   conversation → workspace_id → plan-limit check → contact
 *   (workspace-scoped, defense-in-depth) → whatsapp_config.
 *
 * Throws with a human-readable reason on any miss; the engine
 * converts throws into a failed run + `error` event.
 */
async function resolveSendContext(
  db: AdminClient,
  conversationId: string,
  contactId: string,
): Promise<SendContext> {
  const { data: conversation, error: convErr } = await db
    .from('conversations')
    .select('id, workspace_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (convErr || !conversation?.workspace_id) {
    throw new Error('conversation not found or missing workspace')
  }
  const workspaceId = conversation.workspace_id as string

  const limitCheck = await checkMessageLimit(workspaceId)
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.error || 'Message limit reached. Please upgrade your plan.')
  }

  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', contactId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (contactErr || !contact?.phone) {
    throw new Error('contact not found for this workspace')
  }

  const sanitized = sanitizePhoneForMeta(contact.phone)
  if (!isValidE164(sanitized)) {
    throw new Error(`contact phone invalid: ${contact.phone}`)
  }

  const { data: config, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (configErr || !config) {
    throw new Error('WhatsApp not configured for this workspace')
  }

  return {
    workspaceId,
    contact: contact as { id: string; phone: string },
    config,
    accessToken: decrypt(config.access_token),
    sanitizedPhone: sanitized,
  }
}

/**
 * Meta rejects some registered numbers unless a trunk-0 / country-code
 * variant is used — try each until one lands, then persist the working
 * variant back onto the contact so future sends skip the retries.
 */
async function sendWithPhoneVariants(
  db: AdminClient,
  ctx: SendContext,
  attempt: (phone: string) => Promise<string>,
): Promise<string> {
  const variants = phoneVariants(ctx.sanitizedPhone)
  let workingPhone = ctx.sanitizedPhone
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

  if (workingPhone !== ctx.sanitizedPhone) {
    await db.from('contacts').update({ phone: workingPhone }).eq('id', ctx.contact.id)
  }
  return waMessageId
}

async function persistOutbound(
  db: AdminClient,
  args: {
    conversationId: string
    contentType: string
    contentText: string | null
    preview: string
    waMessageId: string
  },
): Promise<void> {
  const { error: msgErr } = await db.from('messages').insert({
    conversation_id: args.conversationId,
    sender_type: 'bot',
    content_type: args.contentType,
    content_text: args.contentText,
    message_id: args.waMessageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent to Meta but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: args.preview,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)
}

interface SendTextEngineArgs {
  /** Original author of the flow — used for log attribution only.
   *  Tenancy comes from the conversation's workspace_id. */
  userId: string
  conversationId: string
  contactId: string
  text: string
}

/**
 * Send a plain-text WhatsApp message from the Flows engine.
 *
 * Used by the runner's `send_message` and `collect_input` nodes —
 * both prompt the customer with text and either auto-advance (the
 * send_message case) or suspend awaiting a text reply (collect_input).
 */
export async function engineSendText(
  args: SendTextEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const db = supabaseAdmin()
  const ctx = await resolveSendContext(db, args.conversationId, args.contactId)

  const waMessageId = await sendWithPhoneVariants(db, ctx, async (phone) => {
    const r = await sendTextMessage({
      phoneNumberId: ctx.config.phone_number_id,
      accessToken: ctx.accessToken,
      to: phone,
      text: args.text,
    })
    return r.messageId
  })

  await persistOutbound(db, {
    conversationId: args.conversationId,
    contentType: 'text',
    contentText: args.text,
    preview: args.text,
    waMessageId,
  })

  return { whatsapp_message_id: waMessageId }
}

interface SendMediaEngineArgs {
  userId: string
  conversationId: string
  contactId: string
  kind: MediaKind
  /** Public URL Meta fetches at send time. */
  link: string
  caption?: string
  /** Document-only; ignored by Meta for image/video. */
  filename?: string
}

/**
 * Send an image / video / document from the Flows engine.
 *
 * Used by the runner's `send_media` node. Auto-advances after the
 * send lands (same suspend semantics as send_message). Persists the
 * outgoing message with `content_type` matching the media kind so the
 * inbox renders the right preview.
 */
export async function engineSendMedia(
  args: SendMediaEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  const db = supabaseAdmin()
  const ctx = await resolveSendContext(db, args.conversationId, args.contactId)

  const waMessageId = await sendWithPhoneVariants(db, ctx, async (phone) => {
    const r = await sendMediaMessage({
      phoneNumberId: ctx.config.phone_number_id,
      accessToken: ctx.accessToken,
      to: phone,
      kind: args.kind,
      link: args.link,
      caption: args.caption,
      filename: args.filename,
    })
    return r.messageId
  })

  // content_type='image'|'video'|'document' — allowed by the
  // messages_content_type_check constraint (migrations 001 + 027).
  // content_text carries the caption (or empty) so the conversation
  // list preview shows something meaningful when the user glances at it.
  await persistOutbound(db, {
    conversationId: args.conversationId,
    contentType: args.kind,
    contentText: args.caption ?? null,
    preview: args.caption?.trim() || `[${args.kind}]`,
    waMessageId,
  })

  return { whatsapp_message_id: waMessageId }
}

interface SendInteractiveButtonsEngineArgs {
  userId: string
  conversationId: string
  contactId: string
  bodyText: string
  buttons: InteractiveButton[]
  headerText?: string
  footerText?: string
}

interface SendInteractiveListEngineArgs {
  userId: string
  conversationId: string
  contactId: string
  bodyText: string
  buttonLabel: string
  sections: InteractiveListSection[]
  headerText?: string
  footerText?: string
}

/**
 * Send an interactive-button WhatsApp message from the Flows engine.
 *
 * Persists the outgoing message to `messages` with
 * `content_type='interactive'` and `sender_type='bot'` so the inbox
 * surfaces it with the "Button reply" affordance and the conversation
 * thread reflects the bot's prompt.
 *
 * Returns the Meta message id so the caller (engine) can stash it on
 * the `flow_runs.last_prompt_message_id` field for later reference.
 */
export async function engineSendInteractiveButtons(
  args: SendInteractiveButtonsEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  return sendInteractiveViaMeta({ ...args, kind: 'buttons' })
}

/**
 * Send an interactive-list WhatsApp message from the Flows engine.
 * Used when the flow needs more than 3 options (Meta's button cap).
 */
export async function engineSendInteractiveList(
  args: SendInteractiveListEngineArgs,
): Promise<{ whatsapp_message_id: string }> {
  return sendInteractiveViaMeta({ ...args, kind: 'list' })
}

type SendInput =
  | (SendInteractiveButtonsEngineArgs & { kind: 'buttons' })
  | (SendInteractiveListEngineArgs & { kind: 'list' })

async function sendInteractiveViaMeta(
  input: SendInput,
): Promise<{ whatsapp_message_id: string }> {
  const db = supabaseAdmin()
  const ctx = await resolveSendContext(db, input.conversationId, input.contactId)

  const waMessageId = await sendWithPhoneVariants(db, ctx, async (phone) => {
    if (input.kind === 'buttons') {
      const r = await sendInteractiveButtons({
        phoneNumberId: ctx.config.phone_number_id,
        accessToken: ctx.accessToken,
        to: phone,
        bodyText: input.bodyText,
        buttons: input.buttons,
        headerText: input.headerText,
        footerText: input.footerText,
      })
      return r.messageId
    }
    const r = await sendInteractiveList({
      phoneNumberId: ctx.config.phone_number_id,
      accessToken: ctx.accessToken,
      to: phone,
      bodyText: input.bodyText,
      buttonLabel: input.buttonLabel,
      sections: input.sections,
      headerText: input.headerText,
      footerText: input.footerText,
    })
    return r.messageId
  })

  // Persist the bot's prompt to the messages table so it appears in
  // the inbox. content_type='interactive' is allowed by the widened
  // CHECK constraint from migration 027; sender_type='bot'
  // distinguishes flow sends from manual agent sends.
  //
  // We do NOT set interactive_reply_id here — that column is reserved
  // for the customer's tap on this message, populated by the webhook
  // when their reply arrives.
  await persistOutbound(db, {
    conversationId: input.conversationId,
    contentType: 'interactive',
    contentText: input.bodyText,
    preview: input.bodyText,
    waMessageId,
  })

  return { whatsapp_message_id: waMessageId }
}
