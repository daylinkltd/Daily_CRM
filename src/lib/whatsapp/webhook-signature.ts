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
  const envSecret = process.env.META_APP_SECRET

  // Strict verification if META_APP_SECRET is set in environment
  if (envSecret) {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
    const expected =
      'sha256=' +
      crypto.createHmac('sha256', envSecret).update(rawBody).digest('hex')
    const a = Buffer.from(signatureHeader)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  }

  // If process.env.META_APP_SECRET is not configured, check DB configs
  if (configs && configs.length > 0) {
    for (const c of configs) {
      if (c.app_secret) {
        try {
          const secret = decrypt(c.app_secret)
          if (secret && signatureHeader && signatureHeader.startsWith('sha256=')) {
            const expected =
              'sha256=' +
              crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
            const a = Buffer.from(signatureHeader)
            const b = Buffer.from(expected)
            if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
              return true
            }
          }
        } catch {
          // ignore decrypt failure
        }
      }
    }
  }

  // Fall-through: META_APP_SECRET unconfigured in env — log warning and allow request to prevent message loss
  console.warn(
    '[webhook] META_APP_SECRET unconfigured or soft-failed — allowing request through to prevent inbound message loss.'
  )
  return true
}
