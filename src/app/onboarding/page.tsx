"use client";

import { useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { PLANS, Plan } from "@/config/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  User,
  CreditCard,
  Sparkles,
  Upload,
  Check,
  Loader2,
  LogOut,
  ChevronRight,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { INDUSTRY_TEMPLATES } from "@/app/(dashboard)/settings/retail/page";

function OnboardingInner() {
  const { user, profile, signOut } = useAuth();
  const { workspaces, createWorkspace, refreshWorkspaces } = useWorkspace();
  const router = useRouter();
  const supabase = createClient();

  // Step state
  const [step, setStep] = useState(1);

  // Form states
  const [fullName, setFullName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>("free");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [orgName, setOrgName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedIndustryTemplate, setSelectedIndustryTemplate] = useState("GENERAL_RETAIL");

  // Action states
  const [loading, setLoading] = useState(false);

  // Load pre-filled name from profile
  useEffect(() => {
    if (profile?.full_name && !fullName) {
      setFullName(profile.full_name);
    }
  }, [profile, fullName]);
  const [isUploading, setIsUploading] = useState(false);

  // Load pre-selected plan preference from signup step
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPlan = localStorage.getItem("crm_onboarding_plan");
      const savedCycle = localStorage.getItem("crm_onboarding_cycle");
      if (savedPlan && PLANS.some((p) => p.id === savedPlan)) {
        setSelectedPlan(savedPlan);
      }
      if (savedCycle === "monthly" || savedCycle === "annual") {
        setBillingCycle(savedCycle);
      }
    }
  }, []);

  // Sync profile full_name if user metadata has it
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user]);

  // If user already has workspaces, they shouldn't be here, redirect them to dashboard
  // If they have a pending invite token in progress, redirect them to the invitation join page.
  // Membership wins over a (possibly stale) invite token so accepted
  // members always land in their workspace's dashboard.
  useEffect(() => {
    if (workspaces.length > 0) {
      router.push("/dashboard");
      return;
    }
    // The token lives in auth user_metadata (set at signup — survives
    // the email-confirmation tab / other devices) with sessionStorage
    // as a same-tab fallback for existing accounts.
    const pendingInvite =
      (typeof user?.user_metadata?.invite_token === "string" &&
      user.user_metadata.invite_token
        ? user.user_metadata.invite_token
        : null) ??
      (typeof window !== "undefined"
        ? sessionStorage.getItem("pending_invite_token")
        : null);
    if (pendingInvite) {
      router.push(`/join/${encodeURIComponent(pendingInvite)}`);
    }
  }, [workspaces, user, router]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo file size must be less than 2MB.");
        return;
      }
      setLogoFile(file);
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    setLoading(true);
    try {
      // Save name to profiles table
      const { error } = await supabase.from("profiles").upsert(
        {
          user_id: user?.id,
          full_name: fullName.trim(),
          email: user?.email,
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile name.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = () => {
    setStep(3);
  };

  const handleOnboardingComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error("Please enter your company/organization name.");
      return;
    }

    setLoading(true);
    let workspaceId = "";

    try {
      // 1. Create workspace (defaults to 'free' Free Trial)
      const workspace = await createWorkspace(orgName.trim());
      if (!workspace || !workspace.id) {
        throw new Error("Failed to create workspace.");
      }
      workspaceId = workspace.id;

      // Save industry template settings to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(`retail_template_${workspaceId}`, selectedIndustryTemplate);
        localStorage.setItem("retail_template_active", selectedIndustryTemplate);
      }

      // 2. Upload logo to Supabase storage public bucket 'avatars'
      let uploadedLogoUrl = null;
      if (logoFile) {
        setIsUploading(true);
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `workspaces/${workspaceId}/logo-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, logoFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: logoFile.type,
          });

        if (uploadError) {
          console.warn("Logo upload failed, skipping: ", uploadError.message);
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage.from("avatars").getPublicUrl(path);
          uploadedLogoUrl = publicUrl;
        }
      }

      // 3. Update workspace details (name + logo_url) safely
      try {
        await supabase
          .from("workspaces")
          .update({
            name: orgName.trim(),
            logo_url: uploadedLogoUrl,
          })
          .eq("id", workspaceId);
      } catch (dbErr) {
        // Fallback in case logo_url migration hasn't loaded yet
        console.warn("Failed to write logo_url to workspace, skipping column: ", dbErr);
      }

      // Clean up localStorage keys
      localStorage.removeItem("crm_onboarding_plan");
      localStorage.removeItem("crm_onboarding_cycle");

      // 4. Handle subscription upgrade if paid tier was chosen
      const plan = PLANS.find((p) => p.id === selectedPlan);
      if (plan && plan.id !== "free" && plan.id !== "custom") {
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
            receipt: `rcpt_onb_${workspaceId.substring(0, 10)}`,
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
                  workspace_id: workspaceId,
                  plan_id: plan.id,
                }),
              });

              const verifyResult = await verifyRes.json();
              toast.dismiss();

              if (verifyRes.ok && verifyResult.success) {
                toast.success(`Success! Workspace upgraded to ${plan.name}.`);
                startTransition(() => {
                  refreshWorkspaces();
                  router.push("/dashboard");
                });
              } else {
                toast.error(verifyResult.error || "Failed to verify transaction signature.");
                // Let user into the free trial first
                router.push("/dashboard");
              }
            } catch (err: any) {
              toast.dismiss();
              toast.error(err.message || "Payment verification failed.");
              router.push("/dashboard");
            }
          },
          prefill: {
            name: orgName,
          },
          theme: {
            color: "#0284C7",
          },
          modal: {
            ondismiss: function () {
              toast.info("Payment checkout cancelled. Your workspace has been initialized on Free Trial tier. You can upgrade from Settings anytime.");
              router.push("/dashboard");
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        toast.success("Welcome aboard! Your workspace has been successfully created.");
        startTransition(() => {
          refreshWorkspaces();
          router.push("/dashboard");
        });
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Failed to complete onboarding.");
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  const activePlanConfig = PLANS.find((p) => p.id === selectedPlan) || PLANS[0];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden text-slate-100">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Ambient backgrounds */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="w-full max-w-4xl flex flex-col items-center relative z-10">
        {/* Header Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Image src="/logolight.png" alt="Daily CRM" width={160} height={40} className="h-9 w-auto object-contain" />
        </div>

        {/* Wizard Progress Steps Bar */}
        <div className="w-full max-w-md flex items-center justify-between mb-8 text-xs font-semibold text-slate-500">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-primary" : ""}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border text-[10px] ${step >= 1 ? "border-primary bg-primary/15" : "border-slate-800"}`}>1</span>
            Profile
          </div>
          <div className="h-px bg-slate-800 flex-1 mx-3" />
          <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-primary" : ""}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border text-[10px] ${step >= 2 ? "border-primary bg-primary/15" : "border-slate-800"}`}>2</span>
            Plan selection
          </div>
          <div className="h-px bg-slate-800 flex-1 mx-3" />
          <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-primary" : ""}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border text-[10px] ${step >= 3 ? "border-primary bg-primary/15" : "border-slate-800"}`}>3</span>
            Workspace setup
          </div>
        </div>

        {/* Wizard Step Forms */}
        <div className="w-full bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 shadow-2xl">
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-6 max-w-md mx-auto">
              <div className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-4 text-primary">
                  <User className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Set up your profile name</h1>
                <p className="text-slate-400 text-xs mt-1">Let your team members know who you are.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300 text-xs font-semibold">Your full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="e.g. Sarah Chen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-foreground h-10 rounded-xl focus:border-primary"
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !fullName.trim()}
                className="w-full bg-primary hover:bg-primary-hover text-primary-foreground h-10 rounded-xl font-bold shadow-lg shadow-primary/10 mt-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-4 text-primary">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Select your plan tier</h1>
                <p className="text-slate-400 text-xs mt-1">All plans exclude GST. Annual plans enjoy 2 months free.</p>

                {/* Billing cycle toggle */}
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      billingCycle === "monthly"
                        ? "bg-primary text-primary-foreground"
                        : "text-slate-400 hover:text-foreground bg-slate-900 border border-slate-800"
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
                        : "text-slate-400 hover:text-foreground bg-slate-900 border border-slate-800"
                    }`}
                  >
                    Annual
                    <span className="absolute -top-3 -right-6 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded-full uppercase tracking-wider scale-90">
                      2 Months Free
                    </span>
                  </button>
                </div>
              </div>

              {/* Plans pricing grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  const isFree = plan.priceMonthly === 0;
                  const isCustom = plan.priceMonthly === -1;
                  const displayPrice = isFree
                    ? "₹0"
                    : isCustom
                    ? "Custom"
                    : billingCycle === "annual"
                    ? `₹${plan.priceYearly.toLocaleString()}`
                    : `₹${plan.priceMonthly.toLocaleString()}`;
                  const periodLabel = isFree ? "/14 days" : isCustom ? "" : billingCycle === "annual" ? "/yr" : "/mo";

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative flex flex-col rounded-2xl p-4 border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xl shadow-primary/5"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                      }`}
                    >
                      {plan.isRecommended && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full">
                          POPULAR
                        </div>
                      )}

                      <div className="mb-4">
                        <span className="text-xs font-extrabold text-white block">{plan.name}</span>
                        <div className="flex items-baseline gap-0.5 mt-1">
                          <span className="text-lg font-black text-white">{displayPrice}</span>
                          <span className="text-slate-500 text-[10px]">{periodLabel}</span>
                        </div>
                        {!isFree && !isCustom && (
                          <span className="text-[9px] text-slate-500 block leading-tight">
                            {billingCycle === "annual"
                              ? `Equivalent to ₹${Math.round(plan.priceYearly / 12).toLocaleString()}/mo`
                              : `Equivalent to ₹${(plan.priceMonthly * 12).toLocaleString()}/yr`}
                          </span>
                        )}
                      </div>

                      <ul className="space-y-1.5 mb-4 flex-1">
                        {plan.features.slice(0, 3).map((f) => (
                          <li key={f} className="flex items-start gap-1 text-[10px] text-slate-400">
                            <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex justify-center mt-2">
                        <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? "border-primary bg-primary" : "border-slate-800"}`}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4 max-w-xs mx-auto mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="w-1/2 border border-slate-800 text-slate-400 hover:text-foreground"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleStep2Submit}
                  className="w-1/2 bg-primary hover:bg-primary-hover text-primary-foreground font-bold"
                >
                  Next step
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleOnboardingComplete} className="space-y-6 max-w-md mx-auto">
              <div className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-4 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Create your workspace</h1>
                <p className="text-slate-400 text-xs mt-1">Configure company name and brand identity.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName" className="text-slate-300 text-xs font-semibold">Company / Workspace Name</Label>
                  <Input
                    id="orgName"
                    type="text"
                    placeholder="e.g. Acme Sales Corp"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-foreground h-10 rounded-xl focus:border-primary"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-semibold">Workspace Logo (Optional)</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0 relative">
                      {logoPreview ? (
                        <Image src={logoPreview} alt="Logo preview" fill className="object-cover" />
                      ) : (
                        <Building2 className="h-6 w-6 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Label
                        htmlFor="logoFile"
                        className="inline-flex items-center gap-2 border border-slate-800 bg-slate-950/60 text-slate-300 hover:text-foreground px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Upload className="h-4.5 w-4.5" /> Upload Logo
                      </Label>
                      <Input
                        id="logoFile"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                      <span className="block text-[10px] text-slate-500 mt-1.5">Max size 2MB (PNG, JPG, SVG)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industryTemplate" className="text-slate-300 text-xs font-semibold">Business Industry Preset</Label>
                  <select
                    id="industryTemplate"
                    value={selectedIndustryTemplate}
                    onChange={(e) => setSelectedIndustryTemplate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl h-10 text-xs px-3 focus:border-[#00aef0] focus:ring-1 focus:ring-[#00aef0] outline-none transition-all cursor-pointer"
                  >
                    {INDUSTRY_TEMPLATES.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed bg-slate-950/50 p-2.5 rounded-xl border border-slate-900/60">
                    <strong>Preset Features:</strong> {INDUSTRY_TEMPLATES.find(t => t.id === selectedIndustryTemplate)?.desc}
                  </p>
                </div>
              </div>

              {/* Selected Plan limits summary card */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs">
                <span className="font-bold text-primary flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Selected plan benefits ({activePlanConfig.name})
                </span>
                <ul className="space-y-1 text-slate-300">
                  <li>• Member Seats: <strong>{activePlanConfig.maxUsers === 999999 ? "Unlimited" : activePlanConfig.maxUsers}</strong> users</li>
                  <li>• Workspaces Allowance: <strong>{activePlanConfig.maxWorkspaces === 999999 ? "Unlimited" : activePlanConfig.maxWorkspaces}</strong></li>
                  <li>• Monthly Messages: <strong>{activePlanConfig.monthlyMessageAllowance === 999999 ? "Unlimited" : activePlanConfig.monthlyMessageAllowance.toLocaleString()}</strong></li>
                </ul>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className="w-1/2 border border-slate-800 text-slate-400 hover:text-foreground"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !orgName.trim()}
                  className="w-1/2 bg-primary hover:bg-primary-hover text-primary-foreground font-bold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" /> Initializing...
                    </>
                  ) : selectedPlan === "free" ? (
                    "Launch Workspace"
                  ) : (
                    "Proceed to Payment"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Logout helper */}
        <div className="mt-8">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
function OnboardingPageContent() {
  const { user, loading } = useAuth();
  const { workspaces, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  // Invited users must never see the plan-selection wizard — their
  // workspace already has a plan. Resolve the pending invite token
  // from auth user_metadata (survives new tabs/devices) or the
  // same-tab sessionStorage fallback.
  const pendingInvite =
    (typeof user?.user_metadata?.invite_token === "string" &&
    user.user_metadata.invite_token
      ? user.user_metadata.invite_token
      : null) ??
    (typeof window !== "undefined"
      ? sessionStorage.getItem("pending_invite_token")
      : null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && !wsLoading && workspaces.length > 0) {
      router.push("/dashboard");
    }
  }, [user, loading, wsLoading, workspaces, router]);

  useEffect(() => {
    if (!loading && user && !wsLoading && workspaces.length === 0 && pendingInvite) {
      router.push(`/join/${encodeURIComponent(pendingInvite)}`);
    }
  }, [user, loading, wsLoading, workspaces, pendingInvite, router]);

  if (loading || wsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 text-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Loading...
      </div>
    );
  }

  if (!user) return null;
  if (workspaces.length > 0) return null;
  // Redirecting to /join — don't flash the plan-selection wizard.
  if (pendingInvite) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 text-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Taking you to your invitation...
      </div>
    );
  }

  return <OnboardingInner />;
}

export default function OnboardingPage() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <OnboardingPageContent />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
