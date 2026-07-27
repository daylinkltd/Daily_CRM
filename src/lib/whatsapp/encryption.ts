import crypto from 'crypto'

/**
 * WhatsApp token encryption & decryption.
 * Uses AES-256-GCM with SHA-256 derived key for high VPS resilience.
 */

function getEncryptionKeyBuffer(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY || 'daily-crm-vps-fallback-aes-256-key-32b-secret'
  const trimmed = rawKey.trim()

  // If rawKey is a 64-character hex string, parse as hex
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }

  // Otherwise derive a 32-byte (256-bit) key using SHA-256
  return crypto.createHash('sha256').update(trimmed).digest()
}

const GCM_IV_LENGTH = 12
const CBC_IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

export function encrypt(text: string): string {
  if (!text) return ''
  const key = getEncryptionKeyBuffer()
  const iv = crypto.randomBytes(GCM_IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  const key = getEncryptionKeyBuffer()
  const parts = encryptedText.split(':')

  if (parts.length === 3) {
    // GCM format
    const [ivHex, ctHex, tagHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    if (iv.length !== GCM_IV_LENGTH) {
      throw new Error(`Encrypted token has unexpected GCM IV length ${iv.length}`)
    }
    const authTag = Buffer.from(tagHex, 'hex')
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Encrypted token has unexpected GCM auth-tag length ${authTag.length}`)
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(ctHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  if (parts.length === 2) {
    // CBC legacy format
    const [ivHex, ctHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    if (iv.length !== CBC_IV_LENGTH) {
      throw new Error(`Encrypted token has unexpected CBC IV length ${iv.length}`)
    }
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(ctHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  throw new Error(
    `Encrypted token has unrecognised format (expected 1 or 2 colons, got ${
      parts.length - 1
    })`
  )
}

export function isLegacyFormat(encryptedText: string): boolean {
  if (!encryptedText) return false
  return encryptedText.split(':').length === 2
}
