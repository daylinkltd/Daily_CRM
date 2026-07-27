import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Orders are only created for signed-in users — anonymous order
    // creation gave attackers a free primitive for probing the
    // payment flow.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { amount, currency = 'INR', receipt } = body;

    // Validation
    if (amount === undefined || typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'amount is required and must be a number' },
        { status: 400 }
      );
    }

    if (amount < 100) {
      return NextResponse.json(
        { error: 'Minimum amount is 100 paise (1 INR)' },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('[create-order] Razorpay keys not configured in environment');
      return NextResponse.json(
        { error: 'Razorpay integration keys are not configured.' },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error('[create-order] Razorpay error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
