import { subscribeWabaToApp } from './meta-api'

/**
 * The public webhook callback URL for this deployment. Meta delivers
 * inbound messages + status events here once the WABA subscription is
 * pinned via override_callback_uri.
 */
export function getWebhookCallbackUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://dailycrm.cloud')
    .trim()
    .replace(/\/+$/, '')
  return `${base}/api/whatsapp/webhook`
}

export interface EnsureWabaSubscribedArgs {
  wabaId: string
  accessToken: string
  /** The workspace's (decrypted) webhook verify token, if one exists. */
  verifyToken?: string | null
}

export interface EnsureWabaSubscribedResult {
  subscribed: boolean
  /**
   * `override_callback` — inbound events are pinned to THIS deployment's
   *   /api/whatsapp/webhook regardless of the Meta App dashboard config.
   * `app_default` — subscription exists but events go to whatever
   *   callback URL is configured on the Meta App dashboard. Inbound only
   *   works if that dashboard URL points at this deployment.
   */
  mode: 'override_callback' | 'app_default' | 'failed'
  error?: string
}

/**
 * Subscribe a WABA to this Meta app, preferring an override callback
 * URI so inbound webhook delivery is pinned to this deployment.
 *
 * Why this matters: POST /{waba_id}/subscribed_apps without an
 * override routes events to the app-dashboard callback URL. If that
 * dashboard field was never configured (or points at a stale tunnel /
 * another environment), the CRM receives NO inbound messages even
 * though sending works fine — the exact "outbound OK, inbound silent"
 * failure mode. The override subscription removes the dashboard as a
 * point of failure.
 *
 * Meta verifies the override URI with a GET hub.challenge using the
 * verify token at subscribe time, so the config row (and its
 * verify_token) must already be saved before calling this.
 */
export async function ensureWabaSubscribed(
  args: EnsureWabaSubscribedArgs
): Promise<EnsureWabaSubscribedResult> {
  const { wabaId, accessToken, verifyToken } = args

  if (verifyToken) {
    try {
      await subscribeWabaToApp({
        wabaId,
        accessToken,
        overrideCallbackUri: getWebhookCallbackUrl(),
        verifyToken,
      })
      return { subscribed: true, mode: 'override_callback' }
    } catch (err) {
      console.warn(
        '[whatsapp] override-callback subscription failed, falling back to app-default:',
        err instanceof Error ? err.message : err
      )
    }
  }

  try {
    await subscribeWabaToApp({ wabaId, accessToken })
    return { subscribed: true, mode: 'app_default' }
  } catch (err) {
    return {
      subscribed: false,
      mode: 'failed',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
