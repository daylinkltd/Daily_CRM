// ============================================================
// Self-serve signup WITHOUT email confirmation.
//
// `supabase.auth.signUp()` leaves the account unconfirmed and mails a
// verification link, whose destination is Supabase's dashboard
// "Site URL" — which is how signups ended up with dead
// http://localhost:3000 links. Creating the user here with
// `email_confirm: true` means Supabase sends nothing at all and the
// account is usable the instant it exists; the client signs in with
// the password it just set and goes straight to the app (or to the
// invite's /join page).
//
// This is a PUBLIC endpoint that uses the service role, so it is
// deliberately narrow: it only ever creates a plain auth user. It
// cannot set roles, workspaces or membership — joining a workspace
// still goes through the invite redeem path, which does its own
// checks. Rate limited per IP, since it is the only brake on
// automated account creation.
// ============================================================

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export async function POST(request: Request) {
  const limit = checkRateLimit(`signup:${getClientIp(request)}`, RATE_LIMITS.signup);
  if (!limit.success) return rateLimitResponse(limit);

  let body: {
    email?: string;
    password?: string;
    full_name?: string;
    invite_token?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim();
  const inviteToken = (body.invite_token ?? "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD} characters` },
      { status: 400 },
    );
  }
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    // The whole point: no confirmation email, account usable now.
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      // Carried on the auth user so the join guards can find it even
      // in a different tab or on another device.
      ...(inviteToken ? { invite_token: inviteToken } : {}),
    },
  });

  if (error) {
    // Supabase reports an existing address as "already been registered"
    // / 422. Point them at sign-in rather than showing a raw error.
    if (/already|registered|exists/i.test(error.message)) {
      return NextResponse.json(
        { error: "An account with that email already exists — try signing in instead." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, user_id: data.user?.id ?? null });
}
