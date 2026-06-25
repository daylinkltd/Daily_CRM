import { createHash, randomBytes } from "node:crypto";

export const DEFAULT_INVITE_EXPIRY_DAYS = 7;
export const MAX_INVITE_EXPIRY_DAYS = 365;

export interface GeneratedToken {
  token: string;
  hash: string;
}

export function generateInviteToken(): GeneratedToken {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(token: string, baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/join/${token}`;
}

export function inviteExpiresAt(
  expiresInDays: number | undefined,
  now: Date = new Date(),
): Date {
  const days = clampExpiryDays(expiresInDays);
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ms);
}

export function clampExpiryDays(expiresInDays: number | undefined): number {
  if (
    expiresInDays === undefined ||
    !Number.isFinite(expiresInDays) ||
    expiresInDays <= 0
  ) {
    return DEFAULT_INVITE_EXPIRY_DAYS;
  }
  return Math.min(Math.floor(expiresInDays), MAX_INVITE_EXPIRY_DAYS);
}
