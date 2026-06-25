"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Shield, ArrowLeft, Mail, CheckCircle, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 text-sm">
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
          full_name: fullName,
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

  // If there is NO invite token, show the static Invite-Only page to maintain security.
  if (!inviteToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[#00aef0]/5 blur-[140px]" />

        {/* Card */}
        <div className="relative z-10 max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-2xl shadow-2xl p-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image src="/logolight.png" alt="Daily CRM by Daylink" width={160} height={40} className="h-10 w-auto object-contain" />
          </div>

          {/* Lock icon */}
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00aef0]/10 border border-[#00aef0]/20">
              <Shield className="h-8 w-8 text-[#00aef0]" />
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white mb-3 tracking-tight">Invite-Only Access</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Daily CRM accounts are created exclusively by your workspace administrator.
            Public self-registration is disabled to maintain security.
          </p>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 mb-8 text-left space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">How to get access</p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00aef0]/15 text-[#00aef0] text-xs font-bold shrink-0 mt-0.5">1</span>
                Contact your company&apos;s Daily CRM workspace owner or administrator
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00aef0]/15 text-[#00aef0] text-xs font-bold shrink-0 mt-0.5">2</span>
                They&apos;ll create your account from <span className="text-white font-semibold">Settings → Team</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00aef0]/15 text-[#00aef0] text-xs font-bold shrink-0 mt-0.5">3</span>
                You&apos;ll receive credentials to sign in directly
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <Link
              href="mailto:info@daylink.in?subject=Daily CRM Access Request"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#00aef0] hover:bg-[#008ec4] text-white font-semibold py-2.5 px-4 transition-colors text-sm shadow-lg shadow-[#00aef0]/15"
            >
              <Mail className="h-4 w-4" /> Contact Sales
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white font-medium py-2.5 px-4 transition-colors text-sm bg-slate-950/30"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Sign In
            </Link>
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-600">
          © {new Date().getFullYear()} Daylink. All rights reserved.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
        <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-2xl p-8">
          <div className="flex justify-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-slate-400 text-sm mb-6">
            We&apos;ve sent a confirmation link to <span className="text-white font-medium">{email}</span>. Please check your inbox and click the link to verify your account.
          </p>
          <Link href={`/login?invite=${encodeURIComponent(inviteToken)}`}>
            <Button variant="outline" className="w-full border-slate-800 text-slate-300 hover:bg-slate-800">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[140px]" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-2xl p-8 text-left">
        <div className="flex justify-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <UsersRound className="h-6 w-6 text-primary" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-white text-center mb-1">Create account &amp; join</h2>
        <p className="text-slate-400 text-xs text-center mb-6">
          Verify your email, then accept the invitation to join your team.
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-slate-300 text-xs font-medium">Full name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-10 rounded-xl focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-300 text-xs font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-10 rounded-xl focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-300 text-xs font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-10 rounded-xl focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-slate-300 text-xs font-medium">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-10 rounded-xl focus:border-primary"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl mt-2 font-semibold"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link href={`/login?invite=${encodeURIComponent(inviteToken)}`} className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
