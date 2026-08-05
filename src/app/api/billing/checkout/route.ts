import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

import { createClient } from '@/lib/supabase/server';
import { PLANS, chargeablePaise, type BillingPeriod } from '@/config/plans';
import { encodeHandoff } from '@/lib/payments/handoff';
import { BRAND } from '@/config/brand';

export const dynamic = 'force-dynamic';

/**
 * Start a checkout: create the Razorpay order here, then hand off to the
 * daylink.in hub which actually opens the modal.
 *
 * WHY THE ORDER IS CREATED HERE AND NOT ON THE HUB. Razorpay's
 * authorised-domain restriction applies to the Checkout modal, not the
 * Orders API — so this app can still create the order server-side, with
 * the amount computed from its own plan config and its own seat count.
 * The hub receives an order id whose amount is already fixed and cannot
 * change it. That keeps every pricing decision, and every verification,
 * inside the product that owns the customer.
 *
 * The alternative — letting the hub price things — would make one bug
 * there a mis-charge across every product on the hub. Not worth the
 * convenience.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { workspace_id, plan_id, seats, period } = body;

    if (!workspace_id || !plan_id) {
      return NextResponse.json(
        { error: 'workspace_id and plan_id are required' },
        { status: 400 },
      );
    }

    // Money leaves the company here — admin/owner only, same gate as
    // /api/verify-payment. Without it any member could start a checkout
    // against a workspace they merely belong to.
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Only workspace owners or admins can start a payment' },
        { status: 403 },
      );
    }

    const plan = PLANS.find((p) => p.id === plan_id);
    if (!plan) {
      return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
    }

    const seatCount = Number(seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 10_000) {
      return NextResponse.json(
        { error: 'seats must be a whole number between 1 and 10,000' },
        { status: 400 },
      );
    }

    const billingPeriod: BillingPeriod = period === 'annual' ? 'annual' : 'monthly';
    const amount = chargeablePaise(plan, seatCount, billingPeriod);
    if (amount === null) {
      return NextResponse.json(
        { error: 'This plan cannot be purchased through checkout.' },
        { status: 400 },
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const handoffSecret = process.env.DAYLINK_PAY_SECRET;
    const hubUrl = process.env.DAYLINK_PAY_URL || 'https://daylink.in/pay';

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Razorpay is not configured on this environment.' },
        { status: 500 },
      );
    }
    if (!handoffSecret) {
      // Refuse rather than fall back to an unsigned handoff — an unsigned
      // one would let anybody craft a payment link on our behalf.
      return NextResponse.json(
        { error: 'The payment hub is not configured on this environment.' },
        { status: 500 },
      );
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount,
      currency: BRAND.currency,
      receipt: `wsp_${String(workspace_id).slice(0, 8)}_${Date.now()}`,
      notes: {
        product: BRAND.name,
        workspace_id: String(workspace_id),
        plan_id: plan.id,
        seats: String(seatCount),
        period: billingPeriod,
      },
    });

    // `reference` is opaque to the hub and comes back untouched, which is
    // how the callback knows what was being bought without trusting the
    // buyer to tell it again.
    const { data, sig, nonce } = encodeHandoff(
      {
        product: 'dailybuz',
        orderId: order.id,
        amount: Number(order.amount),
        currency: String(order.currency),
        description: `${plan.name} — ${seatCount} seat${seatCount === 1 ? '' : 's'} (${
          billingPeriod === 'annual' ? 'annual' : 'monthly'
        })`,
        reference: [workspace_id, plan.id, seatCount, billingPeriod].join('|'),
      },
      handoffSecret,
    );

    const redirectUrl = new URL(hubUrl);
    redirectUrl.searchParams.set('d', data);
    redirectUrl.searchParams.set('s', sig);

    return NextResponse.json({
      redirect_url: redirectUrl.toString(),
      order_id: order.id,
      amount,
      nonce,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[billing/checkout]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
