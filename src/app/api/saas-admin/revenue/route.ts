import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/saas-admin/guard';
import { listHubPayments, type HubPayment } from '@/lib/payments/hub-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/saas-admin/revenue — the money page's data.
 *
 * Two sources, deliberately both:
 *
 *   - `platform_payments` (ours): every payment verify-payment approved,
 *     with the tenant, seats, GST split and coupon attached. Fast,
 *     filterable, permanent.
 *   - Razorpay via the hub (theirs): the settlement truth. Knows about
 *     refunds, failed attempts and anything that bypassed our verify
 *     flow. If the two disagree, Razorpay is right and the mismatch is
 *     surfaced rather than papered over.
 */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const { admin } = guard.ctx;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [ledger, hub] = await Promise.all([
    admin
      .from('platform_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    // The hub being down must not blank the whole page — the local
    // ledger still renders and the gateway column says "unavailable".
    listHubPayments({ count: 100 }).catch(() => null),
  ]);

  if (ledger.error) {
    return NextResponse.json({ error: ledger.error.message }, { status: 500 });
  }

  const rows = ledger.data ?? [];

  let totalPaise = 0;
  let monthPaise = 0;
  let gstPaise = 0;
  for (const r of rows) {
    totalPaise += Number(r.total_paise) || 0;
    gstPaise += Number(r.gst_paise) || 0;
    if (new Date(r.created_at) >= monthStart) monthPaise += Number(r.total_paise) || 0;
  }

  // Reconciliation: captured payments Razorpay knows that our ledger does
  // not. Test-mode noise and abandoned orders stay out of it — only
  // status 'captured' counts as money.
  let gateway: {
    available: boolean;
    capturedPaise: number;
    refundedPaise: number;
    payments: HubPayment[];
    unmatched: HubPayment[];
  } = { available: false, capturedPaise: 0, refundedPaise: 0, payments: [], unmatched: [] };

  if (hub && hub.ok) {
    const captured = hub.data.payments.filter((p) => p.status === 'captured');
    const knownOrders = new Set(rows.map((r) => r.razorpay_order_id));
    gateway = {
      available: true,
      capturedPaise: captured.reduce((sum, p) => sum + p.amount, 0),
      refundedPaise: captured.reduce((sum, p) => sum + p.amount_refunded, 0),
      payments: captured.slice(0, 50),
      unmatched: captured.filter((p) => !p.order_id || !knownOrders.has(p.order_id)),
    };
  }

  return NextResponse.json({
    ledger: {
      totalPaise,
      monthPaise,
      gstPaise,
      count: rows.length,
      rows,
    },
    gateway,
  });
}
