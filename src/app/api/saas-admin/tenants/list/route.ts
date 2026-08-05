import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/**
 * GET /api/saas-admin/tenants/list?q=&plan=&page=
 *
 * Paginated tenant list. A separate path from the existing
 * /api/saas-admin/tenants, which is a destructive DELETE-everything
 * endpoint — putting a routine read on the same route as "wipe all
 * tenants" is asking for the wrong verb on a bad day.
 */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const plan = url.searchParams.get('plan') ?? '';
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0) || 0);

  let query = admin
    .from('workspaces')
    .select('id, name, plan, plan_limits, created_at, company_email, gstin, state_code', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (plan) query = query.eq('plan', plan);
  if (q) {
    // Escaped: a name containing a comma would otherwise terminate the
    // PostgREST `or` list early and silently widen the filter.
    const safe = q.replace(/[,()]/g, ' ');
    query = query.or(`name.ilike.%${safe}%,company_email.ilike.%${safe}%`);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((w) => w.id);

  // Member counts in one round trip rather than one per tenant.
  const { data: members } = ids.length
    ? await admin.from('workspace_members').select('workspace_id').in('workspace_id', ids)
    : { data: [] as { workspace_id: string }[] };

  const counts: Record<string, number> = {};
  for (const m of members ?? []) counts[m.workspace_id] = (counts[m.workspace_id] ?? 0) + 1;

  return NextResponse.json({
    tenants: (data ?? []).map((w) => ({ ...w, member_count: counts[w.id] ?? 0 })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}
