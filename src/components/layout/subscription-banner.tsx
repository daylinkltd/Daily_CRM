"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, AlertTriangle, XCircle } from "lucide-react";

import { useWorkspace } from "@/hooks/use-workspace";
import type { SubscriptionInfo } from "@/lib/limits";

/**
 * The subscription's voice in the app chrome.
 *
 * Four registers, deliberately escalating:
 *   trialing (≤7 days left)  — quiet counter with a Subscribe link
 *   grace                    — amber bar: payment lapsed, N days to fix it
 *   expired                  — the pay-now marquee: red, sticky, undismissable
 *   cancelled                — neutral note with the end date
 *
 * A trial with more than a week left shows NOTHING. Nagging someone on
 * day 2 of 14 teaches them to ignore the banner, and the banner is the
 * only channel we have when it actually matters.
 *
 * Undismissable-by-design for grace/expired: an expired workspace whose
 * owner clicked "×" three days ago is indistinguishable from one that was
 * never told.
 */
export function SubscriptionBanner() {
  const { activeWorkspace, activeRole } = useWorkspace();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/workspace/usage?workspace_id=${activeWorkspace.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.subscription) setSub(data.subscription);
      } catch {
        // The banner is advisory chrome; a fetch failure must never break
        // the shell. Next navigation retries anyway.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);

  if (!sub) return null;

  const canPay = activeRole === "owner" || activeRole === "admin";
  const billingHref = "/settings?tab=billing";

  if (sub.state === "trialing" && sub.daysLeft <= 7) {
    return (
      <div className="flex items-center justify-center gap-3 border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs text-sky-200">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>{sub.daysLeft} day{sub.daysLeft === 1 ? "" : "s"}</strong> left in your free
          trial. Your data stays either way.
        </span>
        {canPay && (
          <Link href={billingHref} className="font-bold underline underline-offset-2 hover:text-white">
            Subscribe
          </Link>
        )}
      </div>
    );
  }

  if (sub.state === "grace") {
    return (
      <div className="flex items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          Your subscription period has ended. Renew in the next few days to avoid interruption.
        </span>
        {canPay && (
          <Link href={billingHref} className="font-bold underline underline-offset-2 hover:text-white">
            Renew now
          </Link>
        )}
      </div>
    );
  }

  if (sub.state === "expired") {
    return (
      <div className="sticky top-0 z-40 flex items-center justify-center gap-3 border-b border-rose-500/50 bg-rose-600/95 px-4 py-2.5 text-xs font-semibold text-white">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>
          {sub.trialEndsAt && !sub.currentPeriodEnd
            ? "Your free trial has ended."
            : "Your subscription has expired."}{" "}
          {canPay
            ? "Pay now to keep working — everything is exactly where you left it."
            : "Ask a workspace owner to renew the subscription."}
        </span>
        {canPay && (
          <Link
            href={billingHref}
            className="rounded-md bg-white px-3 py-1 font-bold text-rose-700 hover:bg-rose-50"
          >
            Pay now
          </Link>
        )}
      </div>
    );
  }

  if (sub.state === "cancelled") {
    return (
      <div className="flex items-center justify-center gap-3 border-b border-border bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
        <span>
          Subscription cancelled — access continues until{" "}
          {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "the period ends"}
          . No further charges.
        </span>
        {canPay && (
          <Link href={billingHref} className="font-semibold underline underline-offset-2 hover:text-foreground">
            Resume
          </Link>
        )}
      </div>
    );
  }

  return null;
}
