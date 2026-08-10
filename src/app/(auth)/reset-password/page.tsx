"use client";

// The page a password-recovery email lands on (via /auth/callback).
// The recovery link signs the user in with a short-lived session, so
// all this form does is set the new password on that session. Without
// this page the whole forgot-password flow dead-ended — the email's
// redirect target didn't exist.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, KeyRound, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The recovery session may still be materialising from the URL when
    // the page first renders; listen briefly instead of checking once.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasSession(Boolean(data.session));
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setHasSession(true);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    setDone(true);
    setSaving(false);
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  return (
    <div className="marketing flex min-h-screen items-center justify-center bg-[var(--mkt-canvas)] px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
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
          {checking ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--mkt-fg-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying your link…
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/40 mb-5">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <h1 className="text-lg font-semibold text-[var(--mkt-fg)] mb-2">Password updated</h1>
              <p className="text-[var(--mkt-fg-muted)] text-sm">
                Taking you to your dashboard…
              </p>
            </div>
          ) : !hasSession ? (
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/40 mb-5">
                <AlertCircle className="h-8 w-8 text-rose-400" />
              </div>
              <h1 className="text-lg font-semibold text-[var(--mkt-fg)] mb-2">
                This link has expired
              </h1>
              <p className="text-[var(--mkt-fg-muted)] text-sm mb-6">
                Reset links are single-use and short-lived. Request a fresh one
                and open it on this device.
              </p>
              <Link href="/forgot-password">
                <Button className="mkt-btn mkt-btn-primary h-11 w-full text-sm">
                  Request a new link
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--mkt-accent-soft)] border border-[var(--mkt-accent-line)] mb-4">
                  <KeyRound className="h-6 w-6 text-[var(--mkt-accent-text)]" />
                </div>
                <h1 className="text-lg font-semibold text-[var(--mkt-fg)] tracking-tight">
                  Choose a new password
                </h1>
                <p className="text-[var(--mkt-fg-muted)] text-sm mt-1">
                  At least 8 characters. You&apos;ll stay signed in on this device.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {error && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password" className="text-sm font-medium text-[var(--mkt-fg-muted)]">
                    New password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="mkt-field h-11 border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg)]"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm" className="text-sm font-medium text-[var(--mkt-fg-muted)]">
                    Confirm password
                  </Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="mkt-field h-11 border-[var(--mkt-line)] bg-[var(--mkt-surface-2)] text-[var(--mkt-fg)]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="mkt-btn mkt-btn-primary h-12 w-full text-sm disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Set new password"}
                </Button>
              </form>
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
