// ============================================================
// GET /auth/callback — where every Supabase auth email lands.
//
// Password-recovery, magic-link and email-change links all point here
// (via each flow's `redirectTo`). This route did not exist for a long
// time, which is half of the "reset emails go to localhost" bug: with
// no valid in-app target, flows leaned on the Supabase project's Site
// URL — which was still http://localhost:3000. The other half is
// dashboard config (Authentication → URL Configuration), which code
// cannot fix; this route makes the app side correct.
//
// Two link styles are handled because Supabase emits both depending on
// client flow and email template vintage:
//   • PKCE:      ?code=<uuid>            → exchangeCodeForSession
//   • token_hash: ?token_hash=…&type=…   → verifyOtp
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/** Only same-origin path targets — an absolute or //host `next` would
 *  turn this endpoint into an open redirect. */
function safeNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Behind Coolify/Cloudflare `request.url` can carry the internal
  // host; the forwarded headers name the address the user is actually
  // browsing. Fall back to the request origin for bare deployments.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const origin = forwardedHost
    ? `${forwardedProto || "https"}://${forwardedHost}`
    : new URL(request.url).origin;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), "/dashboard");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] code exchange failed:", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // A recovery link must land on the reset form even when the
      // template forgot to carry ?next.
      const target = type === "recovery" && next === "/dashboard" ? "/reset-password" : next;
      return NextResponse.redirect(`${origin}${target}`);
    }
    console.error("[auth/callback] verifyOtp failed:", error.message);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "That link is invalid or has expired. Request a new one.",
    )}`,
  );
}
