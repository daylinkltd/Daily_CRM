"use client";

import { useEffect, useState, startTransition } from "react";
import Script from "next/script";
import { PLANS, Plan } from "@/config/plans";
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

    const isAnnual = billingCycle === "annual";
    const price = isAnnual ? plan.priceYearly : plan.priceMonthly;
    const amountPaise = price * 100;

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
        name: "Daily CRM",
        description: `Upgrade to ${plan.name} Plan (${isAnnual ? "Annual" : "Monthly"})`,
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
          color: "#00aef0",
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
      <div className="flex h-[350px] items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#00aef0]" />
          <span className="text-sm text-slate-400">Loading plan subscription details...</span>
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
      <div className="relative rounded-2xl border border-[#00aef0]/20 bg-gradient-to-br from-[#00aef0]/5 via-slate-950/60 to-slate-950 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#00aef0]/15 px-3 py-1 text-xs font-semibold text-[#00aef0]">
                Active Plan
              </span>
              {usage?.isTrial && (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> 14-day Trial
                </span>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">{currentPlan.name} Tier</h2>
            <p className="mt-1 text-xs text-slate-400">
              Workspace subscription handles routing and resource quotas for your team.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 block">Pricing Plan Cost</span>
            <span className="text-2xl font-black text-white">
              {currentPlan.priceMonthly === 0 ? "₹0" : currentPlan.priceMonthly === -1 ? "Custom" : `₹${currentPlan.priceMonthly.toLocaleString()}/mo`}
            </span>
            <span className="text-[10px] text-slate-500 block">excl. GST</span>
          </div>
        </div>
      </div>

      {/* Plan Usage Limits Progress Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Outbound messages */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs text-slate-400 font-semibold block">Monthly Messages</span>
              <span className="text-lg font-black text-white">
                {totalMessages.toLocaleString()} / {maxMessages === 999999 ? "∞" : maxMessages.toLocaleString()}
              </span>
            </div>
            {msgPercent >= 80 && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${msgPercent >= 100 ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"}`}>
                {msgPercent >= 100 ? "Limit Reached" : "80% Warning"}
              </span>
            )}
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                msgPercent >= 100 ? "bg-red-500" : msgPercent >= 80 ? "bg-amber-500" : "bg-[#00aef0]"
              }`}
              style={{ width: `${msgPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 block mt-2">
            {usage?.isTrial ? "Allowance covers trial period." : "Resets monthly on 1st."} WhatsApp template charges separate.
          </span>
        </div>

        {/* Team Members */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs text-slate-400 font-semibold block">Team Members</span>
              <span className="text-lg font-black text-white">
                {totalMembers} / {maxMembers === 999999 ? "Unlimited" : maxMembers}
              </span>
            </div>
            {membersPercent >= 100 && maxMembers !== 999999 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500">
                Max Users
              </span>
            )}
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-[#00aef0] transition-all duration-500"
              style={{ width: `${maxMembers === 999999 ? 100 : membersPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 block mt-2">
            Max members allowed to join this workspace.
          </span>
        </div>

        {/* Workspaces */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs text-slate-400 font-semibold block">Workspaces</span>
              <span className="text-lg font-black text-white">
                {totalWorkspaces} / {maxWorkspaces === 999999 ? "Unlimited" : maxWorkspaces}
              </span>
            </div>
            {workspacesPercent >= 100 && maxWorkspaces !== 999999 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500">
                Limit Reached
              </span>
            )}
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-[#00aef0] transition-all duration-500"
              style={{ width: `${maxWorkspaces === 999999 ? 100 : workspacesPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 block mt-2">
            Number of team workspaces you can build.
          </span>
        </div>
      </div>

      {/* Upgrade Options Section */}
      <div className="border-t border-slate-800/60 pt-8">
        <div className="text-center mb-6">
          <h3 className="text-lg font-extrabold text-white">Upgrade Workspace Plan</h3>
          <p className="text-slate-400 text-xs mt-1">Unlock larger allowances and multi-agent automations.</p>

          {/* Pricing Toggle */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                billingCycle === "monthly"
                  ? "bg-[#00aef0] text-white"
                  : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors relative ${
                billingCycle === "annual"
                  ? "bg-[#00aef0] text-white"
                  : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
              }`}
            >
              Annual
              <span className="absolute -top-3 -right-6 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded-full uppercase tracking-wider scale-90">
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
            const price = isCustom
              ? "Custom"
              : isAnnual
              ? `₹${plan.priceYearly.toLocaleString()}`
              : `₹${plan.priceMonthly.toLocaleString()}`;
            const periodLabel = isCustom ? "" : isAnnual ? "/yr" : "/mo";

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl p-5 border transition-all ${
                  isCurrent
                    ? "border-[#00aef0] bg-[#00aef0]/5"
                    : "border-slate-800 bg-slate-900/20 hover:border-slate-700"
                }`}
              >
                {plan.isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-[#00aef0] text-white text-[9px] font-bold rounded-full">
                    RECOMMENDED
                  </div>
                )}

                <div className="mb-4">
                  <span className="text-sm font-extrabold text-white">{plan.name}</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-white">{price}</span>
                    <span className="text-slate-500 text-[10px]">{periodLabel}</span>
                  </div>
                  {!isCustom && (
                    <span className="text-[9px] text-slate-500 block">
                      {isAnnual
                        ? `Equivalent to ₹${Math.round(plan.priceYearly / 12).toLocaleString()}/mo`
                        : `Equivalent to ₹${(plan.priceMonthly * 12).toLocaleString()}/yr`}
                      {" (excl. GST)"}
                    </span>
                  )}
                </div>

                <ul className="space-y-1.5 mb-6 flex-1">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[11px] text-slate-300">
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
                      ? "bg-slate-800 text-slate-400 cursor-default"
                      : plan.isRecommended
                      ? "bg-[#00aef0] text-white hover:bg-[#008ec4]"
                      : "border border-slate-700 text-slate-200 hover:border-slate-600 hover:text-white"
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
