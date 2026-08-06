import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { PLANS, type BillingPeriod } from '@/config/plans';
import { encodeHandoff } from '@/lib/payments/handoff';
import { validateSeats } from '@/lib/billing/seats';
import { checkCoupon, discountedBill } from '@/lib/billing/coupons';
import { createAdminClient } from '@/lib/supabase/admin';
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
    const { workspace_id, plan_id, seats, period, coupon_code } = body;

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

    // Seats are what the price is multiplied by, so they are validated
    // against the workspace's real headcount rather than trusted. The UI
    // clamps the stepper, but a clamp in a React component is a
    // suggestion — this is the rule.
    const { count: memberCount } = await supabase
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id);

    const seatCheck = validateSeats(plan, memberCount ?? 1, seats);
    if (!seatCheck.ok) {
      return NextResponse.json({ error: seatCheck.error }, { status: 400 });
    }
    const seatCount = Number(seats);

    const billingPeriod: BillingPeriod = period === 'annual' ? 'annual' : 'monthly';

    // Coupon, if any. Validated here so a dead code fails BEFORE money
    // moves, with a message the panel shows verbatim. The code then rides
    // in the handoff reference so verify-payment recomputes the identical
    // discounted total — the two sides share one implementation
    // (discountedBill), which is what makes that safe.
    let percentOff = 0;
    let couponCode: string | null = null;
    if (coupon_code) {
      const check = await checkCoupon(createAdminClient(), coupon_code, plan.id);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason, code: 'bad_coupon' }, { status: 400 });
      }
      percentOff = check.coupon.percent_off;
      couponCode = check.coupon.code;
    }

    const bill = discountedBill(plan, seatCount, billingPeriod, percentOff);
    if (!bill) {
      return NextResponse.json(
        { error: 'This plan cannot be purchased through checkout.' },
        { status: 400 },
      );
    }
    const amount = bill.totalPaise;

    if (amount < 100) {
      // Razorpay's floor is ₹1. A 100% coupon (or one that rounds below
      // the floor) skips payment entirely and activates directly — going
      // to a payment page to pay ₹0 is both impossible and absurd.
      return NextResponse.json(
        {
          error:
            'This coupon covers the full amount. Contact support to activate without payment.',
          code: 'zero_amount',
        },
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
        coupon: couponCode ?? '',
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
        }, incl. 18% GST)`,
        // Coupon travels with the order so the callback can hand it to
        // verify-payment; an empty segment means none.
        reference: [workspace_id, plan.id, seatCount, billingPeriod, couponCode ?? ''].join('|'),
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
      discount: bill.discountPaise,
      nonce,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[billing/checkout]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
