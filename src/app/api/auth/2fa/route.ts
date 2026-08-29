// ============================================================
// GET    /api/auth/2fa   — is it on for me?
// POST   /api/auth/2fa   — { code } turn it on, or {} to send the code
// DELETE /api/auth/2fa   — turn it off
// PUT    /api/auth/2fa   — { code } answer the challenge for this session
//
// Email two-factor. Enabling is deliberately two steps: we send a code
// first and only switch it on once you have answered one. Trusting the
// toggle alone would let someone lock themselves out of their own
// account with a typo'd address or a mailbox they cannot reach.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { issueEmailCode, verifyEmailCode } from '@/lib/platform/email-codes';
import { sessionIdFromToken } from '@/lib/auth/session-guard';
import { ACTIVITY, logActivity } from '@/lib/saas-admin/activity';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

async function currentUser() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  return { supabase, user };
}

export async function GET() {
  const ctx = await currentUser();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('two_factor_enabled, two_factor_enabled_at')
    .eq('user_id', ctx.user.id)
    .maybeSingle();

  return NextResponse.json({
    enabled: Boolean(data?.two_factor_enabled),
    enabledAt: data?.two_factor_enabled_at ?? null,
    email: ctx.user.email,
  });
}

/** No code: send one. With a code: verify it and switch 2FA on. */
export async function POST(request: NextRequest) {
  const ctx = await currentUser();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = checkRateLimit(`auth:2fa:${ctx.user.id}`, RATE_LIMITS.adminAction);
  if (!limit.success) return rateLimitResponse(limit);

  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? '').trim();
  const email = ctx.user.email!;

  if (!code) {
    const sent = await issueEmailCode({
      email,
      purpose: 'verify_email',
      userId: ctx.user.id,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: sent.rateLimited ? 429 : 502 });
    }
    return NextResponse.json({ ok: true, sent: true, to: email });
  }

  const verified = await verifyEmailCode({ email, purpose: 'verify_email', code });
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({
      two_factor_enabled: true,
      two_factor_enabled_at: new Date().toISOString(),
    })
    .eq('user_id', ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // This session just proved the mailbox, so it should not be
  // challenged again the moment 2FA switches on.
  const { data: { session } } = await ctx.supabase.auth.getSession();
  const sessionId = sessionIdFromToken(session?.access_token);
  if (sessionId) {
    await ctx.supabase.rpc('mark_session_two_factor_verified', { p_session_id: sessionId });
  }

  await logActivity({
    event: ACTIVITY.TWO_FACTOR_ENABLED,
    userId: ctx.user.id,
    userEmail: email,
    request,
  });

  return NextResponse.json({ ok: true, enabled: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await currentUser();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ two_factor_enabled: false, two_factor_enabled_at: null })
    .eq('user_id', ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    event: ACTIVITY.TWO_FACTOR_DISABLED,
    severity: 'warning',
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    request,
  });

  return NextResponse.json({ ok: true, enabled: false });
}

/** Answer the sign-in challenge for THIS session. */
export async function PUT(request: NextRequest) {
  const ctx = await currentUser();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = checkRateLimit(`auth:2faChallenge:${ctx.user.id}`, RATE_LIMITS.adminAction);
  if (!limit.success) return rateLimitResponse(limit);

  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? '').trim();
  const email = ctx.user.email!;

  if (!code) {
    const sent = await issueEmailCode({
      email,
      purpose: 'login_2fa',
      userId: ctx.user.id,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: sent.rateLimited ? 429 : 502 });
    }
    return NextResponse.json({ ok: true, sent: true });
  }

  const verified = await verifyEmailCode({ email, purpose: 'login_2fa', code });
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });

  const { data: { session } } = await ctx.supabase.auth.getSession();
  const sessionId = sessionIdFromToken(session?.access_token);
  if (!sessionId) {
    return NextResponse.json({ error: 'No active session to verify.' }, { status: 400 });
  }

  const { data: marked } = await ctx.supabase.rpc('mark_session_two_factor_verified', {
    p_session_id: sessionId,
  });
  if (!marked) {
    return NextResponse.json(
      { error: 'This session is no longer active. Sign in again.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, verified: true });
}
