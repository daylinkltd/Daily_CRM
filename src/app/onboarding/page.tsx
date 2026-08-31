"use client";

import { useEffect, useState, startTransition } from "react";
import { BRAND } from "@/config/brand";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { PLANS, billBreakdown, seatRate, type BillingPeriod } from "@/config/plans";
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
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { INDUSTRY_TEMPLATES } from "@/app/(dashboard)/settings/retail/page";
import {
  ModulePicker,
  initialSelection,
  type ModuleSelection,
} from "@/components/workspace/module-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";

function OnboardingInner() {
  const { user, profile, signOut } = useAuth();
  const { workspaces, createWorkspace, refreshWorkspaces, loading: wsLoading } = useWorkspace();
  const router = useRouter();
  const supabase = createClient();

  // Step state
  const [step, setStep] = useState(1);

  // Form states
  const [fullName, setFullName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>("free");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  // Seats to buy. Seeded from the pricing-page calculator when the visitor
  // came through it, adjustable here because the team size decision is
  // real at onboarding time — this is when they know who is joining.
  const [seatCount, setSeatCount] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedIndustryTemplate, setSelectedIndustryTemplate] = useState("GENERAL_RETAIL");
  // Which modules this business will actually use. Asked here rather
  // than left to discovery: a new customer who lands in a sidebar full
  // of tools for other people's businesses concludes the product is for
  // other people.
  const [moduleSelection, setModuleSelection] = useState<ModuleSelection>(() =>
    initialSelection("GENERAL_RETAIL"),
  );
  const [currency, setCurrency] = useState("INR");
  const [submitting, setSubmitting] = useState(false);

  // Action states
  const [loading, setLoading] = useState(false);

  // Load pre-filled name from profile
  useEffect(() => {
    if (profile?.full_name && !fullName) {
      setFullName(profile.full_name);
    }
  }, [profile, fullName]);
  const [, setIsUploading] = useState(false);

  // Restore choices carried from /pricing (plan, cycle, seat count)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPlan = localStorage.getItem("crm_onboarding_plan");
      const savedCycle = localStorage.getItem("crm_onboarding_billing_cycle") as
        | "monthly"
        | "annual"
        | null;
      if (savedPlan && PLANS.some((p) => p.id === savedPlan)) {
        setSelectedPlan(savedPlan);
      }
      if (savedCycle === "monthly" || savedCycle === "annual") {
        setBillingCycle(savedCycle);
      }
      const savedSeats = Number(localStorage.getItem("crm_onboarding_seats"));
      if (Number.isInteger(savedSeats) && savedSeats >= 1 && savedSeats <= 500) {
        setSeatCount(savedSeats);
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
    if (wsLoading) return;
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
  }, [workspaces, wsLoading, user, router]);

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

      // Record the module selection immediately, so the very first
      // sidebar they see is already theirs. A failure here is not fatal:
      // the workspace exists, and the selection is changeable in
      // Settings → Modules, which is where the picker told them to go.
      const { error: moduleError } = await supabase.rpc("set_workspace_modules", {
        p_workspace: workspaceId,
        p_modules: moduleSelection.modules,
        p_business_type: moduleSelection.businessType,
        p_team_size: moduleSelection.teamSize,
      });
      if (moduleError) {
        console.warn("[onboarding] module selection did not save:", moduleError.message);
      }

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
      localStorage.removeItem("crm_onboarding_seats");

      // 4. Two honest paths from the plan step, both carrying the chosen
      // seat count:
      //
      //   Business  → the payment gateway now. Someone who clicked the
      //               paid card said "charge me"; not charging them was
      //               reported as a bug, because it is one.
      //   Free Trial → 14 days of the full product for those seats, no
      //               card. When it ends, the pay-now banner asks for
      //               payment for the SAME seat count they trialled.
      if (selectedPlan === "business") {
        const period: BillingPeriod = billingCycle === "annual" ? "annual" : "monthly";
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            plan_id: "business",
            seats: seatCount,
            period,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.redirect_url) {
          throw new Error(json.error || "Could not start checkout.");
        }
        // Checkout is hosted on daylink.in (the only Razorpay-registered
        // domain); the buyer returns to /billing/callback, which verifies
        // and activates. The workspace we just created is safe either way.
        window.location.href = json.redirect_url;
        return;
      }

      const trialRes = await fetch("/api/billing/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, seats: seatCount }),
      });
      if (!trialRes.ok) {
        const payload = await trialRes.json().catch(() => ({}));
        // Not fatal: the workspace exists and falls back to the legacy
        // created_at + 14-day trial window. Log rather than strand a
        // brand-new user on the onboarding screen.
        console.error("Trial setup failed:", payload.error);
      }
      toast.success("Your 14-day trial has started — every module is unlocked.");
      // Full navigation rather than router.push: the workspace context
      // must remount to pick up the fresh workspace + trial state.
      window.location.href = "/dashboard";
      return;
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
    <div className="min-h-screen bg-muted flex flex-col items-center justify-center p-6 relative overflow-hidden text-foreground">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Ambient backgrounds */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="w-full max-w-4xl flex flex-col items-center relative z-10">
        {/* Header Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Image src="/logolight.png" alt="Dailybuz" width={160} height={40} className="h-9 w-auto object-contain" />
        </div>

        {/* Wizard Progress Steps Bar */}
        <div className="w-full max-w-md flex items-center justify-between mb-8 text-xs font-semibold text-muted-foreground">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-primary" : ""}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border text-[10px] ${step >= 1 ? "border-primary bg-primary/15" : "border-border"}`}>1</span>
            Profile
          </div>
          <div className="h-px bg-muted flex-1 mx-3" />
          <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-primary" : ""}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border text-[10px] ${step >= 2 ? "border-primary bg-primary/15" : "border-border"}`}>2</span>
            Plan selection
          </div>
          <div className="h-px bg-muted flex-1 mx-3" />
          <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-primary" : ""}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border text-[10px] ${step >= 3 ? "border-primary bg-primary/15" : "border-border"}`}>3</span>
            Workspace setup
          </div>
        </div>

        {/* Wizard Step Forms */}
        <div className="w-full bg-muted/60 border border-border/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 shadow-2xl">
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-6 max-w-md mx-auto">
              <div className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-4 text-primary">
                  <User className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Set up your profile name</h1>
                <p className="text-muted-foreground text-xs mt-1">Let your team members know who you are.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-foreground text-xs font-semibold">Your full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={user?.user_metadata?.full_name || profile?.full_name || "Your full name"}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-muted border-border text-foreground h-10 rounded-xl focus:border-primary"
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
                <h1 className="text-xl font-bold text-foreground tracking-tight">Choose your team size</h1>
                <p className="text-muted-foreground text-xs mt-1">Every workspace starts with a 14-day free trial of the full product — no card required. Pay only when you decide to stay; 18% GST is added at checkout.</p>

                {/* Billing cycle toggle */}
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      billingCycle === "monthly"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground bg-muted border border-border"
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
                        : "text-muted-foreground hover:text-foreground bg-muted border border-border"
                    }`}
                  >
                    Annual
                    <span className="absolute -top-3 -right-6 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded-full uppercase tracking-wider scale-90">
                      2 Months Free
                    </span>
                  </button>
                </div>
              </div>

              {/* Seat picker — the price is per seat, so the seat count is
                  part of choosing a plan, not an afterthought in settings. */}
              <div className="mx-auto mb-6 flex max-w-md items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-5 py-4">
                <div>
                  <span className="block text-xs font-bold text-foreground">How many people?</span>
                  <span className="block text-[10px] text-muted-foreground">
                    One seat per person who signs in. Add more anytime.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSeatCount((n) => Math.max(1, n - 1))}
                    disabled={seatCount <= 1}
                    aria-label="Remove a seat"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:border-primary disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-black text-foreground">{seatCount}</span>
                  <button
                    type="button"
                    onClick={() => setSeatCount((n) => Math.min(500, n + 1))}
                    aria-label="Add a seat"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:border-primary"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Plans pricing grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  const isFree = plan.pricePerSeatMonthly === 0;
                  const isCustom = plan.pricePerSeatMonthly === -1;
                  const rate = seatRate(plan, billingCycle === "annual" ? "annual" : "monthly");
                  const displayPrice = isFree
                    ? "₹0"
                    : isCustom
                    ? "Custom"
                    : `₹${rate.toLocaleString()}`;
                  const periodLabel = isFree ? "/14 days" : isCustom ? "" : "/user/mo";

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative flex flex-col rounded-2xl p-4 border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xl shadow-primary/5"
                          : "border-border bg-muted/40 hover:border-border"
                      }`}
                    >
                      {plan.isRecommended && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full">
                          POPULAR
                        </div>
                      )}

                      <div className="mb-4">
                        <span className="text-xs font-extrabold text-foreground block">{plan.name}</span>
                        <div className="flex items-baseline gap-0.5 mt-1">
                          <span className="text-lg font-black text-foreground">{displayPrice}</span>
                          <span className="text-muted-foreground text-[10px]">{periodLabel}</span>
                        </div>
                        {!isFree && !isCustom && (
                          <span className="text-[9px] text-muted-foreground block leading-tight">
                            {billingCycle === "annual"
                              ? "billed annually"
                              : `₹${plan.pricePerSeatAnnual.toLocaleString()}/user/mo billed annually`}
                          </span>
                        )}
                      </div>

                      <ul className="space-y-1.5 mb-4 flex-1">
                        {plan.features.slice(0, 3).map((f) => (
                          <li key={f} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                            <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex justify-center mt-2">
                        <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? "border-primary bg-primary" : "border-border"}`}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
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
                  className="w-1/2 border border-border text-muted-foreground hover:text-foreground"
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
            // Wider than the other steps: the module cards are a grid, and
            // at max-w-md they collapse to one cramped column.
            <form onSubmit={handleOnboardingComplete} className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-4 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Create your workspace</h1>
                <p className="text-muted-foreground text-xs mt-1">Configure company name and brand identity.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName" className="text-foreground text-xs font-semibold">Company / Workspace Name</Label>
                  <Input
                    id="orgName"
                    type="text"
                    placeholder="e.g. Acme Sales Corp"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="bg-muted border-border text-foreground h-10 rounded-xl focus:border-primary"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground text-xs font-semibold">Workspace Logo (Optional)</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0 relative">
                      {logoPreview ? (
                        <Image src={logoPreview} alt="Logo preview" fill className="object-cover" />
                      ) : (
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Label
                        htmlFor="logoFile"
                        className="inline-flex items-center gap-2 border border-border bg-muted/60 text-foreground hover:text-foreground px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
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
                      <span className="block text-[10px] text-muted-foreground mt-1.5">Max size 2MB (PNG, JPG, SVG)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industryTemplate" className="text-foreground text-xs font-semibold">Business Industry Preset</Label>
                  {/* The system's searchable dropdown, same as everywhere
                      else a list is longer than a glance. One-value-in,
                      one-value-out, so it replaced the native select
                      without touching the surrounding state. */}
                  <SearchableSelect
                    ariaLabel="Business industry preset"
                    options={INDUSTRY_TEMPLATES.map((tmpl) => ({
                      value: tmpl.id,
                      label: tmpl.label,
                      hint: tmpl.desc,
                    }))}
                    value={selectedIndustryTemplate}
                    onChange={(v) => setSelectedIndustryTemplate(v ?? "GENERAL_RETAIL")}
                    placeholder="Pick your industry"
                    searchPlaceholder="Type to search industries…"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed bg-muted/50 p-2.5 rounded-xl border border-border/60">
                    <strong>Preset Features:</strong> {INDUSTRY_TEMPLATES.find(t => t.id === selectedIndustryTemplate)?.desc}
                  </p>
                </div>
              </div>

              {/* Which modules this business will use. Deliberately the
                  same component as the create-workspace dialog and
                  Settings → Modules, so the recommendation someone sees
                  here is the one they see when they revisit it. */}
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <ModulePicker value={moduleSelection} onChange={setModuleSelection} />
              </div>

              {/* Selected Plan limits summary card */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs">
                <span className="font-bold text-primary flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Selected plan benefits ({activePlanConfig.name})
                  {activePlanConfig.pricePerSeatMonthly > 0 && (
                    <span className="ml-auto text-[11px] font-bold text-foreground">
                      {(() => {
                        const bill = billBreakdown(
                          activePlanConfig,
                          seatCount,
                          billingCycle === "annual" ? "annual" : "monthly",
                        );
                        return bill
                          ? `₹${(bill.totalPaise / 100).toLocaleString("en-IN")} ${billingCycle === "annual" ? "/year" : "/month"} for ${seatCount} seat${seatCount === 1 ? "" : "s"}, incl. GST`
                          : null;
                      })()}
                    </span>
                  )}
                </span>
                <ul className="space-y-1 text-foreground">
                  <li>• Member Seats: <strong>{activePlanConfig.maxUsers === null ? "Unlimited — pay per seat" : activePlanConfig.maxUsers}</strong></li>
                  <li>• Workspaces Allowance: <strong>{activePlanConfig.maxWorkspaces === null ? "Unlimited" : activePlanConfig.maxWorkspaces}</strong></li>
                  <li>• Pooled Conversations: <strong>{activePlanConfig.monthlyMessageAllowance === null ? "Custom" : activePlanConfig.monthlyMessageAllowance.toLocaleString()}</strong>/month</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className="w-1/2 border border-border text-muted-foreground hover:text-foreground"
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
                  ) : selectedPlan === "business" ? (
                    "Continue to payment"
                  ) : (
                    "Start 14-day free trial"
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
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
      <div className="min-h-screen bg-muted flex flex-col items-center justify-center text-muted-foreground text-sm">
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
      <div className="min-h-screen bg-muted flex flex-col items-center justify-center text-muted-foreground text-sm">
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
