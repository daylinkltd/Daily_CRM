"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import {
  PLANS,
  BUSINESS_PLAN,
  Plan,
  billBreakdown,
  seatRate,
  monthlyTotal,
  annualSavingPercent,
  type BillingPeriod,
} from "@/config/plans";
import { useWorkspace } from "@/hooks/use-workspace";
import { clampSeats, seatFloor as computeSeatFloor, MAX_SEATS } from "@/lib/billing/seats";
import { Check, AlertTriangle, ArrowRight, ShieldCheck, Loader2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

interface WorkspaceUsage {
  planId: string;
  planName: string;
  memberCount: number;
  maxUsers: number;
  workspaceCount: number;
  maxWorkspaces: number;
  messageCount: number;
  monthlyMessageAllowance: number;
  isTrial: boolean;
  createdAt: string;
  subscription?: {
    state: "trialing" | "active" | "grace" | "expired" | "cancelled";
    daysLeft: number;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    paymentDue: boolean;
  };
}

export function BillingPanel() {
  const { activeWorkspace, activeRole } = useWorkspace();
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  // Seats are the unit of pricing. Defaults to the workspace's current
  // member count so the common case needs no thought.
  const [seatCount, setSeatCount] = useState<number>(1);
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  // Coupon code, applied server-side at checkout. Kept as raw input here;
  // the server is the only judge of validity, so there is no client-side
  // "valid!" state to get out of sync.
  const [couponCode, setCouponCode] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  const fetchUsage = async () => {
    if (!activeWorkspace?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/workspace/usage?workspace_id=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
        // Seats default to the people already in the workspace. Buying
        // fewer than that is not a thing anyone means to do, and starting
        // at 1 made the panel quote a price nobody could actually use.
        setSeatCount(Math.max(1, Number(data.memberCount) || 1));
      }
    } catch (err) {
      console.error("Failed to fetch billing usage:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [activeWorkspace?.id]);

  // Seats can never go below the people already in the workspace: the
  // subscription has to cover everyone who can log in, and letting someone
  // buy 3 seats for a team of 8 just produces a support ticket later.
  const memberFloor = Math.max(1, usage?.memberCount ?? 1);
  const seatFloor = computeSeatFloor(BUSINESS_PLAN, memberFloor);
  const seats = clampSeats(BUSINESS_PLAN, memberFloor, seatCount);

  const setSeats = (next: number) => {
    setSeatCount(clampSeats(BUSINESS_PLAN, memberFloor, next));
  };

  const changeSubscription = async (action: "cancel" | "resume") => {
    if (!activeWorkspace?.id) return;
    setCancelBusy(true);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: activeWorkspace.id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not update the subscription.");
      toast.success(
        action === "cancel"
          ? "Cancelled. Access continues until the end of the paid period."
          : "Welcome back — your subscription is live again.",
      );
      fetchUsage();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the subscription.");
    } finally {
      setCancelBusy(false);
    }
  };

  const handleUpgrade = async (plan: Plan) => {
    if (!activeWorkspace?.id) return;
    if (activeRole !== "owner" && activeRole !== "admin") {
      toast.error("Only workspace owners or admins can modify the subscription plan.");
      return;
    }

    if (plan.id === "free") {
      toast.info("You are already on the Free Trial or have completed it.");
      return;
    }

    if (plan.id === "custom") {
      toast.info("For enterprise custom setups, please contact our sales team.");
      return;
    }

    const period: BillingPeriod = billingCycle === "annual" ? "annual" : "monthly";
    // Seats the workspace is buying. The server recomputes the amount from
    // the same helper and rejects any mismatch, so this is a display and
    // request value, never the authority.
    const buyingSeats = Math.max(seats, plan.minSeats);

    // Razorpay only opens its modal on daylink.in (the only domain
    // registered against the account), so checkout is hosted there. This
    // app still creates the order — with its own seat-verified amount —
    // and hands over an order id the hub cannot change.
    try {
      setIsUpgrading(plan.id);
      toast.loading("Preparing secure checkout...");

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          plan_id: plan.id,
          seats: buyingSeats,
          period,
          coupon_code: couponCode.trim() || undefined,
        }),
      });
      const json = await res.json();
      toast.dismiss();

      if (!res.ok || !json.redirect_url) {
        throw new Error(json.error || "Could not start checkout.");
      }

      // Full navigation, not a new tab: popup blockers eat tabs opened
      // after an await, and the buyer comes straight back here afterwards.
      window.location.href = json.redirect_url;
    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : "Could not start checkout.");
      setIsUpgrading(null);
    }
  };

  if (loading && !usage) {
    return (
      <div className="flex h-[350px] items-center justify-center rounded-xl border border-border bg-card/20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading plan subscription details...</span>
        </div>
      </div>
    );
  }

  const currentPlan = PLANS.find((p) => p.id === usage?.planId) || PLANS[0];
  const totalMessages = usage?.messageCount || 0;
  const maxMessages = usage?.monthlyMessageAllowance || 500;
  const msgPercent = Math.min(Math.round((totalMessages / maxMessages) * 100), 100);

  const totalMembers = usage?.memberCount || 1;
  // null = unlimited (enterprise). The old `|| 2` here fabricated a
  // two-seat ceiling for exactly those workspaces and hid every purchased
  // seat count behind it.
  const maxMembers = usage?.maxUsers ?? null;
  const membersPercent = maxMembers
    ? Math.min(Math.round((totalMembers / maxMembers) * 100), 100)
    : 0;

  // What the buyer will actually be charged, from the same helper the
  // server verifies against — so the number on screen and the number in
  // the Razorpay order can never drift apart. GST is in the total, and
  // the split is shown: a business buyer needs the base for their books
  // and the total for their bank statement.
  const bill = billBreakdown(BUSINESS_PLAN, seats, billingCycle);
  const billedNowPaise = bill?.totalPaise ?? 0;

  const totalWorkspaces = usage?.workspaceCount || 1;
  const maxWorkspaces = usage?.maxWorkspaces || 1;
  const workspacesPercent = Math.min(Math.round((totalWorkspaces / maxWorkspaces) * 100), 100);

  return (
    <div className="space-y-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Current Plan Overview Banner */}
      <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-slate-950/60 to-muted p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                Active Plan
              </span>
              {usage?.isTrial && (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> 14-day Trial
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg font-black text-foreground">{currentPlan.name} Tier</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Workspace subscription handles routing and resource quotas for your team.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-muted-foreground block">Pricing Plan Cost</span>
            <span className="text-2xl font-black text-foreground">
              {currentPlan.pricePerSeatMonthly === 0 ? "₹0" : currentPlan.pricePerSeatMonthly === -1 ? "Custom" : `₹${currentPlan.pricePerSeatMonthly.toLocaleString()}/user/mo`}
            </span>
            <span className="text-[10px] text-muted-foreground block">excl. GST</span>
          </div>
        </div>
      </div>

      {/* Plan Usage Limits Progress Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Outbound messages */}
        <div className="rounded-xl border border-border bg-background/40 p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs text-muted-foreground font-semibold block">Monthly Messages</span>
              <span className="text-lg font-black text-foreground">
                {totalMessages.toLocaleString()} / {maxMessages === 999999 ? "∞" : maxMessages.toLocaleString()}
              </span>
            </div>
            {msgPercent >= 80 && (
              <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold ${msgPercent >= 100 ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"}`}>
                {msgPercent >= 100 ? "Limit Reached" : "80% Warning"}
              </span>
            )}
          </div>
          <div className="w-full bg-card rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                msgPercent >= 100 ? "bg-red-500" : msgPercent >= 80 ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${msgPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground block mt-2">
            {usage?.isTrial ? "Allowance covers trial period." : "Resets monthly on 1st."} WhatsApp template charges separate.
          </span>
        </div>

        {/* Team Members */}
        <div className="rounded-xl border border-border bg-background/40 p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs text-muted-foreground font-semibold block">Team Members</span>
              <span className="text-lg font-black text-foreground">
                {totalMembers} / {maxMembers === null || maxMembers === 999999 ? "Unlimited" : maxMembers}
              </span>
            </div>
            {membersPercent >= 100 && maxMembers !== null && maxMembers !== 999999 && (
              <span className="px-2 py-0.5 rounded-none text-[10px] font-bold bg-amber-500/15 text-amber-500">
                Max Users
              </span>
            )}
          </div>
          <div className="w-full bg-card rounded-full h-2">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${maxMembers === null || maxMembers === 999999 ? 100 : membersPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground block mt-2">
            Max members allowed to join this workspace.
          </span>
        </div>

        {/* Workspaces */}
        <div className="rounded-xl border border-border bg-background/40 p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs text-muted-foreground font-semibold block">Workspaces</span>
              <span className="text-lg font-black text-foreground">
                {totalWorkspaces} / {maxWorkspaces === 999999 ? "Unlimited" : maxWorkspaces}
              </span>
            </div>
            {workspacesPercent >= 100 && maxWorkspaces !== 999999 && (
              <span className="px-2 py-0.5 rounded-none text-[10px] font-bold bg-amber-500/15 text-amber-500">
                Limit Reached
              </span>
            )}
          </div>
          <div className="w-full bg-card rounded-full h-2">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${maxWorkspaces === 999999 ? 100 : workspacesPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground block mt-2">
            Number of team workspaces you can build.
          </span>
        </div>
      </div>

      {/* Upgrade Options Section */}
      <div className="border-t border-border/60 pt-8">
        <div className="text-center mb-6">
          <h3 className="text-lg font-extrabold text-foreground">Upgrade Workspace Plan</h3>
          <p className="text-muted-foreground text-xs mt-1">Unlock larger allowances and multi-agent automations.</p>

          {/* Pricing Toggle */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground bg-card border border-border"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors relative ${
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground bg-card border border-border"
              }`}
            >
              Annual
              <span className="absolute -top-3 -right-6 px-1.5 py-0.5 bg-emerald-500 text-foreground text-[8px] font-bold rounded-full uppercase tracking-wider scale-90">
                2 Months Free
              </span>
            </button>
          </div>
        </div>

        {/* Subscription lifecycle — what you're on, until when, and the
            one lever: cancel (or resume). Cancel is a promise, not a
            refund: access runs to the end of what was paid, and nothing
            renews because nothing auto-charges. */}
        {usage?.subscription && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-5">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subscription
              </span>
              <span className="mt-1 block text-sm font-bold text-foreground">
                {usage.subscription.state === "trialing" &&
                  `Free trial — ${usage.subscription.daysLeft} day${usage.subscription.daysLeft === 1 ? "" : "s"} left`}
                {usage.subscription.state === "active" &&
                  (usage.subscription.currentPeriodEnd
                    ? `Active until ${new Date(usage.subscription.currentPeriodEnd).toLocaleDateString()}`
                    : "Active")}
                {usage.subscription.state === "grace" && "Payment due — in grace period"}
                {usage.subscription.state === "expired" && "Expired — pay to continue"}
                {usage.subscription.state === "cancelled" &&
                  `Cancelled — access until ${usage.subscription.currentPeriodEnd ? new Date(usage.subscription.currentPeriodEnd).toLocaleDateString() : "period end"}`}
              </span>
              {usage.subscription.state === "cancelled" && (
                <span className="block text-[11px] text-muted-foreground">
                  No further charges will be requested.
                </span>
              )}
            </div>
            {activeRole === "owner" &&
              (usage.subscription.state === "cancelled" ? (
                <button
                  type="button"
                  disabled={cancelBusy}
                  onClick={() => changeSubscription("resume")}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {cancelBusy ? "Working…" : "Resume subscription"}
                </button>
              ) : (
                (usage.subscription.state === "active" || usage.subscription.state === "trialing") && (
                  <button
                    type="button"
                    disabled={cancelBusy}
                    onClick={() => {
                      if (
                        window.confirm(
                          usage.subscription?.state === "trialing"
                            ? "Cancel your trial? You keep access until it ends and are never charged."
                            : "Cancel your subscription? Access continues until the end of the period you paid for, and nothing further is charged.",
                        )
                      ) {
                        changeSubscription("cancel");
                      }
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-rose-500 hover:text-rose-400 disabled:opacity-50"
                  >
                    {cancelBusy ? "Working…" : "Cancel subscription"}
                  </button>
                )
              ))}
          </div>
        )}

        {/* Seat picker.

            The panel had a seatCount state with no way to change it, so
            every quote and every order was for exactly one seat regardless
            of team size — the single most expensive kind of silent bug on
            a billing page. */}
        <div className="mb-6 rounded-xl border border-border bg-background/40 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="block text-xs font-semibold text-muted-foreground">
                How many seats?
              </span>
              <p className="mt-1 text-[11px] text-muted-foreground">
                One seat per person who can log in. You have {memberFloor}{" "}
                {memberFloor === 1 ? "member" : "members"}, so seats cannot go
                below that.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSeats(seats - 1)}
                disabled={seats <= seatFloor}
                aria-label="Remove a seat"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min={seatFloor}
                max={MAX_SEATS}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                aria-label="Number of seats"
                className="h-9 w-20 rounded-lg border border-border bg-card text-center text-sm font-bold text-foreground focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSeats(seats + 1)}
                disabled={seats >= MAX_SEATS}
                aria-label="Add a seat"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <input
            type="range"
            min={seatFloor}
            max={Math.max(seatFloor + 1, 50)}
            value={Math.min(seats, Math.max(seatFloor + 1, 50))}
            onChange={(e) => setSeats(Number(e.target.value))}
            aria-label="Seat slider"
            className="mt-4 w-full accent-primary"
          />

          {/* Coupon. Validity is judged only by the server at checkout, so
              a bad code costs one click, not a stale client-side "applied!"
              badge that checkout then contradicts. */}
          <div className="mt-4 flex items-center gap-2">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Coupon code (optional)"
              maxLength={32}
              className="h-9 w-52 rounded-lg border border-border bg-card px-3 text-xs font-semibold uppercase tracking-wide text-foreground placeholder:normal-case placeholder:font-normal placeholder:tracking-normal focus:border-primary focus:outline-none"
            />
            {couponCode && (
              <span className="text-[11px] text-muted-foreground">
                Applied at checkout — the payment page shows the discounted amount.
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border/60 pt-4">
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                {billingCycle === "annual" ? "Billed today (12 months)" : "Billed monthly"}
              </span>
              <span className="text-2xl font-black text-foreground">
                ₹{(billedNowPaise / 100).toLocaleString("en-IN")}
              </span>
              <span className="ml-1 text-[10px] text-muted-foreground">incl. GST</span>
              {bill && (
                <span className="block text-[11px] text-muted-foreground">
                  ₹{(bill.basePaise / 100).toLocaleString("en-IN")} + ₹
                  {(bill.gstPaise / 100).toLocaleString("en-IN")} GST (18%)
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="block text-[11px] text-muted-foreground">
                ₹{seatRate(BUSINESS_PLAN, billingCycle).toLocaleString()} × {seats}{" "}
                {seats === 1 ? "seat" : "seats"}
                {billingCycle === "annual" ? " × 12 months" : " per month"}
              </span>
              {billingCycle === "monthly" ? (
                <span className="block text-[11px] font-semibold text-emerald-500">
                  Save {annualSavingPercent(BUSINESS_PLAN)}% by paying annually
                </span>
              ) : (
                <span className="block text-[11px] text-muted-foreground">
                  Works out to ₹
                  {monthlyTotal(BUSINESS_PLAN, seats, "annual").toLocaleString()}/month
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {PLANS.filter((p) => p.id !== "free").map((plan) => {
            const isCurrent = usage?.planId === plan.id;
            const isCustom = plan.id === "custom";
            const isAnnual = billingCycle === "annual";
            const rate = seatRate(plan, isAnnual ? "annual" : "monthly");
            const price = isCustom ? "Custom" : `₹${rate.toLocaleString()}`;
            const periodLabel = isCustom ? "" : "/user/mo";

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl p-5 border transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card/20 hover:border-border"
                }`}
              >
                {plan.isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full">
                    RECOMMENDED
                  </div>
                )}

                <div className="mb-4">
                  <span className="text-sm font-extrabold text-foreground">{plan.name}</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-foreground">{price}</span>
                    <span className="text-muted-foreground text-[10px]">{periodLabel}</span>
                  </div>
                  {!isCustom && (
                    <span className="text-[9px] text-muted-foreground block">
                      {plan.pricePerSeatMonthly > 0
                        ? `₹${monthlyTotal(plan, seats, isAnnual ? "annual" : "monthly").toLocaleString()}/mo for ${seats} seat${seats === 1 ? "" : "s"}`
                        : "Free while you trial"}
                      {" (excl. GST)"}
                    </span>
                  )}
                </div>

                <ul className="space-y-1.5 mb-6 flex-1">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[11px] text-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isCurrent || isUpgrading !== null}
                  onClick={() => handleUpgrade(plan)}
                  className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                    isCurrent
                      ? "bg-muted text-muted-foreground cursor-default"
                      : plan.isRecommended
                      ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                      : "border border-border text-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" /> Current Plan
                    </>
                  ) : isUpgrading === plan.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Upgrading...
                    </>
                  ) : isCustom ? (
                    "Contact Sales"
                  ) : (
                    <>
                      Upgrade Now <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
