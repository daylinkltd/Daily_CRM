import crypto from 'node:crypto'
import { decrypt } from '@/lib/whatsapp/encryption'

/**
 * Verify the HMAC-SHA256 signature Meta attaches to webhook POSTs.
 *
 * Meta signs the raw request body with your App Secret and sends the
 * result in the `x-hub-signature-256: sha256=<hex>` header.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  configs?: Array<{ app_secret?: string | null }>
): boolean {
  // Collect candidate secrets from environment and DB configurations
  const candidateSecrets: string[] = []
  const envSecret = process.env.META_APP_SECRET
  if (envSecret) candidateSecrets.push(envSecret)

  if (configs && configs.length > 0) {
    for (const c of configs) {
      if (c.app_secret) {
        try {
          const secret = decrypt(c.app_secret)
          if (secret && !candidateSecrets.includes(secret)) {
            candidateSecrets.push(secret)
          }
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
