import { describe, expect, it } from 'vitest'
import { metaErrorHint, withMetaErrorHint } from './meta-error-hints'

describe('metaErrorHint', () => {
  it('maps the dev-mode allowed-list error (#131030)', () => {
    const hint = metaErrorHint(
      '(#131030) Recipient phone number not in allowed list'
    )
    expect(hint).toMatch(/Development Mode/i)
  })

  it('maps the 24-hour window / re-engagement error (#131047)', () => {
    expect(metaErrorHint('(#131047) Re-engagement message')).toMatch(
      /template/i
    )
  })

  it('maps undeliverable recipients (#131026)', () => {
    expect(metaErrorHint('(#131026) Message undeliverable')).toMatch(
      /can't receive/i
    )
  })

  it('maps unregistered Cloud API numbers (#133010)', () => {
    expect(
      metaErrorHint('(#133010) The account is not registered')
    ).toMatch(/two-step verification PIN/i)
  })

  it('maps expired access tokens', () => {
    expect(
      metaErrorHint('Error validating access token: Session has expired')
    ).toMatch(/System User token/i)
  })

  it('maps template parameter mismatches (#132000)', () => {
    expect(
      metaErrorHint(
        '(#132000) Number of parameters does not match the expected number of params'
      )
    ).toMatch(/placeholder/i)
  })

  it('returns null for unknown errors', () => {
    expect(metaErrorHint('Something completely unexpected')).toBeNull()
    expect(metaErrorHint('')).toBeNull()
  })
})

describe('withMetaErrorHint', () => {
  it('appends the hint after an em-dash', () => {
    const out = withMetaErrorHint('(#131047) Re-engagement message')
    expect(out.startsWith('(#131047) Re-engagement message — ')).toBe(true)
  })

  it('passes unknown messages through untouched', () => {
    expect(withMetaErrorHint('boom')).toBe('boom')
  })
})
