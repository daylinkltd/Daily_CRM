import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One active session per user, enforced in the proxy.
 *
 * The rule the product wants is "signing in somewhere new signs you out
 * everywhere else". The database function `register_session` (migration
 * 100) decides that atomically; this module's job is to find the session
 * id, call it, and not call it more often than necessary.
 *
 * THE WINDOW IS ZERO, DELIBERATELY.
 *
 * There is a throttle mechanism here — a cookie that can vouch for a
 * session for a few seconds and skip the database round trip — and it is
 * switched off. It was set to 30 seconds on the first pass, on the
 * reasoning that this feature only deters casual account sharing.
 *
 * That reasoning was wrong for this product. Seats are the unit we charge
 * by, so "how many people can use this login at once" is not a nicety, it
 * is the price. A 30-second grace period is 30 seconds of two people
 * working on one seat, every time, on every request — which over a
 * working day is not a tail, it is a shared login that mostly works.
 *
 * So every authenticated request is checked. The cost is one indexed
 * primary-key lookup against a table with one row per session, which is
 * the cheapest query shape Postgres has, and it happens in parallel with
 * the auth check that was already there.
 *
 * The constant stays because the trade may look different at a hundred
 * times the traffic. Raising it is a pricing decision, not a performance
 * one, and should be made by someone who knows that.
 *
 * The cookie is not a security boundary and does not need signing: it can
 * only ever shorten a check for a session whose token Supabase already
 * verified. Forging it buys nothing that holding the token does not.
 */

/**
 * How long a verified session is trusted before re-checking.
 * ZERO = check every request. See the note above before changing this.
 */
export const TRUST_WINDOW_SECONDS = 0;

export const SESSION_COOKIE = 'dbz_sess_ok';

/**
 * The `session_id` claim from a Supabase access token.
 *
 * Decoded without verifying, which is safe here and only here: the proxy
 * has already called `getUser()`, which validates the token against the
 * auth server. Re-verifying the signature in middleware would mean
 * shipping the JWT secret to the edge for no gain.
 */
export function sessionIdFromToken(accessToken: string | undefined): string | null {
  if (!accessToken) return null;
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '='));
    const claims = JSON.parse(json) as { session_id?: string };
    return typeof claims.session_id === 'string' && claims.session_id ? claims.session_id : null;
  } catch {
    return null;
  }
}

/** Cookie value for a session that has just passed. */
export function trustCookieValue(sessionId: string): string {
  return `${sessionId}.${Date.now() + TRUST_WINDOW_SECONDS * 1000}`;
}

/** Whether a previous pass vouched for this exact session, recently. */
export function isWithinTrustWindow(
  cookieValue: string | undefined,
  sessionId: string,
): boolean {
  // Short-circuit at zero so the strict setting cannot be defeated by a
  // cookie minted while the window was still open.
  if (TRUST_WINDOW_SECONDS <= 0) return false;
  if (!cookieValue) return false;

  // rsplit on the last dot: session ids do not contain dots today, but
  // splitting from the right survives it if that ever changes.
  const cut = cookieValue.lastIndexOf('.');
  if (cut < 1) return false;

  const seen = cookieValue.slice(0, cut);
  const expiresAt = Number(cookieValue.slice(cut + 1));

  if (seen !== sessionId) return false;
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export type SessionVerdict = 'active' | 'revoked' | 'unknown';

/**
 * Ask the database whether this session is still the active one.
 *
 * Returns 'unknown' on any failure. FAILING OPEN IS DELIBERATE: a database
 * hiccup must not log every user out of a product they are working in. The
 * downside is bounded — an unenforced extra session — while the upside of
 * failing closed would be a total outage triggered by a transient error.
 */
export async function verifySession(
  supabase: SupabaseClient,
  sessionId: string,
  userAgent: string | null,
  ipAddress: string | null,
): Promise<SessionVerdict> {
  try {
    const { data, error } = await supabase.rpc('register_session', {
      p_session_id: sessionId,
      p_user_agent: userAgent,
      p_ip_address: ipAddress,
    });

    if (error) {
      console.error('[session-guard] register_session failed:', error.message);
      return 'unknown';
    }
    return data === 'revoked' ? 'revoked' : data === 'active' ? 'active' : 'unknown';
  } catch (err) {
    console.error(
      '[session-guard] register_session threw:',
      err instanceof Error ? err.message : err,
    );
    return 'unknown';
  }
}
