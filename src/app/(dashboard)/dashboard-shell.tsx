"use client";

import { useCallback, useEffect, useState, Suspense, startTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PLANS } from "@/config/plans";
import { AlertTriangle, Check, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { workspaces, activeWorkspace, loading: wsLoading, refreshWorkspaces } = useWorkspace();
  const router = useRouter();

  // Sidebar drawer state — only used on mobile. On lg+ the sidebar is
  // always visible and this stays at `false` (ignored by the component).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Lockout states
  const [selectedPlan, setSelectedPlan] = useState<string>("growth");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [upgrading, setUpgrading] = useState(false);

  // Check if free trial has expired
  const isTrialExpired =
    activeWorkspace?.plan === "free" &&
    activeWorkspace?.created_at &&
    Date.now() - new Date(activeWorkspace.created_at).getTime() > 14 * 24 * 60 * 60 * 1000;

  const handleUpgrade = async () => {
    if (!activeWorkspace) return;
    const plan = PLANS.find((p) => p.id === selectedPlan);
    if (!plan || plan.id === "free" || plan.id === "custom") return;

    setUpgrading(true);
    try {
      const isAnnual = billingCycle === "annual";
      const price = isAnnual ? plan.priceYearly : plan.priceMonthly;
      const amountPaise = price * 100;

      toast.loading("Preparing payment window...");

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `rcpt_lock_${activeWorkspace.id.substring(0, 10)}`,
        }),
      });

      const orderResult = await orderRes.json();
      toast.dismiss();

      if (!orderRes.ok || !orderResult.order_id) {
        throw new Error(orderResult.error || "Failed to initialize payment gateway order.");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TEus8m7ilDoAio",
        amount: orderResult.amount,
        currency: orderResult.currency,
        name: "Daily CRM",
        description: `${plan.name} Tier Upgrade (${isAnnual ? "Annual" : "Monthly"})`,
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
            toast.info("Payment checkout cancelled.");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Failed to trigger checkout.");
    } finally {
      setUpgrading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pendingInvite = sessionStorage.getItem("pending_invite_token");
      if (pendingInvite) {
        router.push(`/join/${encodeURIComponent(pendingInvite)}`);
        return;
      }
    }
    if (!loading && !user) {
      router.push("/login");
    } else if (!loading && user && !wsLoading && workspaces.length === 0) {
      router.push("/onboarding");
    }
  }, [user, loading, wsLoading, workspaces, router]);

  if (loading || wsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00aef0] border-t-transparent" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (isTrialExpired) {
    const activePlanConfig = PLANS.find((p) => p.id === selectedPlan) || PLANS[1];
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden text-slate-100">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-red-500/5 blur-[120px]" />

        <div className="w-full max-w-4xl flex flex-col items-center relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Free Trial Expired</h1>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Your 14-day free trial has expired. Upgrade your workspace plan to unlock the dashboard and resume customer engagement.
            </p>
          </div>

          <div className="w-full bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-800/80 pb-6 mb-6 gap-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Workspace</span>
                <h3 className="text-lg font-bold text-white">{activeWorkspace?.name || "My Workspace"}</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    billingCycle === "monthly"
                      ? "bg-[#00aef0] text-white"
                      : "text-slate-400 hover:text-white bg-slate-950 border border-slate-800"
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
                      : "text-slate-400 hover:text-white bg-slate-950 border border-slate-800"
                  }`}
                >
                  Annual
                  <span className="absolute -top-3 -right-6 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded-full uppercase tracking-wider scale-90">
                    2 Months Free
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {PLANS.filter((p) => p.id !== "free" && p.id !== "custom").map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const price = billingCycle === "annual" ? plan.priceYearly : plan.priceMonthly;
                const displayPrice = `₹${price.toLocaleString()}`;
                const periodLabel = billingCycle === "annual" ? "/yr" : "/mo";

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative flex flex-col rounded-2xl p-4 border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "border-[#00aef0] bg-[#00aef0]/5 shadow-xl shadow-[#00aef0]/5"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                    }`}
                  >
                    {plan.isRecommended && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#00aef0] text-white text-[9px] font-bold rounded-full">
                        RECOMMENDED
                      </div>
                    )}
                    <span className="text-xs font-extrabold text-white block">{plan.name}</span>
                    <div className="flex items-baseline gap-0.5 mt-1 mb-4">
                      <span className="text-lg font-black text-white">{displayPrice}</span>
                      <span className="text-slate-500 text-[10px]">{periodLabel}</span>
                    </div>

                    <ul className="space-y-1.5 flex-1 mb-4">
                      {plan.features.slice(0, 3).map((f) => (
                        <li key={f} className="flex items-start gap-1 text-[10px] text-slate-400">
                          <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex justify-center mt-2">
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? "border-[#00aef0] bg-[#00aef0]" : "border-slate-800"}`}>
                        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="w-full bg-[#00aef0] hover:bg-[#008ec4] text-white h-11 rounded-xl font-bold text-sm"
            >
              {upgrading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Initializing Upgrade Checkout...
                </>
              ) : (
                `Upgrade & Unlock (${activePlanConfig.name})`
              )}
            </Button>
          </div>

          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {/* Thinner horizontal padding on mobile so cards have room to breathe. */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-transparent">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00aef0] border-t-transparent" />
                  <p className="text-sm text-slate-400">Loading section...</p>
                </div>
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <DashboardShellInner>{children}</DashboardShellInner>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
