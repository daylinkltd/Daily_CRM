// ============================================================
// POST /api/auth/reset-request  { email }
//
// Send a password-reset link from the PLATFORM mailbox.
//
// This replaces `supabase.auth.resetPasswordForEmail` on the client.
// That call asks Supabase to compose and send the mail, which meant two
// problems we could not fix from the app: the link's destination came
// from the project's "Site URL" dashboard setting (which still said
// localhost), and the message itself was Supabase's, not ours.
//
// `generateLink` MINTS a recovery link without sending anything, so the
// app controls both the redirect and the email. The link still carries
// Supabase's own token, so nothing about the security model changes —
// only who puts it in an envelope.
//
// ALWAYS answers 200. Telling an anonymous caller whether an address
// has an account turns this endpoint into a membership oracle; the
// user sees the same "check your inbox" either way.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendPlatformMail } from '@/lib/platform/mailer';
import { appRecoveryLink, recoveryRedirectUrl } from '@/lib/auth/passwords';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { BRAND } from '@/config/brand';

const SAME_ANSWER = {
  ok: true,
  message: 'If that email has an account, a reset link is on its way.',
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  // Keyed on the address, so one mailbox cannot be flooded with reset
  // mail by someone who merely knows it exists.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = checkRateLimit(`auth:resetRequest:${email}:${ip}`, RATE_LIMITS.adminAction);
  if (!limit.success) return rateLimitResponse(limit);

  const admin = createAdminClient();

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: recoveryRedirectUrl(request) },
    });

    // No account for that address: say nothing, answer the same.
    if (error || !data?.properties?.hashed_token) {
      return NextResponse.json(SAME_ANSWER);
    }

    const link = appRecoveryLink(request, data.properties.hashed_token);
    const sent = await sendPlatformMail({
      to: email,
      kind: 'password_reset',
      subject: `Reset your ${BRAND.name} password`,
      body: `
        <p>Someone asked to reset the password for this ${BRAND.name} account.</p>
        <p style="margin:24px 0;">
          <a href="${link}"
             style="display:inline-block;padding:12px 22px;background:#0f172a;color:#ffffff;
                    text-decoration:none;border-radius:10px;font-weight:600;">
            Choose a new password
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">
          The link works once and expires shortly. If you did not ask for
          this, ignore this email — your password stays as it is.
        </p>`,
    });

    if (!sent.ok) {
      // A configuration problem is worth surfacing: silently pretending
      // to send would leave the user waiting for mail that never comes.
      console.error('[reset-request] send failed:', sent.error);
      return NextResponse.json(
        {
          error: sent.notConfigured
            ? 'Password reset email is not configured yet. Contact your administrator.'
            : 'Could not send the reset email. Try again shortly.',
        },
        { status: 503 },
      );
    }

    return NextResponse.json(SAME_ANSWER);
  } catch (err) {
    console.error('[reset-request] unexpected:', err);
    return NextResponse.json(SAME_ANSWER);
  }
}
