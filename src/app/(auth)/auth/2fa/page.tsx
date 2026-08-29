"use client";

// The sign-in challenge. Reached by redirect from the proxy when an
// account has email two-factor on and this session has not yet answered
// its code — every other route is closed until it does.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ShieldCheck, Loader2 } from "lucide-react";

export default function TwoFactorChallengePage() {
  const router = useRouter();
  const supabase = createClient();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);

  // Send a code as soon as the page opens — the user arrived here by
  // redirect, not by choice, so making them press "send" first is a
  // step that buys nothing.
  useEffect(() => {
    void requestCode(true);
  }, []);

  async function requestCode(initial = false) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) setError(payload.error || "Could not send a code.");
      else if (!initial) setResentAt(Date.now());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSending(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || "That code did not work.");
        return;
      }
      // The proxy re-checks on the next request; a full navigation
      // guarantees it runs rather than relying on a client-side route.
      window.location.href = "/dashboard";
    } catch {
      setError("Could not reach the server.");
    } finally {
      setVerifying(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="marketing flex min-h-screen items-center justify-center bg-[var(--mkt-canvas)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image src="/logolight.png" alt="Dailybuz" width={160} height={40}
                 className="h-9 w-auto object-contain" priority />
        </div>

        <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-surface)] p-8 shadow-[var(--mkt-shadow)]">
          <div className="mb-6">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--mkt-accent-line)] bg-[var(--mkt-accent-soft)]">
              <ShieldCheck className="h-6 w-6 text-[var(--mkt-accent-text)]" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--mkt-fg)]">
              Confirm it&apos;s you
            </h1>
            <p className="mt-1 text-sm text-[var(--mkt-fg-muted)]">
              We emailed a six-digit code. Enter it to finish signing in.
            </p>
          </div>

          <form onSubmit={verify} className="flex flex-col gap-5">
            {error && (
              <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="code" className="text-sm font-medium text-[var(--mkt-fg-muted)]">
                Six-digit code
              </Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="mkt-field h-12 text-center font-mono text-xl tracking-[0.5em]"
                autoFocus
              />
            </div>

            <Button type="submit" disabled={verifying || code.length !== 6}
                    className="mkt-btn mkt-btn-primary h-12 w-full text-sm disabled:opacity-50">
              {verifying ? "Checking…" : "Confirm and continue"}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-[var(--mkt-line-soft)] pt-5 text-xs">
            <button type="button" onClick={() => requestCode()} disabled={sending}
                    className="mkt-link inline-flex items-center gap-1.5 disabled:opacity-50">
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {resentAt ? "Code re-sent" : "Send a new code"}
            </button>
            <button type="button" onClick={signOut} className="text-[var(--mkt-fg-subtle)] hover:underline">
              Sign in as someone else
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[var(--mkt-fg-subtle)]">
          Didn&apos;t get it? Check spam, or send a new code.
        </p>
      </div>
    </div>
  );
}
