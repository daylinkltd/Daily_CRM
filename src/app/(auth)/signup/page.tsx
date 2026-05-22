"use client";

import Image from "next/image";
import Link from "next/link";
import { Shield, ArrowLeft, Mail } from "lucide-react";

/**
 * /signup is DISABLED.
 * The workspace owner onboarding flow is admin-driven only:
 * 1. SaaS Admin creates an owner account via /saas-admin
 * 2. Owner creates team members from workspace Settings → Team
 */
export default function SignupPage() {
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
