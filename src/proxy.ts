import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import {
  SESSION_COOKIE,
  TRUST_WINDOW_SECONDS,
  isWithinTrustWindow,
  sessionIdFromToken,
  trustCookieValue,
  verifySession,
} from '@/lib/auth/session-guard'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // getUser() transparently refreshes an expired access token, which
  // ROTATES the refresh token and writes new cookies onto `supabaseResponse`
  // via setAll() above. Any response we return in place of `supabaseResponse`
  // does NOT carry those Set-Cookie headers, so we must copy them explicitly.
  const withRefreshedCookies = <T extends NextResponse>(response: T): T => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  // ------------------------------------------------------------------
  // One active session per user.
  //
  // Runs before the routing rules below so a displaced device is signed
  // out wherever it lands, not only on protected pages — otherwise the
  // "already logged in, go to /dashboard" redirect above would bounce a
  // revoked session straight back into the app.
  // ------------------------------------------------------------------
  if (user) {
    const { data: { session } } = await supabase.auth.getSession()
    const sessionId = sessionIdFromToken(session?.access_token)

    if (sessionId && !isWithinTrustWindow(request.cookies.get(SESSION_COOKIE)?.value, sessionId)) {
      const verdict = await verifySession(
        supabase,
        sessionId,
        request.headers.get('user-agent'),
        // Behind Coolify/Cloudflare the socket address is the proxy, so
        // the forwarded header is the only real client address available.
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      )

      if (verdict === 'revoked') {
        await supabase.auth.signOut()

        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.search = '?reason=signed-in-elsewhere'

        const response = NextResponse.redirect(url)
        // signOut() clears the auth cookies on `supabaseResponse`; copy
        // those onto the redirect or the browser keeps the dead session
        // and loops between /login and /dashboard.
        withRefreshedCookies(response)
        response.cookies.delete(SESSION_COOKIE)
        return response
      }

      // Two-factor is on for this account and this session has not
      // answered its code. Everything stays reachable EXCEPT the app
      // itself, so the challenge page and its API can still load.
      if (verdict === 'needs_2fa') {
        const path = request.nextUrl.pathname
        const allowed =
          path.startsWith('/auth/2fa') ||
          path.startsWith('/api/auth/') ||
          path === '/login' ||
          path.startsWith('/_next')

        if (!allowed) {
          const url = request.nextUrl.clone()
          url.pathname = '/auth/2fa'
          url.search = ''
          return withRefreshedCookies(NextResponse.redirect(url))
        }
        return supabaseResponse
      }

      if (verdict === 'active') {
        supabaseResponse.cookies.set(SESSION_COOKIE, trustCookieValue(sessionId), {
          maxAge: TRUST_WINDOW_SECONDS,
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
        })
      }
      // 'unknown' writes no cookie, so the next request retries rather
      // than trusting a check that never completed.
    }
  }

  // Auth pages — redirect to dashboard if already logged in.
  if (user && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup' ||
    request.nextUrl.pathname === '/forgot-password'
  )) {
    const url = request.nextUrl.clone()
    // An authenticated user following an invite link must keep the
    // invite intent. Previously `url.search = ''` silently dropped
    // `?invite=<token>` and bounced them to /dashboard, which (with
    // no workspace yet) forwarded them into onboarding/plan
    // selection instead of the workspace-join confirmation.
    const inviteToken = request.nextUrl.searchParams.get('invite')
    if (inviteToken) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`
    } else {
      url.pathname = '/dashboard'
    }
    url.search = ''
    return withRefreshedCookies(NextResponse.redirect(url))
  }

  // Protected pages — redirect to login if not authenticated.
  const protectedPaths = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/settings', '/media', '/docs', '/integrations']
  if (!user && protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return withRefreshedCookies(NextResponse.redirect(url))
  }

  // API routes that need auth (not webhooks)
  if (!user && request.nextUrl.pathname.startsWith('/api/whatsapp/') &&
      !request.nextUrl.pathname.includes('/webhook')) {
    return withRefreshedCookies(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
