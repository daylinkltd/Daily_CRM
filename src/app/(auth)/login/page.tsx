"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle, MonitorSmartphone, Sparkles } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="marketing min-h-screen bg-[var(--mkt-canvas)] flex flex-col items-center justify-center text-[var(--mkt-fg-muted)] text-sm">
        Loading login...
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const inviteToken = searchParams.get("invite");

  const signedOutReason =
    searchParams.get("reason") === "signed-in-elsewhere"
      ? "You were signed out because your account was used to sign in on another device. Only one device can be signed in at a time."
      : searchParams.get("error");

  useEffect(() => {
    if (inviteToken) {
      sessionStorage.setItem("pending_invite_token", inviteToken);
    }
  }, [inviteToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (inviteToken) {
        router.push(`/join/${encodeURIComponent(inviteToken)}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.warn("[Auth] Supabase signIn failed:", err);
      setError(
        err?.message === "Failed to fetch"
          ? "Unable to reach Supabase authentication server. You can click 'Demo Access' below to explore the modules."
          : err?.message || "Sign in failed. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <div className="marketing flex min-h-screen items-center justify-center bg-[var(--mkt-canvas)] px-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[160px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/4 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logolight.png"
            alt="Dailybiz"
            width={240}
            height={80}
            className="h-16 sm:h-20 w-auto object-contain"
            priority
          />
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] shadow-[var(--mkt-shadow)] p-8">
          <div className="mb-6">
            <h1 className="text-lg font-semibold tracking-tight text-[var(--mkt-fg)]">
              Welcome back
            </h1>
            <p className="text-sm mt-1 text-[var(--mkt-fg-muted)]">
              Sign in to your Dailybiz workspace
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {signedOutReason && !error && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2.5">
                <MonitorSmartphone className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{signedOutReason}</span>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-sm font-medium text-[var(--mkt-fg-muted)]">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mkt-field h-11 border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg)]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-[var(--mkt-fg-muted)]">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[var(--mkt-accent-text)] transition-colors hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mkt-field h-11 pr-11 border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-[var(--mkt-fg-subtle)] transition-colors hover:text-[var(--mkt-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mkt-accent-text)]"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mkt-btn mkt-btn-primary mt-1 h-12 w-full text-sm disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </Button>

            {/* Direct Demo / Workspace access button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/social/overview")}
              className="h-11 w-full text-xs font-bold gap-2 border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] hover:bg-[var(--mkt-surface)] text-[var(--mkt-fg)]"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Explore Social Media Module (Demo Access)
            </Button>
          </form>

          {/* Invite-only note instead of signup link */}
          <div className="mt-7 pt-6 border-t border-[var(--mkt-line-soft)] text-center">
            <p className="text-xs text-[var(--mkt-fg-subtle)]">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-[var(--mkt-fg-muted)] underline underline-offset-4 transition-colors hover:text-[var(--mkt-fg)]"
              >
                Request access
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[var(--mkt-fg-subtle)]">
          © {new Date().getFullYear()} Daylink. All rights reserved.
        </p>
      </div>
    </div>
  );
}
