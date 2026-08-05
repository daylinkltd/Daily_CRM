import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS, chargeablePaise, type BillingPeriod } from '@/config/plans';

export async function POST(request: NextRequest) {
  try {
    // Payment verification mutates the workspace plan — the caller
    // must be a signed-in admin/owner of that workspace. Without this
    // gate, anyone holding a valid signature for a ₹1 order could
    // upgrade ANY workspace to any plan.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      workspace_id,
      plan_id,
      seats,
      period,
    } = body;

    // Validation
    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !workspace_id ||
      !plan_id
    ) {
      return NextResponse.json(
        { error: 'Missing required signature verification fields' },
        { status: 400 }
      );
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Forbidden: only workspace owners or admins can change the plan' },
        { status: 403 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      console.error('[verify-payment] Razorpay secret not configured in environment');
      return NextResponse.json(
        { error: 'Razorpay integration keys are not configured.' },
        { status: 500 }
      );
    }

    // Verify HMAC-SHA256 signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Payment signature mismatch. Verification failed.' },
        { status: 400 }
      );
    }

    // Signatures match! Resolve the plan and verify the PAID AMOUNT
    // actually covers it — the signature only proves "this order was
    // paid", not "the right price was paid for this plan".
    const planConfig = PLANS.find((p) => p.id === plan_id);
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }
    if (planConfig.pricePerSeatMonthly <= 0) {
      return NextResponse.json(
        { error: 'This plan cannot be purchased through checkout.' },
        { status: 400 }
      );
    }

    // Seats are part of the price now, so they are part of what gets
    // verified. A caller who sends seats: 1 and pays for one seat must not
    // end up on a 50-seat workspace, so the seat count is written to
    // plan_limits below and enforced there.
    const seatCount = Number(seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 10_000) {
      return NextResponse.json(
        { error: 'seats must be a whole number between 1 and 10,000' },
        { status: 400 }
      );
    }
    const billingPeriod: BillingPeriod = period === 'annual' ? 'annual' : 'monthly';

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    let order: { amount: string | number; currency: string };
    try {
      order = await razorpay.orders.fetch(razorpay_order_id);
    } catch (err) {
      console.error('[verify-payment] Failed to fetch order from Razorpay:', err);
      return NextResponse.json(
        { error: 'Could not verify the payment order with Razorpay.' },
        { status: 400 }
      );
    }

    const paidPaise = Number(order.amount);
    const expectedPaise = chargeablePaise(planConfig, seatCount, billingPeriod);
    if (expectedPaise === null) {
      return NextResponse.json(
        { error: 'This plan cannot be purchased through checkout.' },
        { status: 400 }
      );
    }
    // The signature only proves this order was paid — not that it was paid
    // ENOUGH, and now not that it was paid for the right number of seats.
    if (order.currency !== 'INR' || paidPaise !== expectedPaise) {
      console.error(
        `[verify-payment] Amount mismatch for ${plan_id} x${seatCount} ${billingPeriod}: paid ${paidPaise}, expected ${expectedPaise}`
      );
      return NextResponse.json(
        { error: 'Paid amount does not match the selected plan and seat count.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Replay guard — one order upgrades one workspace, once.
    const { data: replayed } = await admin
      .from('workspaces')
      .select('id')
      .contains('plan_limits', { last_order_id: razorpay_order_id })
      .limit(1);
    if (replayed && replayed.length > 0) {
      return NextResponse.json(
        { error: 'This payment has already been applied.' },
        { status: 409 }
      );
    }

    // Map limits structure
    // Seats bought is the member ceiling. Without this a customer could
    // pay for three seats and invite thirty — the plan itself no longer
    // caps headcount, so the purchase has to.
    const limits = {
      max_members: planConfig.maxUsers === null ? seatCount : Math.min(planConfig.maxUsers, seatCount),
      max_workspaces: planConfig.maxWorkspaces,
      max_storage_gb: planConfig.id === 'business' ? 20 : 5,
      channels: ['whatsapp', 'instagram', 'messenger', 'email'],
      max_automations: planConfig.id === 'free' ? 3 : null,
      max_messages: planConfig.monthlyMessageAllowance,
      seats: seatCount,
      billing_period: billingPeriod,
      last_order_id: razorpay_order_id,
    };

    const { error: updateError } = await admin
      .from('workspaces')
      .update({
        plan: planConfig.id,
        plan_limits: limits,
      })
      .eq('id', workspace_id);

    if (updateError) {
      console.error('[verify-payment] Workspace plan update failed:', updateError.message);
      return NextResponse.json(
        { error: `Payment verified, but failed to update workspace: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and plan updated successfully',
      plan: planConfig.id,
    });
  } catch (error: any) {
    console.error('[verify-payment] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
