import { createClient } from '@/lib/supabase/server'

/**
 * Auth gate for the /api/admin/* diagnostic endpoints.
 *
 * These routes run with the service-role client and expose
 * cross-tenant data (recent messages, config metadata, webhook logs)
 * and mutations (phone registration, simulated inbound messages), so
 * they must never be reachable anonymously.
 *
 * Two ways in:
 *   1. A logged-in dashboard session (Supabase auth cookie) — covers
 *      browsing the endpoint while signed in to the CRM.
 *   2. `x-admin-token` header (or `?admin_token=` query param)
 *      matching the ADMIN_DIAG_TOKEN env var — covers curl/monitoring
 *      use without a browser session.
 */
export async function isAuthorizedAdminRequest(
  request: Request
): Promise<boolean> {
  const configured = process.env.ADMIN_DIAG_TOKEN
  if (configured) {
    const url = new URL(request.url)
    const presented =
      request.headers.get('x-admin-token') ||
      url.searchParams.get('admin_token')
    if (presented && presented === configured) return true
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return Boolean(user)
  } catch {
    return false
  }
}
