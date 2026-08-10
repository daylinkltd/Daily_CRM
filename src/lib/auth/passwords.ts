// Shared helpers for the two admin-sets-a-password surfaces (workspace
// members tab, SaaS console) so both generate the same shape of
// credential and derive the same public origin for reset links.

import { randomInt } from "crypto";

// No 0/O/1/l/I — these passwords get read out loud and typed from a
// phone screen. Four classes guaranteed so common strength policies pass.
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGIT = "23456789";
const SYMBOL = "!@#$%&*+-=?";
const ALL = LOWER + UPPER + DIGIT + SYMBOL;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72; // bcrypt truncation boundary

export function generatePassword(length = 14): string {
  const chars: string[] = [
    LOWER[randomInt(LOWER.length)],
    UPPER[randomInt(UPPER.length)],
    DIGIT[randomInt(DIGIT.length)],
    SYMBOL[randomInt(SYMBOL.length)],
  ];
  while (chars.length < length) chars.push(ALL[randomInt(ALL.length)]);
  // Fisher–Yates so the guaranteed classes aren't always the first four.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function validateNewPassword(raw: unknown): { ok: true; password: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (raw.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` };
  }
  return { ok: true, password: raw };
}

/**
 * The origin the user is actually browsing, for building `redirectTo`
 * on Supabase auth emails. Forwarded headers first (Coolify/Cloudflare
 * rewrite them), then the request's own origin for bare deployments.
 */
export function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) return `${forwardedProto || "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

/** Where recovery emails should land: the callback that exchanges the
 *  code, then the reset form. */
export function recoveryRedirectUrl(request: Request): string {
  return `${requestOrigin(request)}/auth/callback?next=/reset-password`;
}
