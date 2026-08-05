"use client";

import { useEffect, useState, startTransition } from "react";
import Script from "next/script";
import { PLANS, Plan, chargeablePaise, seatRate, monthlyTotal, type BillingPeriod } from "@/config/plans";
import { useWorkspace } from "@/hooks/use-workspace";
import { Check, AlertTriangle, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
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
}

export function BillingPanel() {
  const { activeWorkspace, refreshWorkspaces, activeRole } = useWorkspace();
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  // Seats are the unit of pricing. Defaults to the workspace's current
  // member count so the common case needs no thought.
  const [seatCount, setSeatCount] = useState<number>(1);
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);

  const fetchUsage = async () => {
    if (!activeWorkspace?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/workspace/usage?workspace_id=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
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
    // Bill for the seats the workspace actually has. The server recomputes
    // this from the same helper and rejects any mismatch.
    const seats = Math.max(seatCount, plan.minSeats);
    const amountPaise = chargeablePaise(plan, seats, period);
    if (amountPaise === null) {
      toast.error("That plan can't be purchased online — please contact us.");
      return;
    }

    try {
      setIsUpgrading(plan.id);
      toast.loading("Initializing secure payment order...");

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `rcpt_${activeWorkspace.id.substring(0, 10)}`,
        }),
      });

      const orderResult = await orderRes.json();
      toast.dismiss();

      if (!orderRes.ok || !orderResult.order_id) {
        throw new Error(orderResult.error || "Failed to initialize payment order.");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TEus8m7ilDoAio",
        amount: orderResult.amount,
        currency: orderResult.currency,
        name: "Dailybuz",
        description: `${plan.name} — ${seats} seat${seats === 1 ? "" : "s"} (${period === "annual" ? "Annual" : "Monthly"})`,
        order_id: orderResult.order_id,
        handler: async function (response: any) {
          try {
            toast.loading("Verifying payment transaction...");
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                workspace_id: activeWorkspace.id,
                plan_id: plan.id,
                seats,
                period,
              }),
            });

            const verifyResult = await verifyRes.json();
            toast.dismiss();

            if (verifyRes.ok && verifyResult.success) {
              toast.success(`Success! Workspace upgraded to ${plan.name}.`);
              startTransition(() => {
                refreshWorkspaces();
                fetchUsage();
              });
            } else {
              toast.error(verifyResult.error || "Failed to verify transaction signature.");
            }
          } catch (err: any) {
            toast.dismiss();
            toast.error(err.message || "Payment verification failed.");
          }
        },
        prefill: {
          name: activeWorkspace.name,
        },
        theme: {
          color: "#0284C7",
        },
        modal: {
          ondismiss: function () {
            toast.error("Checkout cancelled.");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Checkout failed to initialize.");
    } finally {
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
  const maxMembers = usage?.maxUsers || 2;
  const membersPercent = Math.min(Math.round((totalMembers / maxMembers) * 100), 100);

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
                {totalMembers} / {maxMembers === 999999 ? "Unlimited" : maxMembers}
              </span>
            </div>
            {membersPercent >= 100 && maxMembers !== 999999 && (
              <span className="px-2 py-0.5 rounded-none text-[10px] font-bold bg-amber-500/15 text-amber-500">
                Max Users
              </span>
            )}
          </div>
          <div className="w-full bg-card rounded-full h-2">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${maxMembers === 999999 ? 100 : membersPercent}%` }}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        ? `₹${monthlyTotal(plan, seatCount, isAnnual ? "annual" : "monthly").toLocaleString()}/mo for ${seatCount} seat${seatCount === 1 ? "" : "s"}`
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
