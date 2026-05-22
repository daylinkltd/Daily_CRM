"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ShieldAlert, ArrowLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Auto-seed admin on first load (fixes bcrypt hash mismatch from SQL migration)
  useEffect(() => {
    fetch("/api/saas-admin/seed-admin").catch(() => {
      // Silent — this is a background fix, login UI handles errors naturally
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError("Invalid login credentials. Check email and password.");
        setLoading(false);
        return;
      }

      const currentUser = authData.user;
      if (!currentUser) {
        setError("Invalid credentials.");
        setLoading(false);
        return;
      }

      // Validate super_admin role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("system_role")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        setError("Error validating privileges: " + profileError.message);
        setLoading(false);
        return;
      }

      if (profile?.system_role !== "super_admin") {
        await supabase.auth.signOut();
        setError(
          "Access Denied: This portal is reserved for System Administrators only."
        );
        setLoading(false);
        return;
      }

      router.push("/saas-admin/dashboard");
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020817] px-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-[#00aef0]/6 blur-[160px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-indigo-600/5 blur-[140px]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00aef0]/20 to-transparent" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

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
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-2xl shadow-2xl shadow-black/60 p-8">
          {/* Icon + Title */}
          <div className="text-center mb-7">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00aef0]/10 border border-[#00aef0]/20 mb-4">
              <Shield className="h-7 w-7 text-[#00aef0]" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Administrative Access
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Global SaaS Control Center Portal
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-400 flex items-start gap-2.5 animate-in fade-in duration-200">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="email"
                className="text-[11px] font-bold uppercase tracking-widest text-slate-400"
              >
                Admin Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-slate-700/60 bg-slate-950/70 text-white placeholder:text-slate-600 focus-visible:border-[#00aef0] focus-visible:ring-[#00aef0]/10 h-11 rounded-xl"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="password"
                className="text-[11px] font-bold uppercase tracking-widest text-slate-400"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
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
                  {showPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-12 w-full bg-[#00aef0] hover:bg-[#008ec4] text-white font-bold rounded-xl shadow-lg shadow-[#00aef0]/15 hover:shadow-[#00aef0]/30 transition-all text-sm tracking-wide disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Authorizing...
                </span>
              ) : (
                "Unlock Terminal Access"
              )}
            </Button>
          </form>

          <div className="mt-7 pt-6 border-t border-slate-800/60 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Return to Client Dashboard Login
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-700">
          © {new Date().getFullYear()} Daylink. Restricted access system.
        </p>
      </div>
    </div>
  );
}
