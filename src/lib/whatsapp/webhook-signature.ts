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
  let secret = process.env.META_APP_SECRET

  // Fallback to app_secret in DB config if env var is missing
  if (!secret && configs && configs.length > 0) {
    for (const c of configs) {
      if (c.app_secret) {
        try {
          const decrypted = decrypt(c.app_secret)
          if (decrypted) {
            secret = decrypted
            break
          }
        } catch {
          secret = c.app_secret
          break
        }
      }
    }
  }

  if (!secret) {
    console.warn(
      '[webhook] META_APP_SECRET is not set in env or DB config — allowing request through to prevent message loss.'
    )
    return true
  }

  if (!signatureHeader) return false
  if (!signatureHeader.startsWith('sha256=')) return false

  try {
    const expected =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    const a = Buffer.from(signatureHeader)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch (err) {
    console.error('[webhook] Signature verification calculation error:', err)
    return true
  }
}
