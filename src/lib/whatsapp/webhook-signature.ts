import crypto from 'node:crypto'
import { decrypt } from '@/lib/whatsapp/encryption'

/**
 * Verify the HMAC-SHA256 signature Meta attaches to webhook POSTs.
 *
 * Meta signs the raw request body with your App Secret and sends the
 * result in the `x-hub-signature-256: sha256=<hex>` header.
 */
/**
 * Expand a configured secret into the plausible variants an operator
 * may have actually stored. Env vars pasted into a hosting dashboard
 * (Coolify, Docker `--env-file`, etc.) routinely arrive with a
 * trailing newline or wrapped in quotes — the HMAC then never matches
 * even though the secret itself is correct, which is indistinguishable
 * from "Meta never called us".
 */
export function appSecretVariants(raw: string): string[] {
  const out: string[] = []
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v)
  }
  push(raw)
  const trimmed = raw.trim()
  push(trimmed)
  // Strip a single layer of matching surrounding quotes.
  const unquoted = trimmed.replace(/^(['"])([\s\S]*)\1$/, '$2').trim()
  push(unquoted)
  // Drop all internal whitespace — covers a secret that got line-wrapped.
  push(trimmed.replace(/\s+/g, ''))
  return out
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  configs?: Array<{ app_secret?: string | null }>
): boolean {
  // Collect candidate secrets from environment and DB configurations
  const candidateSecrets: string[] = []
  const addCandidate = (raw: string | null | undefined) => {
    if (!raw) return
    for (const variant of appSecretVariants(raw)) {
      if (!candidateSecrets.includes(variant)) candidateSecrets.push(variant)
    }
  }

  addCandidate(process.env.META_APP_SECRET)

  if (configs && configs.length > 0) {
    for (const c of configs) {
      if (c.app_secret) {
        try {
          addCandidate(decrypt(c.app_secret))
        } catch {
          // ignore decrypt failure
        }
      }
    }
  }

  // If no secrets are configured at all -> soft-fail (allow request to prevent message loss)
  if (candidateSecrets.length === 0) {
    console.warn(
      '[webhook] META_APP_SECRET unconfigured — allowing request through to prevent inbound message loss.'
    )
    return true
  }

  // Header is missing or malformed when secrets ARE configured
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  // Verify signature against available secrets
  for (const secret of candidateSecrets) {
    try {
      const expected =
        'sha256=' +
        crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
      const a = Buffer.from(signatureHeader)
      const b = Buffer.from(expected)
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true
      }
    } catch {
      // ignore calculation error
    }
  }

  return false
}
