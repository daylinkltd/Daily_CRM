import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from 'process'

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page') ?? '1')
  const limit = Number(url.searchParams.get('limit') ?? '20')
  const from = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('webhook_debug_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ rows: data, total: count, page, limit })
}
