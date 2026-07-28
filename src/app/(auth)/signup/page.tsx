"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="marketing min-h-screen bg-[var(--mkt-canvas)] flex flex-col items-center justify-center text-[var(--mkt-fg-muted)] text-sm">
        Loading signup...
      </div>
    }>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          // Persist the invite token on the auth user itself.
          // sessionStorage alone is per-tab: the email-confirmation
          // link usually opens in a NEW tab (or another device),
          // where sessionStorage is empty — which used to dump
          // invited users into the onboarding/plan-selection flow.
          // user_metadata travels with the session everywhere, so
          // the dashboard/onboarding guards can always find it.
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  const plan = searchParams.get("plan");
  const cycle = searchParams.get("cycle");

  useEffect(() => {
    if (plan) {
      localStorage.setItem("crm_onboarding_plan", plan);
    }
    if (cycle) {
      localStorage.setItem("crm_onboarding_cycle", cycle);
    }
    if (inviteToken) {
      sessionStorage.setItem("pending_invite_token", inviteToken);
    }
  }, [plan, cycle, inviteToken]);

  if (success) {
    return (
      <div className="marketing min-h-screen bg-[var(--mkt-canvas)] flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
        <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] shadow-[var(--mkt-shadow)] p-8">
          <div className="flex justify-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)]">
              <CheckCircle className="h-6 w-6 text-[var(--mkt-accent-text)]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-[var(--mkt-fg)] mb-2">Check your email</h2>
          <p className="text-[var(--mkt-fg-muted)] text-sm mb-6">
            We&apos;ve sent a confirmation link to <span className="text-[var(--mkt-fg)] font-medium">{email}</span>. Please check your inbox and click the link to verify your account.
          </p>
          <Link href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"}>
            <Button variant="outline" className="mkt-btn mkt-btn-secondary h-11 w-full text-sm">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing min-h-screen flex flex-col items-center justify-center px-4 text-center relative overflow-hidden bg-[var(--mkt-canvas)]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[140px]" />

      <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] shadow-[var(--mkt-shadow)] p-8 text-left">
        <div className="flex justify-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)]">
            <UsersRound className="h-6 w-6 text-[var(--mkt-accent-text)]" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-center mb-1 text-[var(--mkt-fg)]">
          {inviteToken ? "Create account & join" : "Create your Daily CRM account"}
        </h2>
        <p className="text-xs text-center mb-6 text-[var(--mkt-fg-muted)]">
          {inviteToken 
            ? "Verify your email, then accept the invitation to join your team."
            : "Get started with your dedicated omni-channel workspace today."}
        </p>

        {plan && (
          <div className="mb-4 rounded-lg px-3 py-2 text-center text-xs font-semibold capitalize border border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)] text-[var(--mkt-accent-text)]">
            Registering for {plan} plan ({cycle || "monthly"})
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-medium text-[var(--mkt-fg-muted)]">Full name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mkt-field h-10 border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg)]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-[var(--mkt-fg-muted)]">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mkt-field h-10 border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg)]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-[var(--mkt-fg-muted)]">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mkt-field h-10 border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg)]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-medium text-[var(--mkt-fg-muted)]">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mkt-field h-10 border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg)]"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mkt-btn mkt-btn-primary mt-2 h-11 w-full text-sm disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--mkt-fg-subtle)]">
          Already have an account?{" "}
          <Link href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"} className="hover:underline font-medium text-[var(--mkt-accent-text)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
