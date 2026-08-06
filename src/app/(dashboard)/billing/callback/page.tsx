import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import { decodeOutcome } from "@/lib/payments/handoff";
import { PLANS } from "@/config/plans";
import { ActivateOnLoad } from "./activate-on-load";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payment result",
  robots: { index: false, follow: false },
};

/**
 * Where daylink.in returns the buyer after checkout.
 *
 * The signed outcome proves the hub sent it — nothing more. It does NOT
 * prove money moved, because the Razorpay ids inside were relayed through
 * the buyer's browser. So a "paid" outcome is not treated as payment: it
 * is handed to /api/verify-payment, which fetches the order from Razorpay,
 * checks the HMAC and confirms the captured amount matches the seats being
 * bought before the plan is touched.
 *
 * In other words this page believes the hub about WHAT HAPPENED and
 * believes only Razorpay about WHETHER IT WAS PAID.
 */
export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; s?: string }>;
}) {
  const { d = "", s = "" } = await searchParams;
  const secret = process.env.DAYLINK_PAY_SECRET;

  if (!secret) {
    return (
      <Result
        tone="error"
        title="Payments are not configured"
        body="This environment cannot verify payment results. No change has been made to your plan."
      />
    );
  }

  const result = decodeOutcome(d, s, secret);

  if (!result.ok) {
    return (
      <Result
        tone="error"
        title="We couldn't verify that result"
        body="The payment result was missing or did not come from our checkout. If you were charged, nothing is lost — contact support and we'll sort it out."
      />
    );
  }

  const { outcome } = result;

  if (outcome.status === "cancelled") {
    return (
      <Result
        tone="neutral"
        title="Checkout cancelled"
        body="No payment was taken and your plan is unchanged. You can pick up where you left off whenever you're ready."
      />
    );
  }

  if (outcome.status === "failed") {
    return (
      <Result
        tone="error"
        title="Payment didn't go through"
        body="Your bank declined or the payment failed. Nothing has been charged — you can try again, or use a different method."
      />
    );
  }

  // status === 'paid' — claimed, not proven. Verify server-side.
  // Fifth segment is the coupon code, empty when none was used.
  const [workspaceId, planId, seatsRaw, period, couponCode] = (outcome.reference ?? "").split("|");
  const plan = PLANS.find((p) => p.id === planId);
  const seats = Number(seatsRaw);

  if (!workspaceId || !plan || !Number.isInteger(seats)) {
    return (
      <Result
        tone="error"
        title="We couldn't match that payment"
        body="The payment came back but we couldn't tell which workspace it was for. Contact support with your payment id and we'll apply it manually."
      />
    );
  }

  return (
    <ActivateOnLoad
      workspaceId={workspaceId}
      planId={plan.id}
      planName={plan.name}
      seats={seats}
      couponCode={couponCode || null}
      period={period === "annual" ? "annual" : "monthly"}
      razorpayOrderId={outcome.razorpayOrderId ?? ""}
      razorpayPaymentId={outcome.razorpayPaymentId ?? ""}
      razorpaySignature={outcome.razorpaySignature ?? ""}
    />
  );
}

function Result({
  tone,
  title,
  body,
}: {
  tone: "success" | "error" | "neutral";
  title: string;
  body: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? XCircle : AlertTriangle;
  const colour =
    tone === "success"
      ? "text-emerald-500"
      : tone === "error"
        ? "text-rose-500"
        : "text-amber-500";

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <Icon className={`mx-auto size-10 ${colour}`} />
      <h1 className="mt-5 text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/settings?tab=billing"
          className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back to billing
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
