import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { PLANS, chargeablePaise, type BillingPeriod } from '@/config/plans';
import { encodeHandoff } from '@/lib/payments/handoff';
import { createHubOrder } from '@/lib/payments/hub-client';
import { BRAND } from '@/config/brand';

export const dynamic = 'force-dynamic';

/**
 * Start a checkout.
 *
 * THIS APP DECIDES THE PRICE; THE HUB HOLDS THE CREDENTIALS. The amount is
 * computed here from our own plan config and seat count, then the Daylink
 * hub creates the Razorpay order for exactly that amount and hosts the
 * modal (daylink.in being the only domain registered with Razorpay).
 *
 * Splitting it this way means the account's secret exists in one place
 * rather than being copied into every product that ever bills a customer,
 * while pricing and the eventual approve/reject decision stay with the app
 * that actually knows what a seat costs.
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

    // A plan with a user ceiling must not be sold more seats than it can
    // hold — Solo caps at one, and billing five would take money for
    // logins the plan will then refuse to create.
    if (plan.maxUsers !== null && seatCount > plan.maxUsers) {
      return NextResponse.json(
        {
          error: `The ${plan.name} plan is limited to ${plan.maxUsers} user${plan.maxUsers === 1 ? '' : 's'}. Choose Business for a larger team.`,
        },
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

    const handoffSecret = process.env.DAYLINK_PAY_SECRET;
    const hubUrl = process.env.DAYLINK_PAY_URL || 'https://daylink.in/pay';

    if (!handoffSecret) {
      // Refuse rather than fall back to an unsigned handoff — an unsigned
      // one would let anybody craft a payment link on our behalf.
      return NextResponse.json(
        { error: 'The payment hub is not configured on this environment.' },
        { status: 500 },
      );
    }

    // The hub holds the Razorpay credentials and creates the order for the
    // amount we computed. It cannot change that amount, and we re-check
    // what was actually captured before granting anything.
    const created = await createHubOrder({
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

    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: created.status });
    }
    const order = created.data;

    // `reference` is opaque to the hub and comes back untouched, which is
    // how the callback knows what was being bought without trusting the
    // buyer to tell it again.
    const { data, sig, nonce } = encodeHandoff(
      {
        product: 'dailybuz',
        orderId: order.order_id,
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
      order_id: order.order_id,
      amount,
      nonce,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[billing/checkout]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
