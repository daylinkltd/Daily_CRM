import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';

export const dynamic = 'force-dynamic';

const CHANNELS = ['email', 'whatsapp', 'sms'] as const;

/** POST /api/saas-admin/messaging/templates — create. */
export async function POST(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, actor, audit } = guard.ctx;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const channel = body.channel;
  const content = String(body.body ?? '').trim();

  if (!name || !content || !CHANNELS.includes(channel)) {
    return NextResponse.json(
      { error: 'name, channel (email|whatsapp|sms) and body are required' },
      { status: 400 },
    );
  }
  if (channel === 'email' && !String(body.subject ?? '').trim()) {
    return NextResponse.json({ error: 'Email templates need a subject.' }, { status: 400 });
  }
  if (channel === 'whatsapp' && !String(body.meta_template_name ?? '').trim()) {
    return NextResponse.json(
      {
        error:
          'WhatsApp templates must name their Meta-approved template — Meta rejects business-initiated free text.',
      },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from('platform_message_templates')
    .insert({
      name,
      channel,
      subject: body.subject ?? null,
      body: content,
      meta_template_name: body.meta_template_name ?? null,
      meta_template_language: body.meta_template_language || 'en',
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    action: 'messaging.template_created',
    targetType: 'template',
    targetId: data.id,
    details: { name, channel },
  });
  return NextResponse.json({ template: data });
}

/** DELETE /api/saas-admin/messaging/templates?id= */
export async function DELETE(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, audit } = guard.ctx;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data: before } = await admin
    .from('platform_message_templates')
    .select('name, channel')
    .eq('id', id)
    .maybeSingle();

  // Sent history keeps its rendered copies; ON DELETE SET NULL on the
  // log's template_id means deleting a template never orphans evidence.
  const { error } = await admin.from('platform_message_templates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    action: 'messaging.template_deleted',
    targetType: 'template',
    targetId: id,
    details: before ?? {},
  });
  return NextResponse.json({ ok: true });
}
