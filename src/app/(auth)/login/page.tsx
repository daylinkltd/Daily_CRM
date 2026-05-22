"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020817] px-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/4 h-[500px] w-[500px] rounded-full bg-[#00aef0]/5 blur-[160px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/4 blur-[140px]" />
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

        {/* Card */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-2xl shadow-2xl shadow-black/50 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Welcome back
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Sign in to your Daily CRM workspace
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
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

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#00aef0] hover:text-[#44c8ff] transition-colors"
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
                  className="border-slate-700/60 bg-slate-950/70 text-white placeholder:text-slate-600 focus-visible:border-[#00aef0] focus-visible:ring-[#00aef0]/10 h-11 rounded-xl pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-12 w-full bg-[#00aef0] hover:bg-[#008ec4] text-white font-bold rounded-xl shadow-lg shadow-[#00aef0]/15 hover:shadow-[#00aef0]/25 transition-all disabled:opacity-50"
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
          </form>

          {/* Invite-only note instead of signup link */}
          <div className="mt-7 pt-6 border-t border-slate-800/60 text-center">
            <p className="text-xs text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-slate-400 hover:text-slate-300 underline underline-offset-4 transition-colors"
              >
                Request access
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-700">
          © {new Date().getFullYear()} Daylink. All rights reserved.
        </p>
      </div>
    </div>
  );
}
