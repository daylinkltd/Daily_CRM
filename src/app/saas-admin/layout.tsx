"use client";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield, LayoutDashboard, LogOut, Menu, Building2, Users, Megaphone, ScrollText, Settings2, Inbox, TicketPercent } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/saas-admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/saas-admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/saas-admin/users", label: "Users", icon: Users },
  { href: "/saas-admin/prospects", label: "Prospects", icon: Inbox },
  { href: "/saas-admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/saas-admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/saas-admin/logs", label: "Logs", icon: ScrollText },
  { href: "/saas-admin/system", label: "System", icon: Settings2 },
];

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
      <div className="flex h-screen items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verifying administrator access...</p>
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Admin Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-16 items-center border-b border-border px-6 gap-2 shrink-0">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight text-foreground">SaaS Admin</span>
        </div>

        {/* Links */}
        <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Panel */}
        <div className="border-t border-border p-4 shrink-0">
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4 text-rose-500" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 backdrop-blur-sm shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-4 ml-auto">
            {profile && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-foreground">{profile.full_name || "SaaS Admin"}</p>
                  <p className="text-[10px] text-muted-foreground">{profile.email}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {(profile.full_name || "A").charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Dashboard Space */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted">{children}</main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-muted/60 backdrop-blur-sm lg:hidden"
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
