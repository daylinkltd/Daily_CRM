/**
 * Map raw Meta Cloud API error messages to actionable guidance the
 * user can act on without reading Meta's error-code docs.
 *
 * The raw message is still shown — the hint is appended so support
 * can always see what Meta actually said.
 */

interface HintRule {
  pattern: RegExp
  hint: string
}

const HINT_RULES: HintRule[] = [
  {
    // Dev-mode allowed-list rejection. This is why messages "send" to
    // the owner's own number (an app admin) but never reach anyone else.
    pattern: /131030|not in allowed list|recipient phone number not in/i,
    hint:
      'Your Meta app is in Development Mode, so WhatsApp only delivers to phone numbers with an app role or listed as test recipients. Fix: Meta App Dashboard → complete Business Verification, switch the app to Live mode — or temporarily add each recipient under WhatsApp → API Setup → "To" numbers.',
  },
  {
    pattern: /131047|re-?engagement|24.?h(our)?s? (window|session)/i,
    hint:
      'The 24-hour customer service window for this contact has closed. Send an approved template message to re-open the conversation.',
  },
  {
    pattern: /131026|message undeliverable/i,
    hint:
      "The recipient can't receive this message — the number may not be on WhatsApp, may have blocked your business, or hasn't accepted WhatsApp's latest terms.",
  },
  {
    pattern: /133010|account (is )?not registered|phone number not registered/i,
    hint:
      'This phone number is not registered on the WhatsApp Cloud API. Register it with your two-step verification PIN (Settings → WhatsApp → Register Number, or POST /api/admin/register-phone).',
  },
  {
    pattern: /131031|account has been locked|restricted/i,
    hint:
      'Your WhatsApp Business Account is locked or restricted by Meta. Check Meta Business Support Home for policy violations or verification requests.',
  },
  {
    pattern: /session has expired|access token|error validating|oauth|code":\s*190|\(#190\)/i,
    hint:
      'The access token is invalid or expired. Generate a permanent System User token in Meta Business Settings and re-save it in Settings → WhatsApp.',
  },
  {
    pattern: /132000|number of parameters does not match|template param/i,
    hint:
      "The template variable count doesn't match what was approved. Check the template's placeholders and the values you're sending.",
  },
  {
    pattern: /132001|template.*(not exist|not found)|translat/i,
    hint:
      'The template does not exist for this language, or is not approved yet. Verify the template name, language code, and approval status.',
  },
  {
    pattern: /130429|131048|131056|rate limit|too many/i,
    hint:
      'Meta is rate-limiting this number (messaging volume or quality based). Slow down sends and check the phone number quality rating in WhatsApp Manager.',
  },
]

/**
 * Return an actionable hint for a raw Meta error message, or null when
 * the error isn't one we recognise.
 */
export function metaErrorHint(message: string): string | null {
  if (!message) return null
  for (const rule of HINT_RULES) {
    if (rule.pattern.test(message)) return rule.hint
  }
  return null
}

/** Append the hint (when we have one) to the raw Meta error message. */
export function withMetaErrorHint(message: string): string {
  const hint = metaErrorHint(message)
  return hint ? `${message} — ${hint}` : message
}
