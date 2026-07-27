import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { registerPhoneNumber } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { isAuthorizedAdminRequest } from '@/lib/auth/admin-gate'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/admin/register-phone
 * Registers Meta phone numbers to claim the inbound webhook stream.
 */
export async function POST(request: Request) {
  try {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    // Priority: explicit request pin → META_TWO_STEP_PIN env → the
    // account's known two-step verification PIN.
    const pin = body.pin || process.env.META_TWO_STEP_PIN || '792725'

    const supabase = supabaseAdmin()
    const { data: configs, error } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('provider', 'meta')

    if (error || !configs || configs.length === 0) {
      return NextResponse.json({ error: 'No Meta whatsapp_config row found' }, { status: 400 })
    }

    const results = []
    for (const config of configs) {
      if (!config.phone_number_id || !config.access_token) continue
      try {
        const token = decrypt(config.access_token)
        const res = await registerPhoneNumber({
          phoneNumberId: config.phone_number_id,
          accessToken: token,
          pin,
        })
        results.push({ phone_number_id: config.phone_number_id, success: true, result: res })
      } catch (err) {
        results.push({
          phone_number_id: config.phone_number_id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
