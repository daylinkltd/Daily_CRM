import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS } from '@/config/plans';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      workspace_id,
      plan_id,
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

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
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

    // Signatures match! Update workspace plan in Supabase
    const planConfig = PLANS.find((p) => p.id === plan_id);
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Map limits structure
    const limits = {
      max_members: planConfig.maxUsers === 999999 ? null : planConfig.maxUsers,
      max_workspaces: planConfig.maxWorkspaces === 999999 ? null : planConfig.maxWorkspaces,
      max_storage_gb: planConfig.id === 'business' ? 20 : planConfig.id === 'growth' ? 10 : 5,
      channels: ['whatsapp', 'instagram', 'messenger', 'email'],
      max_automations: planConfig.id === 'free' ? 3 : null,
      max_messages: planConfig.monthlyMessageAllowance === 999999 ? null : planConfig.monthlyMessageAllowance,
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
