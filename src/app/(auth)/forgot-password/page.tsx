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
    <div className="flex min-h-screen items-center justify-center bg-[#020817] px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-[#00aef0]/5 blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logolight.png"
            alt="Daily CRM by Daylink"
            width={160}
            height={40}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>

        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-2xl shadow-2xl shadow-black/50 p-8">
          {success ? (
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-extrabold text-white mb-2">Check your inbox</h1>
              <p className="text-slate-400 text-sm mb-6">
                We&apos;ve sent a password reset link to{" "}
                <span className="text-white font-medium">{email}</span>.
              </p>
              <Link href="/login">
                <Button className="w-full h-11 bg-[#00aef0] hover:bg-[#008ec4] text-white font-bold rounded-xl">
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#00aef0]/10 border border-[#00aef0]/20 mb-4">
                  <Mail className="h-6 w-6 text-[#00aef0]" />
                </div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                  Reset your password
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  Enter your email and we&apos;ll send you a secure reset link.
                </p>
              </div>

              <form onSubmit={handleReset} className="flex flex-col gap-5">
                {error && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-400 flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-300">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-slate-700/60 bg-slate-950/70 text-white placeholder:text-slate-600 focus-visible:border-[#00aef0] focus-visible:ring-[#00aef0]/10 h-11 rounded-xl"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full bg-[#00aef0] hover:bg-[#008ec4] text-white font-bold rounded-xl shadow-lg shadow-[#00aef0]/15 transition-all disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </form>

              <div className="mt-7 pt-6 border-t border-slate-800/60 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-slate-700">
          © {new Date().getFullYear()} Daylink. All rights reserved.
        </p>
      </div>
    </div>
  );
}
