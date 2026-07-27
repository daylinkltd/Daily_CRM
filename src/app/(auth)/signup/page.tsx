"use client";

import { Suspense, useState, useEffect } from "react";
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
          <Link href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"}>
            <Button variant="outline" className="w-full border-slate-800 text-slate-300 hover:bg-slate-800">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center relative overflow-hidden" style={{ backgroundColor: '#020817' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[#00aef0]/10 blur-[140px]" />

      <div 
        className="relative z-10 w-full max-w-md rounded-3xl border backdrop-blur-2xl p-8 text-left shadow-2xl"
        style={{ 
          backgroundColor: 'rgba(15, 23, 42, 0.75)', 
          borderColor: '#1e293b',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' 
        }}
      >
        <div className="flex justify-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(0, 174, 240, 0.12)' }}>
            <UsersRound className="h-6 w-6" style={{ color: '#00aef0' }} />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-center mb-1" style={{ color: '#ffffff' }}>
          {inviteToken ? "Create account & join" : "Create your Daily CRM account"}
        </h2>
        <p className="text-xs text-center mb-6" style={{ color: '#94a3b8' }}>
          {inviteToken 
            ? "Verify your email, then accept the invitation to join your team."
            : "Get started with your dedicated omni-channel workspace today."}
        </p>

        {plan && (
          <div className="mb-4 rounded-lg px-3 py-2 text-center text-xs font-semibold capitalize border" style={{ backgroundColor: 'rgba(0, 174, 240, 0.1)', borderColor: 'rgba(0, 174, 240, 0.25)', color: '#00aef0' }}>
            Registering for {plan} plan ({cycle || "monthly"})
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="rounded-lg border px-4 py-3 text-xs" style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', borderColor: 'rgba(244, 63, 94, 0.25)', color: '#fb7185' }}>
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-medium" style={{ color: '#cbd5e1' }}>Full name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-10 rounded-xl placeholder:text-[#64748b] focus:border-[#00aef0]"
              style={{ backgroundColor: 'rgba(2, 8, 23, 0.85)', borderColor: '#1e293b', color: '#ffffff' }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium" style={{ color: '#cbd5e1' }}>Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 rounded-xl placeholder:text-[#64748b] focus:border-[#00aef0]"
              style={{ backgroundColor: 'rgba(2, 8, 23, 0.85)', borderColor: '#1e293b', color: '#ffffff' }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium" style={{ color: '#cbd5e1' }}>Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 rounded-xl placeholder:text-[#64748b] focus:border-[#00aef0]"
              style={{ backgroundColor: 'rgba(2, 8, 23, 0.85)', borderColor: '#1e293b', color: '#ffffff' }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-medium" style={{ color: '#cbd5e1' }}>Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-10 rounded-xl placeholder:text-[#64748b] focus:border-[#00aef0]"
              style={{ backgroundColor: 'rgba(2, 8, 23, 0.85)', borderColor: '#1e293b', color: '#ffffff' }}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-xl mt-2 font-semibold transition-all disabled:opacity-50"
            style={{ backgroundColor: '#00aef0', color: '#ffffff', boxShadow: '0 10px 25px -5px rgba(0, 174, 240, 0.3)' }}
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: '#64748b' }}>
          Already have an account?{" "}
          <Link href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"} className="hover:underline font-medium" style={{ color: '#00aef0' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
