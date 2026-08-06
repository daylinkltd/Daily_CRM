import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS, type BillingPeriod } from '@/config/plans';
import { checkCoupon, discountedBill } from '@/lib/billing/coupons';
import { ACTIVITY, logActivity } from '@/lib/saas-admin/activity';
import { verifyHubPayment } from '@/lib/payments/hub-client';

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
      coupon_code,
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

    // Signature checking and the Razorpay lookup happen on the Daylink hub,
    // which is the only host holding the account credentials. It returns
    // FACTS — was the signature valid, how much was actually captured —
    // and the approve/reject decision below stays here, in the app that
    // knows what the plan costs.
    const verification = await verifyHubPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!verification.ok) {
      console.error('[verify-payment] hub error:', verification.error);
      return NextResponse.json({ error: verification.error }, { status: verification.status });
    }

    if (!verification.data.signature_valid) {
      return NextResponse.json(
        { error: 'Payment signature mismatch. Verification failed.' },
        { status: 400 }
      );
    }

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

    // Seats are part of the price, so they are part of what gets verified.
    // A caller who sends seats: 1 and pays for one seat must not end up on
    // a 50-seat workspace, so the count is written to plan_limits below.
    const seatCount = Number(seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 10_000) {
      return NextResponse.json(
        { error: 'seats must be a whole number between 1 and 10,000' },
        { status: 400 }
      );
    }
    if (planConfig.maxUsers !== null && seatCount > planConfig.maxUsers) {
      return NextResponse.json(
        { error: `The ${planConfig.name} plan cannot hold ${seatCount} users.` },
        { status: 400 }
      );
    }
    const billingPeriod: BillingPeriod = period === 'annual' ? 'annual' : 'monthly';

    // STRICTLY amount_paid, never falling back to `amount`. `amount` is
    // what the order ASKED for; `amount_paid` is what Razorpay actually
    // captured. An unpaid order reports amount_paid: 0 alongside the full
    // `amount`, so a `amount_paid || amount` fallback would treat an
    // untouched order as fully paid — caught by testing an unpaid order
    // against the live API rather than by reading the code.
    const paidPaise = Number(verification.data.amount_paid ?? 0);

    // Belt and braces: Razorpay flips the order to 'paid' only once it is
    // settled in full, so this rejects partial captures too.
    if (verification.data.status !== 'paid') {
      console.error(
        `[verify-payment] Order ${razorpay_order_id} is '${verification.data.status}', not paid`,
      );
      return NextResponse.json(
        { error: 'That payment has not completed. Nothing has been charged to your plan.' },
        { status: 400 }
      );
    }
    // The coupon (if one was used) rides back from checkout in the
    // handoff reference. It is RE-VALIDATED here rather than trusted:
    // the code string reaches us via the buyer's browser, and the only
    // thing that keeps a made-up "MEGA99" from pricing the order is that
    // this lookup fails. A coupon that expired between checkout and
    // payment is still honoured — expiry gates issuing new orders, and
    // the buyer already paid the discounted amount in good faith — which
    // works because the amount check below uses the coupon's actual
    // percent, not its current validity.
    let percentOff = 0;
    let couponRow: { code: string } | null = null;
    if (coupon_code) {
      const adminForCoupon = createAdminClient();
      const check = await checkCoupon(adminForCoupon, coupon_code, plan_id);
      if (check.ok) {
        percentOff = check.coupon.percent_off;
        couponRow = check.coupon;
      } else {
        const { data: lapsed } = await adminForCoupon
          .from('coupons')
          .select('code, percent_off')
          .eq('code', String(coupon_code).toUpperCase())
          .maybeSingle();
        if (!lapsed) {
          return NextResponse.json(
            { error: 'The coupon on this order does not exist.' },
            { status: 400 }
          );
        }
        percentOff = lapsed.percent_off;
        couponRow = lapsed;
      }
    }

    const bill = discountedBill(planConfig, seatCount, billingPeriod, percentOff);
    if (!bill) {
      return NextResponse.json(
        { error: 'This plan cannot be purchased through checkout.' },
        { status: 400 }
      );
    }
    const expectedPaise = bill.totalPaise;
    // The signature only proves this order was paid — not that it was paid
    // ENOUGH, and now not that it was paid for the right number of seats.
    if (verification.data.currency !== 'INR' || paidPaise !== expectedPaise) {
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

    // The paid period starts NOW, not at trial end. Someone who converts
    // on day 3 of a trial paid for a month from today; stacking the
    // remaining trial days on top is a nicety no invoice can explain.
    const periodEnd = new Date();
    if (billingPeriod === 'annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const { error: updateError } = await admin
      .from('workspaces')
      .update({
        plan: planConfig.id,
        plan_limits: limits,
        subscription_status: 'active',
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      })
      .eq('id', workspace_id);

    if (updateError) {
      console.error('[verify-payment] Workspace plan update failed:', updateError.message);
      return NextResponse.json(
        { error: `Payment verified, but failed to update workspace: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Income ledger. One row per captured payment, written by the same
    // code that approved it — the console's Revenue page reads this for
    // per-tenant history, with Razorpay itself as the cross-check.
    // The UNIQUE(razorpay_order_id) makes retried verifications a no-op
    // here just as the replay guard above makes them a no-op on the plan.
    const { data: wsName } = await admin
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .maybeSingle();
    const { error: ledgerErr } = await admin.from('platform_payments').insert({
      workspace_id,
      workspace_name: wsName?.name ?? null,
      user_id: user.id,
      user_email: user.email ?? null,
      plan_id: planConfig.id,
      seats: seatCount,
      billing_period: billingPeriod,
      base_paise: bill.basePaise,
      gst_paise: bill.gstPaise,
      total_paise: bill.totalPaise,
      coupon_code: couponRow?.code ?? null,
      discount_paise: bill.discountPaise,
      razorpay_order_id,
      razorpay_payment_id,
    });
    if (ledgerErr && ledgerErr.code !== '23505') {
      // Log, never fail the activation: the customer paid and Razorpay
      // has the settlement record — a ledger hiccup must not eat that.
      console.error('[verify-payment] income ledger write failed:', ledgerErr.message);
    }

    // Redemption is recorded AFTER activation and through the idempotent
    // RPC — a retried verification (double-click, flaky network) must not
    // count twice against max_redemptions.
    if (couponRow) {
      const { error: redeemErr } = await admin.rpc('redeem_coupon', {
        p_code: couponRow.code,
        p_workspace_id: workspace_id,
        p_user_id: user.id,
        p_order_id: razorpay_order_id,
        p_discount_paise: bill.discountPaise,
      });
      if (redeemErr) console.error('[verify-payment] coupon redemption failed:', redeemErr.message);
    }

    await logActivity({
      event: ACTIVITY.PAYMENT_VERIFIED,
      userId: user.id,
      userEmail: user.email,
      workspaceId: workspace_id,
      details: {
        plan: planConfig.id,
        seats: seatCount,
        period: billingPeriod,
        paid_paise: paidPaise,
        coupon: couponRow?.code ?? null,
        order_id: razorpay_order_id,
        period_end: periodEnd.toISOString(),
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment verified and plan updated successfully',
      plan: planConfig.id,
      period_end: periodEnd.toISOString(),
    });
  } catch (error: any) {
    console.error('[verify-payment] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
