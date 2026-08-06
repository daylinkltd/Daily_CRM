import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';
import { normalizeCouponCode } from '@/lib/billing/coupons';
import { PLANS } from '@/config/plans';

export const dynamic = 'force-dynamic';

/** GET /api/saas-admin/coupons — all coupons with their redemption totals. */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;

  const [coupons, redemptions] = await Promise.all([
    admin.from('coupons').select('*').order('created_at', { ascending: false }),
    admin.from('coupon_redemptions').select('coupon_id, discount_paise'),
  ]);

  if (coupons.error) return NextResponse.json({ error: coupons.error.message }, { status: 500 });

  const saved: Record<string, number> = {};
  for (const r of redemptions.data ?? []) {
    saved[r.coupon_id] = (saved[r.coupon_id] ?? 0) + r.discount_paise;
  }

  return NextResponse.json({
    coupons: (coupons.data ?? []).map((c) => ({
      ...c,
      total_discount_paise: saved[c.id] ?? 0,
    })),
  });
}

/** POST /api/saas-admin/coupons — create one. */
export async function POST(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, actor, audit } = guard.ctx;

  const body = await request.json().catch(() => ({}));

  const code = normalizeCouponCode(body.code);
  if (!code) {
    return NextResponse.json(
      { error: 'Code must be 3–32 characters: letters, numbers, - or _.' },
      { status: 400 },
    );
  }

  const percentOff = Number(body.percent_off);
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) {
    return NextResponse.json(
      { error: 'percent_off must be a whole number between 1 and 100.' },
      { status: 400 },
    );
  }

  if (body.plan_id && !PLANS.some((p) => p.id === body.plan_id)) {
    return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
  }

  const maxRedemptions =
    body.max_redemptions === null || body.max_redemptions === undefined || body.max_redemptions === ''
      ? null
      : Number(body.max_redemptions);
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
    return NextResponse.json({ error: 'max_redemptions must be a positive whole number.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('coupons')
    .insert({
      code,
      description: body.description || null,
      percent_off: percentOff,
      plan_id: body.plan_id || null,
      max_redemptions: maxRedemptions,
      valid_until: body.valid_until || null,
      active: body.active !== false,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) {
    const message = error.code === '23505' ? `The code ${code} already exists.` : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await audit({
    action: 'coupon.created',
    targetType: 'coupon',
    targetId: data.id,
    details: { code, percent_off: percentOff, max_redemptions: maxRedemptions },
  });

  return NextResponse.json({ coupon: data });
}

/**
 * PATCH /api/saas-admin/coupons — activate/deactivate.
 *
 * Deliberately not editable beyond that: changing a live coupon's percent
 * rewrites the terms of orders already in flight between checkout and
 * verification. Deactivate and issue a new code instead.
 */
export async function PATCH(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin, audit } = guard.ctx;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '');
  if (!id || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'id and active are required' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('coupons')
    .update({ active: body.active })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    action: body.active ? 'coupon.activated' : 'coupon.deactivated',
    targetType: 'coupon',
    targetId: id,
    details: { code: data.code },
  });

  return NextResponse.json({ coupon: data });
}
