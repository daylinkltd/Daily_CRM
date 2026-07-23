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
        <div 
          className="rounded-2xl border backdrop-blur-2xl shadow-2xl p-8"
          style={{ 
            backgroundColor: 'rgba(15, 23, 42, 0.75)', 
            borderColor: '#1e293b',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' 
          }}
        >
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#ffffff' }}>
              Welcome back
            </h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
              Sign in to your Daily CRM workspace
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {error && (
              <div 
                className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2.5"
                style={{ 
                  backgroundColor: 'rgba(244, 63, 94, 0.1)', 
                  borderColor: 'rgba(244, 63, 94, 0.25)', 
                  color: '#fb7185' 
                }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-sm font-medium" style={{ color: '#cbd5e1' }}>
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl placeholder:text-[#64748b] focus-visible:ring-[#00aef0]/20"
                style={{ 
                  backgroundColor: 'rgba(2, 8, 23, 0.85)', 
                  borderColor: '#1e293b', 
                  color: '#ffffff' 
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium" style={{ color: '#cbd5e1' }}>
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs transition-colors hover:underline"
                  style={{ color: '#00aef0' }}
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
                  className="h-11 rounded-xl pr-11 placeholder:text-[#64748b] focus-visible:ring-[#00aef0]/20"
                  style={{ 
                    backgroundColor: 'rgba(2, 8, 23, 0.85)', 
                    borderColor: '#1e293b', 
                    color: '#ffffff' 
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#64748b' }}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-12 w-full font-bold rounded-xl transition-all disabled:opacity-50"
              style={{ 
                backgroundColor: '#00aef0', 
                color: '#ffffff',
                boxShadow: '0 10px 25px -5px rgba(0, 174, 240, 0.3)' 
              }}
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
          <div className="mt-7 pt-6 border-t text-center" style={{ borderColor: '#1e293b' }}>
            <p className="text-xs" style={{ color: '#64748b' }}>
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="underline underline-offset-4 transition-colors hover:text-white"
                style={{ color: '#94a3b8' }}
              >
                Request access
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs" style={{ color: '#475569' }}>
          © {new Date().getFullYear()} Daylink. All rights reserved.
        </p>
      </div>
    </div>
  );
}
