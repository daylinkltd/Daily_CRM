import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/** GET /api/saas-admin/users/list?q=&status=&page= */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0) || 0);

  let query = admin
    .from('profiles')
    .select('id, user_id, full_name, email, status, system_role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (status) query = query.eq('status', status);
  if (q) {
    const safe = q.replace(/[,()]/g, ' ');
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (data ?? []).map((p) => p.user_id).filter(Boolean);

  // Which workspaces each user belongs to, and whether they are signed in
  // right now — both answered in one round trip each rather than per row.
  const [memberships, sessions] = await Promise.all([
    userIds.length
      ? admin
          .from('workspace_members')
          .select('user_id, role, workspaces(id, name)')
          .in('user_id', userIds)
      : Promise.resolve({ data: [] as never[] }),
    userIds.length
      ? admin
          .from('user_sessions')
          .select('user_id, last_seen_at, user_agent')
          .eq('status', 'active')
          .in('user_id', userIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  // The embedded relation types as an array in the generated types even
  // though it is a to-one join, so normalise rather than fight it.
  type MemberRow = {
    user_id: string;
    role: string;
    workspaces: { id: string; name: string } | { id: string; name: string }[] | null;
  };

  const byUser: Record<string, { id: string; name: string; role: string }[]> = {};
  for (const m of (memberships.data ?? []) as unknown as MemberRow[]) {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    if (!ws) continue;
    (byUser[m.user_id] ??= []).push({ id: ws.id, name: ws.name, role: m.role });
  }

  const sessionByUser: Record<string, { last_seen_at: string; user_agent: string | null }> = {};
  for (const s of (sessions.data ?? []) as unknown as {
    user_id: string;
    last_seen_at: string;
    user_agent: string | null;
  }[]) {
    sessionByUser[s.user_id] = { last_seen_at: s.last_seen_at, user_agent: s.user_agent };
  }

  return NextResponse.json({
    users: (data ?? []).map((p) => ({
      ...p,
      workspaces: byUser[p.user_id] ?? [],
      activeSession: sessionByUser[p.user_id] ?? null,
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}
