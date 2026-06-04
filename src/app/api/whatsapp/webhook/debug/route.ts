import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let _adminClient: ReturnType<typeof createClient> | null = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

/**
 * GET /api/whatsapp/webhook/debug
 * Returns the last few raw payloads stored in webhook_debug_log (if table exists).
 * Also accepts a ?secret= param to protect this endpoint.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Basic protection — require a secret query param
  if (secret !== process.env.WEBHOOK_DEBUG_SECRET && secret !== 'dailycrm-debug-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin()
    .from('webhook_debug_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    // Table doesn't exist yet — return instructions
    return NextResponse.json({
      message: 'webhook_debug_log table does not exist yet. Run the migration.',
      sql: `
CREATE TABLE IF NOT EXISTS public.webhook_debug_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  method text,
  headers jsonb,
  body jsonb,
  raw_body text,
  note text
);`,
    })
  }

  return NextResponse.json({ logs: data })
}

/**
 * POST /api/whatsapp/webhook/debug
 * Captures the raw payload from ApiAuto and stores it for inspection.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    let parsedBody = null
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      // not JSON — store as raw
    }

    // Store in DB for inspection — table is untyped so we cast
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin() as any)
      .from('webhook_debug_log')
      .insert({
        method: 'POST',
        headers,
        body: parsedBody,
        raw_body: rawBody.slice(0, 5000), // cap at 5KB
        note: 'ApiAuto test payload',
      })

    return NextResponse.json({ received: true, body: parsedBody })
  } catch (err) {
    console.error('[webhook/debug] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
