import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

/**
 * GET /api/saas-admin/logs?source=activity|audit&q=&severity=&page=
 *
 * Both logs behind one endpoint because the console shows them in one
 * screen with a toggle, and they answer two halves of the same question:
 * `audit` is what an administrator did, `activity` is what the system did.
 *
 * Admin-only, like everything under /api/saas-admin. Worth stating twice:
 * these rows span every tenant, so this is the single most sensitive read
 * in the application.
 */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;

  const url = new URL(request.url);
  const source = url.searchParams.get('source') === 'audit' ? 'audit' : 'activity';
  const q = (url.searchParams.get('q') ?? '').trim().replace(/[,()]/g, ' ');
  const severity = url.searchParams.get('severity') ?? '';
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0) || 0);
  const range: [number, number] = [page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1];

  if (source === 'audit') {
    let query = admin
      .from('saas_admin_audit')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(...range);

    if (q) query = query.or(`action.ilike.%${q}%,actor_email.ilike.%${q}%,target_id.ilike.%${q}%`);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ source, rows: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE });
  }

  let query = admin
    .from('platform_activity_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(...range);

  if (severity) query = query.eq('severity', severity);
  if (q) query = query.or(`event.ilike.%${q}%,user_email.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source, rows: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE });
}
