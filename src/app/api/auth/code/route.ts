// ============================================================
// POST /api/auth/code   { email, purpose }          — send a code
// PUT  /api/auth/code   { email, purpose, code }    — check a code
//
// The mailbox-ownership check behind two-factor sign-in, email
// verification and step-up confirmation. The code itself only ever
// exists in the email; this endpoint stores a hash (see
// lib/platform/email-codes).
//
// Both verbs answer the same shape whatever the outcome, and neither
// reveals whether an address has an account — an endpoint that says
// "no such user" is a membership oracle for anyone with a word list.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import {
  issueEmailCode,
  verifyEmailCode,
  type CodePurpose,
} from '@/lib/platform/email-codes';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

const PURPOSES: CodePurpose[] = ['login_2fa', 'verify_email', 'step_up'];

function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const purpose = String(body.purpose ?? 'verify_email') as CodePurpose;

  if (!PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: 'Unknown purpose.' }, { status: 400 });
  }

  const ip = clientIp(request);
  const limit = checkRateLimit(`auth:code:${email}:${ip}`, RATE_LIMITS.adminAction);
  if (!limit.success) return rateLimitResponse(limit);

  // Tie the code to an account when one exists, so verification can
  // hand the caller a user id. Absence is not reported.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();

  const result = await issueEmailCode({
    email,
    purpose,
    userId: profile?.user_id ?? null,
    ip,
  });

  // A missing mailbox configuration is the operator's problem and must
  // be visible; everything else answers uniformly.
  if (!result.ok && !result.rateLimited && result.error?.includes('not configured')) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }
  if (result.rateLimited) {
    return NextResponse.json({ error: result.error }, { status: 429 });
  }

  return NextResponse.json({
    ok: true,
    message: 'If that email can receive mail, a code is on its way.',
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const code = String(body.code ?? '').trim();
  const purpose = String(body.purpose ?? 'verify_email') as CodePurpose;

  if (!PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: 'Unknown purpose.' }, { status: 400 });
  }

  const limit = checkRateLimit(
    `auth:codeVerify:${email}:${clientIp(request)}`,
    RATE_LIMITS.adminAction,
  );
  if (!limit.success) return rateLimitResponse(limit);

  const result = await verifyEmailCode({ email, purpose, code });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user_id: result.userId ?? null });
}
