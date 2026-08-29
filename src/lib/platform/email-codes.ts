// ============================================================
// One-time codes sent to a mailbox — the primitive behind two-factor
// sign-in, email verification, and any step-up check.
//
// Design notes that matter:
//
//   • Only a SHA-256 hash is stored, so a database leak does not hand
//     anyone a working code.
//   • Attempts are counted in the row, not in memory: the app runs as
//     several instances, and an in-process counter would let someone
//     spread guesses across workers without ever tripping a limit.
//   • Verification is constant-time on the hash, and a wrong code
//     consumes an attempt rather than silently retrying.
//   • Issuing a new code invalidates the previous one for that mailbox
//     and purpose, so a phished older code cannot be replayed after the
//     user asks for a fresh one.
// ============================================================

import { createHash, randomInt, timingSafeEqual } from 'crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendPlatformMail } from '@/lib/platform/mailer';
import { BRAND } from '@/config/brand';

export type CodePurpose = 'login_2fa' | 'verify_email' | 'step_up';

/** Six digits: long enough against guessing given 5 attempts, short
 *  enough to read off a phone without a second glance. */
const CODE_LENGTH = 6;
const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** Codes issued to one mailbox within the window, before we refuse. */
const MAX_PER_WINDOW = 5;
const WINDOW_MINUTES = 15;

export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  // randomInt is CSPRNG-backed; Math.random is not, and a predictable
  // sign-in code is the same as no code.
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += String(randomInt(0, 10));
  return out;
}

const PURPOSE_COPY: Record<CodePurpose, { subject: string; lead: string }> = {
  login_2fa: {
    subject: `Your ${BRAND.name} sign-in code`,
    lead: 'Use this code to finish signing in.',
  },
  verify_email: {
    subject: `Confirm your email for ${BRAND.name}`,
    lead: 'Use this code to confirm this is your email address.',
  },
  step_up: {
    subject: `Confirm it is you — ${BRAND.name}`,
    lead: 'Use this code to confirm the action you just started.',
  },
};

export interface IssueResult {
  ok: boolean;
  error?: string;
  /** Set when the mailbox has asked for too many codes too quickly. */
  rateLimited?: boolean;
}

/**
 * Mint a code, store its hash, and email it.
 *
 * The code itself is never returned — the only way to learn it is to
 * read the mailbox, which is the entire point.
 */
export async function issueEmailCode(args: {
  email: string;
  purpose: CodePurpose;
  userId?: string | null;
  ip?: string | null;
}): Promise<IssueResult> {
  const email = args.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'A valid email address is required.' };
  }

  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const { count } = await admin
    .from('platform_email_codes')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .eq('purpose', args.purpose)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= MAX_PER_WINDOW) {
    return {
      ok: false,
      rateLimited: true,
      error: 'Too many codes requested. Wait a few minutes and try again.',
    };
  }

  // Retire anything still outstanding: only the newest code should work.
  await admin
    .from('platform_email_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email', email)
    .eq('purpose', args.purpose)
    .is('consumed_at', null);

  const code = generateCode();
  const { error } = await admin.from('platform_email_codes').insert({
    email,
    user_id: args.userId ?? null,
    purpose: args.purpose,
    code_hash: hashCode(code),
    max_attempts: MAX_ATTEMPTS,
    expires_at: new Date(Date.now() + TTL_MINUTES * 60_000).toISOString(),
    created_ip: args.ip ?? null,
  });
  if (error) return { ok: false, error: 'Could not create a code right now.' };

  const copy = PURPOSE_COPY[args.purpose];
  const sent = await sendPlatformMail({
    to: email,
    kind: args.purpose === 'login_2fa' ? 'login_code' : 'verification',
    subject: copy.subject,
    body: `
      <p>${copy.lead}</p>
      <p style="margin:24px 0;text-align:center;">
        <span style="display:inline-block;padding:14px 24px;background:#0f172a;color:#ffffff;
                     font-size:28px;letter-spacing:8px;font-weight:700;border-radius:10px;">
          ${code}
        </span>
      </p>
      <p style="color:#64748b;font-size:13px;">
        It expires in ${TTL_MINUTES} minutes and can be used once.
        If you did not ask for it, someone may have your password —
        change it.
      </p>`,
  });

  if (!sent.ok) {
    // The stored code is useless if it never reached anyone; retire it
    // so it does not occupy the mailbox's rate-limit budget.
    await admin
      .from('platform_email_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('email', email)
      .eq('purpose', args.purpose)
      .is('consumed_at', null);
    return { ok: false, error: sent.error ?? 'Could not send the code.' };
  }

  return { ok: true };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  /** The account the code was issued for, when it was tied to one. */
  userId?: string | null;
}

/** Check a code, spending one attempt whether or not it matches. */
export async function verifyEmailCode(args: {
  email: string;
  purpose: CodePurpose;
  code: string;
}): Promise<VerifyResult> {
  const email = args.email.trim().toLowerCase();
  const code = args.code.trim();
  if (!email || !code) return { ok: false, error: 'Enter the code from your email.' };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('platform_email_codes')
    .select('id, code_hash, attempts, max_attempts, expires_at, consumed_at, user_id')
    .eq('email', email)
    .eq('purpose', args.purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Deliberately the same message for "no code", "expired" and "used":
  // distinguishing them tells an attacker which mailboxes are live.
  const STALE = 'That code is not valid. Request a new one.';
  if (!row) return { ok: false, error: STALE };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: STALE };

  if (row.attempts >= row.max_attempts) {
    await admin
      .from('platform_email_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id);
    return { ok: false, error: 'Too many wrong attempts. Request a new code.' };
  }

  const supplied = Buffer.from(hashCode(code), 'hex');
  const stored = Buffer.from(row.code_hash, 'hex');
  const matches =
    supplied.length === stored.length && timingSafeEqual(supplied, stored);

  if (!matches) {
    await admin
      .from('platform_email_codes')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id);
    const left = row.max_attempts - row.attempts - 1;
    return {
      ok: false,
      error: left > 0
        ? `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.`
        : 'Too many wrong attempts. Request a new code.',
    };
  }

  // Single use.
  await admin
    .from('platform_email_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id);

  return { ok: true, userId: row.user_id };
}
