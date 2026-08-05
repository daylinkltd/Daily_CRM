import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';

export const dynamic = 'force-dynamic';

const LEVELS = ['info', 'warning', 'critical'] as const;

/** GET /api/saas-admin/announcements — every announcement, drafts included. */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;

  const { data, error } = await guard.ctx.admin
    .from('platform_announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data ?? [] });
}

/** POST /api/saas-admin/announcements — create one. */
export async function POST(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, actor, audit } = guard.ctx;

  const body = await request.json().catch(() => ({}));

  const title = String(body.title ?? '').trim();
  const message = String(body.body ?? '').trim();
  if (!title || !message) {
    return NextResponse.json({ error: 'Title and body are required.' }, { status: 400 });
  }

  const level = LEVELS.includes(body.level) ? body.level : 'info';

  const { data, error } = await admin
    .from('platform_announcements')
    .insert({
      title,
      body: message,
      level,
      workspace_ids: Array.isArray(body.workspace_ids) && body.workspace_ids.length
        ? body.workspace_ids
        : null,
      plan_ids: Array.isArray(body.plan_ids) && body.plan_ids.length ? body.plan_ids : null,
      starts_at: body.starts_at || new Date().toISOString(),
      ends_at: body.ends_at || null,
      // Critical notices cannot be dismissed. An outage banner someone
      // clicked away an hour ago is the same as no banner.
      dismissible: level === 'critical' ? false : body.dismissible !== false,
      link_url: body.link_url || null,
      link_label: body.link_label || null,
      published: body.published === true,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    action: 'announcement.created',
    targetType: 'announcement',
    targetId: data.id,
    details: { title, level, published: data.published },
  });

  return NextResponse.json({ announcement: data });
}

/** PATCH /api/saas-admin/announcements — publish, unpublish or edit. */
export async function PATCH(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, audit } = guard.ctx;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.published === 'boolean') patch.published = body.published;
  if (typeof body.title === 'string') patch.title = body.title.trim();
  if (typeof body.body === 'string') patch.body = body.body.trim();
  if (LEVELS.includes(body.level)) patch.level = body.level;
  if (body.ends_at !== undefined) patch.ends_at = body.ends_at || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('platform_announcements')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    action: 'announcement.updated',
    targetType: 'announcement',
    targetId: id,
    details: patch,
  });

  return NextResponse.json({ announcement: data });
}

/** DELETE /api/saas-admin/announcements?id= */
export async function DELETE(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, audit } = guard.ctx;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data: before } = await admin
    .from('platform_announcements')
    .select('title, level')
    .eq('id', id)
    .maybeSingle();

  const { error } = await admin.from('platform_announcements').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    action: 'announcement.deleted',
    targetType: 'announcement',
    targetId: id,
    details: before ?? {},
  });

  return NextResponse.json({ ok: true });
}
