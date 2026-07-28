import type { ParsedInbound } from './types'

/**
 * The subset of Meta's inbound message payload that inbound parsing
 * needs. Structurally compatible with the webhook's WhatsAppMessage —
 * kept minimal here so this stays a pure, dependency-free function
 * the tests can exercise with literals.
 */
export interface InboundMessageLike {
  id: string
  type: string
  text?: { body: string }
  interactive?: {
    type?: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
}

/**
 * Lift a normalized ParsedInbound out of a raw Meta message so the
 * Flows engine sees button/list taps as `interactive_reply` (with the
 * reply_id it needs for `matchReplyId`) instead of plain text.
 *
 * Everything that isn't an interactive reply is passed through as
 * `text`, using the webhook's already-parsed contentText (which covers
 * captions, locations, etc.) with the raw text body as fallback.
 */
export function buildParsedInbound(
  message: InboundMessageLike,
  contentText: string | null,
): ParsedInbound {
  if (message.type === 'interactive') {
    const reply =
      message.interactive?.button_reply ?? message.interactive?.list_reply
    if (reply?.id) {
      return {
        kind: 'interactive_reply',
        reply_id: reply.id,
        reply_title: reply.title || reply.id,
        meta_message_id: message.id,
      }
    }
    // Malformed interactive payload — fall through to text so the
    // fallback policy (reprompt/handoff) still gets a shot at it.
  }
  return {
    kind: 'text',
    text: contentText ?? message.text?.body ?? '',
    meta_message_id: message.id,
  }
}

/**
 * The tapped reply id, if this inbound is a button/list reply.
 * Persisted onto messages.interactive_reply_id (migration 027).
 */
export function extractInteractiveReplyId(
  message: InboundMessageLike,
): string | null {
  if (message.type !== 'interactive') return null
  const reply =
    message.interactive?.button_reply ?? message.interactive?.list_reply
  return reply?.id ?? null
}
