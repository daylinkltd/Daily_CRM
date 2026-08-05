import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_API_KEY_PREFIXES,
  API_KEY_PREFIX,
  LEGACY_API_KEY_PREFIXES,
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
} from './keys'

describe('API key prefix', () => {
  it('mints Dailybuz-branded keys', () => {
    expect(API_KEY_PREFIX).toBe('dailycrm_live_')
    const { plaintext, prefix } = generateApiKey()
    expect(plaintext.startsWith('dailycrm_live_')).toBe(true)
    expect(prefix.startsWith('dailycrm_live_')).toBe(true)
    // The display prefix must never contain the whole secret.
    expect(prefix.length).toBeLessThan(plaintext.length)
  })

  it('still accepts keys issued under the legacy prefix', () => {
    // Existing integrations must not break on the rename.
    expect(LEGACY_API_KEY_PREFIXES).toContain('wacrm_live_')
    for (const prefix of ACCEPTED_API_KEY_PREFIXES) {
      expect(looksLikeApiKey(`${prefix}abcdefghijklmnop`)).toBe(true)
    }
  })

  it('rejects strings without a known prefix, and bare prefixes', () => {
    expect(looksLikeApiKey('sk_live_whatever')).toBe(false)
    expect(looksLikeApiKey('dailycrm_live_')).toBe(false)
    expect(looksLikeApiKey('wacrm_live_')).toBe(false)
    expect(looksLikeApiKey('')).toBe(false)
  })

  it('hashes deterministically and differs per key', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(hashApiKey(a.plaintext)).toBe(a.hash)
    expect(a.hash).not.toBe(b.hash)
    expect(a.hash).toHaveLength(64)
  })
})
