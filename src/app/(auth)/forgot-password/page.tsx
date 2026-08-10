"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, ArrowLeft, Mail, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="marketing flex min-h-screen items-center justify-center bg-[var(--mkt-canvas)] px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logolight.png"
            alt="Dailybiz"
            width={160}
            height={40}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>

        <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] shadow-[var(--mkt-shadow)] p-8">
          {success ? (
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/40 mb-5">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <h1 className="text-lg font-semibold text-[var(--mkt-fg)] mb-2">Check your inbox</h1>
              <p className="text-[var(--mkt-fg-muted)] text-sm mb-6">
                We&apos;ve sent a password reset link to{" "}
                <span className="text-[var(--mkt-fg)] font-medium">{email}</span>.
              </p>
              <Link href="/login">
                <Button className="mkt-btn mkt-btn-primary h-11 w-full text-sm">
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--mkt-accent-soft)] border border-[var(--mkt-accent-line)] mb-4">
                  <Mail className="h-6 w-6 text-[var(--mkt-accent-text)]" />
                </div>
                <h1 className="text-lg font-semibold text-[var(--mkt-fg)] tracking-tight">
                  Reset your password
                </h1>
                <p className="text-[var(--mkt-fg-muted)] text-sm mt-1">
                  Enter your email and we&apos;ll send you a secure reset link.
                </p>
              </div>

              <form onSubmit={handleReset} className="flex flex-col gap-5">
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

                <Button
                  type="submit"
                  disabled={loading}
                  className="mkt-btn mkt-btn-primary h-12 w-full text-sm disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </form>

              <div className="mt-7 pt-6 border-t border-[var(--mkt-line-soft)] text-center">
                <Link
                  href="/login"
                  className="mkt-link inline-flex items-center gap-1.5 text-xs"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-[var(--mkt-fg-subtle)]">
          © {new Date().getFullYear()} Daylink. All rights reserved.
        </p>
      </div>
    </div>
  );
}
