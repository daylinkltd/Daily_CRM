"use client";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Shield, LayoutDashboard, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === "/saas-admin/login";

  useEffect(() => {
    if (!loading && !isLoginPage) {
      if (!user) {
        router.push("/saas-admin/login");
      } else if (profile && profile.system_role !== "super_admin") {
        // Enforce immediate sign out and redirect if the role is not super_admin
        signOut();
      }
    }
  }, [user, profile, loading, router, signOut, isLoginPage]);

  // If loading, show elegant spinning loader with our core daylink cyan theme
  if (loading && !isLoginPage) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00aef0] border-t-transparent" />
          <p className="text-sm text-slate-400">Verifying administrator access...</p>
        </div>
      </div>
    );
  }

  // If on the login page, render children directly under the AuthProvider context
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!user || (profile && profile.system_role !== "super_admin")) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-white font-sans">
      {/* Admin Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-900 bg-slate-950 transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-16 items-center border-b border-slate-900 px-6 gap-2 shrink-0">
          <Shield className="h-6 w-6 text-[#00aef0]" />
          <span className="font-bold text-lg tracking-tight">SaaS Admin</span>
        </div>

        {/* Links */}
        <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
          <Link
            href="/saas-admin/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-200 hover:text-white hover:bg-slate-900/60 transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 text-[#00aef0]" />
            Dashboard
          </Link>
        </nav>

        {/* Bottom Panel */}
        <div className="border-t border-slate-900 p-4 shrink-0">
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-900/60 transition-colors"
          >
            <LogOut className="h-4 w-4 text-rose-500" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-900 bg-slate-950/40 px-6 backdrop-blur-sm shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-4 ml-auto">
            {profile && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-white">{profile.full_name || "SaaS Admin"}</p>
                  <p className="text-[10px] text-slate-400">{profile.email}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-[#00aef0]/10 flex items-center justify-center text-[#00aef0] font-bold text-sm">
                  {(profile.full_name || "A").charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Dashboard Space */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">{children}</main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
        />
      )}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AuthProvider>
  );
}
