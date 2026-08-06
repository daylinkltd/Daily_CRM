"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

/**
 * Turns a claimed "paid" into an actually-verified upgrade.
 *
 * The hub told us the payment succeeded. That is a claim relayed through
 * the buyer's browser, so it is worth exactly nothing on its own. This
 * component posts the Razorpay ids to /api/verify-payment, which fetches
 * the order from Razorpay, recomputes the HMAC and checks the captured
 * amount against the seats being bought before it changes the plan.
 *
 * Deliberately fires on mount with no button: the buyer has already paid
 * and asking them to click "confirm" invites them to close the tab instead,
 * leaving money taken and no plan granted. The verify endpoint is
 * idempotent — it refuses an order id it has already applied — so a
 * refresh cannot double-apply.
 */
export function ActivateOnLoad({
  workspaceId,
  planId,
  planName,
  seats,
  period,
  couponCode,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}: {
  workspaceId: string;
  planId: string;
  planName: string;
  seats: number;
  period: "monthly" | "annual";
  couponCode?: string | null;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const [state, setState] = useState<"verifying" | "done" | "failed">("verifying");
  const [error, setError] = useState<string | null>(null);
  // Strict mode mounts effects twice in development; without this the
  // second call hits the replay guard and reports a spurious failure.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const res = await fetch("/api/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: razorpaySignature,
            workspace_id: workspaceId,
            plan_id: planId,
            seats,
            period,
            coupon_code: couponCode ?? undefined,
          }),
        });
        const json = await res.json();

        if (res.status === 409) {
          // Already applied — a refresh or a double return. That is a
          // success from the buyer's point of view, not an error.
          setState("done");
          return;
        }
        if (!res.ok) throw new Error(json.error || "Verification failed");
        setState("done");
      } catch (err) {
        setState("failed");
        setError(err instanceof Error ? err.message : "Verification failed");
      }
    })();
  }, [
    workspaceId,
    planId,
    seats,
    period,
    couponCode,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  ]);

  if (state === "verifying") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <Loader2 className="mx-auto size-10 animate-spin text-primary" />
        <h1 className="mt-5 text-lg font-semibold text-foreground">
          Confirming your payment
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Checking with the payment provider. This takes a moment — please
          don&apos;t close this tab.
        </p>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <XCircle className="mx-auto size-10 text-rose-500" />
        <h1 className="mt-5 text-lg font-semibold text-foreground">
          We couldn&apos;t confirm the payment
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          If your bank shows a charge, don&apos;t pay again — send us payment id{" "}
          <span className="font-mono">{razorpayPaymentId || "(unknown)"}</span> and
          we&apos;ll apply it by hand.
        </p>
        <Link
          href="/settings?tab=billing"
          className="mt-8 inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back to billing
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
      <h1 className="mt-5 text-lg font-semibold text-foreground">
        You&apos;re on {planName}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {seats} seat{seats === 1 ? "" : "s"}, billed {period}. Every module is
        unlocked for your whole team.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Go to dashboard
        </Link>
        <Link
          href="/settings?tab=billing"
          className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          View billing
        </Link>
      </div>
    </div>
  );
}
