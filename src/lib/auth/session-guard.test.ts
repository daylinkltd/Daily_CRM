import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  sessionIdFromToken,
  trustCookieValue,
  isWithinTrustWindow,
  TRUST_WINDOW_SECONDS,
} from './session-guard';

/** Build an unsigned JWT-shaped string with the given payload. */
function fakeToken(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.signature`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('sessionIdFromToken', () => {
  it('reads the session_id claim', () => {
    expect(sessionIdFromToken(fakeToken({ sub: 'u1', session_id: 'sess-abc' }))).toBe('sess-abc');
  });

  it('survives base64url payloads needing padding', () => {
    // Payload lengths that are not a multiple of four are the common case
    // and used to be the easiest way to break a hand-rolled decoder.
    for (const id of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      expect(sessionIdFromToken(fakeToken({ session_id: id, pad: id }))).toBe(id);
    }
  });

  it('returns null rather than throwing on junk', () => {
    expect(sessionIdFromToken(undefined)).toBeNull();
    expect(sessionIdFromToken('')).toBeNull();
    expect(sessionIdFromToken('not-a-jwt')).toBeNull();
    expect(sessionIdFromToken('a.b')).toBeNull();
    expect(sessionIdFromToken('a.!!!not-base64!!!.c')).toBeNull();
    expect(sessionIdFromToken(fakeToken({ sub: 'u1' }))).toBeNull();
    expect(sessionIdFromToken(fakeToken({ session_id: '' }))).toBeNull();
  });
});

describe('trust window', () => {
  it('trusts a freshly written cookie for its own session', () => {
    expect(isWithinTrustWindow(trustCookieValue('sess-1'), 'sess-1')).toBe(true);
  });

  it('never trusts a cookie written for a different session', () => {
    // The case that matters: signing in as someone else on the same
    // browser must not inherit the previous user's verified window.
    expect(isWithinTrustWindow(trustCookieValue('sess-1'), 'sess-2')).toBe(false);
  });

  it('expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T00:00:00Z'));
    const cookie = trustCookieValue('sess-1');

    vi.advanceTimersByTime((TRUST_WINDOW_SECONDS - 1) * 1000);
    expect(isWithinTrustWindow(cookie, 'sess-1')).toBe(true);

    vi.advanceTimersByTime(2000);
    expect(isWithinTrustWindow(cookie, 'sess-1')).toBe(false);
  });

  it('rejects malformed cookies instead of trusting them', () => {
    // A parse failure must fall through to a real database check. Reading
    // "cannot tell" as "fine" would disable the whole feature the moment
    // the cookie format changed.
    expect(isWithinTrustWindow(undefined, 'sess-1')).toBe(false);
    expect(isWithinTrustWindow('', 'sess-1')).toBe(false);
    expect(isWithinTrustWindow('sess-1', 'sess-1')).toBe(false);
    expect(isWithinTrustWindow('sess-1.not-a-number', 'sess-1')).toBe(false);
    expect(isWithinTrustWindow('.123', 'sess-1')).toBe(false);
  });

  it('handles a session id containing dots', () => {
    // Supabase ids do not today, but splitting on the first dot would
    // silently mis-parse if that ever changed.
    const id = 'sess.with.dots';
    expect(isWithinTrustWindow(trustCookieValue(id), id)).toBe(true);
  });
});
