"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace, type WorkspacePermissions } from "@/hooks/use-workspace";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useTheme } from "@/hooks/use-theme";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  GitBranch,
  Radio,
  Zap,
  Settings,
  LogOut,
  User,
  X,
  Blocks,
  BookOpen,
  ImageIcon,
  FileText,
  Calculator,
  Briefcase,
  CheckSquare,
  Clock,
  CalendarClock,
  Umbrella,
  Building,
  BadgeCheck,
  Laptop,
  Target,
  BarChart3,
  ShieldCheck,
  Banknote,
  Receipt,
  ShoppingCart,
  Package,
  Layers,
  Truck,
  Building2,
  RefreshCw,
  Store,
  Wallet,
  ChevronDown,
  ChevronRight,
  Activity,
  Calendar,
  TrendingUp,
  FileCheck
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

type NavGroup = {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ElementType;
    permission?: keyof WorkspacePermissions;
    badge?: boolean;
  }[];
};

const navGroups: NavGroup[] = [
  {
    label: "CRM",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
      { href: "/inbox", label: "Inbox", icon: MessageSquare, permission: "inbox" as any, badge: true },
      { href: "/contacts", label: "Contacts", icon: Users, permission: "contacts" as any },
      { href: "/pipelines", label: "Pipelines", icon: GitBranch, permission: "pipelines" as any },
      { href: "/quotations", label: "Quotations", icon: Calculator, permission: null },
      { href: "/broadcasts", label: "Broadcasts", icon: Radio, permission: "broadcasts" as any },
      { href: "/media", label: "Media", icon: ImageIcon, permission: null },
      { href: "/forms", label: "Forms", icon: FileText, permission: null },
    ]
  },
  {
    label: "Retail",
    items: [
      { href: "/pos", label: "POS Terminal", icon: ShoppingCart, permission: null },
      { href: "/commerce/products", label: "Products", icon: Package, permission: null },
      { href: "/commerce/inventory", label: "Inventory", icon: Layers, permission: null },
      { href: "/commerce/ledger", label: "Customer Ledger / Khata", icon: Wallet, permission: null },
      { href: "/commerce/accounting", label: "Accounting & GL Ledgers", icon: BookOpen, permission: null },
      { href: "/commerce/gst", label: "GST Reports & Filing", icon: FileText, permission: null },
      { href: "/commerce/sales", label: "Sales & Invoices", icon: Receipt, permission: null },
      { href: "/commerce/purchases", label: "Purchases & POs", icon: Truck, permission: null },
      { href: "/commerce/suppliers", label: "Suppliers", icon: Building2, permission: null },
      { href: "/commerce/returns", label: "Returns", icon: RefreshCw, permission: null },
      { href: "/settings?tab=retail", label: "Retail Settings & Presets", icon: Settings, permission: null },
    ]
  },
  {
    label: "Project Management",
    items: [
      { href: "/projects/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "projects_view" as any },
      { href: "/projects", label: "Projects", icon: Briefcase, permission: "projects_view" as any },
      { href: "/planning", label: "Planning", icon: CalendarClock, permission: "projects_view" as any },
      { href: "/tasks", label: "Tasks", icon: CheckSquare, permission: "projects_view" as any },
      { href: "/workloads", label: "Workload", icon: Activity, permission: "projects_view" as any },
      { href: "/timesheets", label: "Timesheets", icon: Clock, permission: "projects_view" as any },
      { href: "/invoices", label: "Invoices", icon: Receipt, permission: "projects_view" as any },
    ]
  },
  {
    label: "HR Management",
    items: [
      { href: "/hr-dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "people_view" as any },
      { href: "/employees", label: "Employees", icon: Users, permission: "people_view" as any },
      { href: "/recruitment", label: "Recruitment", icon: Briefcase, permission: "people_manage" as any },
      { href: "/policies", label: "Policies & Compliance", icon: ShieldCheck, permission: "people_view" as any },
      { href: "/attendance", label: "Attendance", icon: CalendarClock, permission: "people_view" as any },
      { href: "/shifts", label: "Shifts", icon: Clock, permission: "people_manage" as any },
      { href: "/holidays", label: "Holidays", icon: Calendar, permission: "people_view" as any },
      { href: "/leave", label: "Leave", icon: Umbrella, permission: "people_view" as any },
      { href: "/payroll", label: "Payroll", icon: Banknote, permission: "people_manage" as any },
      { href: "/expenses", label: "Expenses", icon: Receipt, permission: "people_view" as any },
      { href: "/performance", label: "Performance", icon: TrendingUp, permission: "people_manage" as any },
      { href: "/requests", label: "Requests", icon: FileCheck, permission: "people_view" as any },
      { href: "/assets", label: "Assets", icon: Laptop, permission: "people_manage" as any },
      { href: "/documents", label: "Documents", icon: ShieldCheck, permission: "people_manage" as any },
      { href: "/departments", label: "Departments", icon: Building, permission: "people_manage" as any },
      { href: "/designations", label: "Designations", icon: BadgeCheck, permission: "people_manage" as any },
      { href: "/reports", label: "Analytics & Reports", icon: BarChart3, permission: "people_manage" as any },
    ]
  }
];

const bottomNavItems = [
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/integrations", label: "Integrations", icon: Blocks },
  { href: "/docs", label: "Documentation", icon: BookOpen },
  { href: "/settings?tab=workspace", label: "Workspace Settings", icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { can } = useWorkspace();
  const totalUnread = useTotalUnread();
  const { mode } = useTheme();
  const isDark = mode === "dark";
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Dynamic Theme Styling Variables
  const sidebarBgClass = isDark
    ? "border-r border-border bg-background text-foreground"
    : "border-r border-slate-800 bg-[#1E293B] text-slate-200";

  const logoRowStyle = isDark
    ? {}
    : { backgroundColor: "#1E293B" };

  const logoRowBorder = isDark ? "border-b border-border" : "border-b border-slate-800";

  const closeButtonClass = isDark
    ? "text-muted-foreground hover:bg-muted hover:text-foreground"
    : "text-slate-400 hover:bg-slate-800 hover:text-white";

  const groupHeaderClass = "text-white hover:text-white";

  const linkClass = (isActive: boolean) => {
    if (isActive) {
      return isDark ? "bg-white/10 text-white" : "bg-primary/20 text-white";
    }
    return "text-white hover:bg-white/10";
  };

  const dividerClass = isDark ? "border-t border-border" : "border-t border-slate-800";

  const settingsHeaderClass = "text-white";

  const userSectionBorder = isDark ? "border-t border-border" : "border-t border-slate-800";

  const footerBrandTextClass = isDark ? "text-muted-foreground" : "text-slate-500";

  const userTriggerClass = isDark
    ? "hover:bg-muted/60 focus:bg-muted/60 data-popup-open:bg-muted/60 text-foreground"
    : "hover:bg-slate-800/80 focus:bg-slate-800/80 data-popup-open:bg-slate-800/80 text-white";

  const userSubtextClass = isDark ? "text-muted-foreground" : "text-slate-400";

  const userNameClass = isDark ? "text-foreground" : "text-white";

  // Sync expanded group with current pathname (accordion-style auto-collapse)
  useEffect(() => {
    const currentGroup = navGroups.find(group => 
      group.items.some(item => 
        pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
      )
    );
    if (currentGroup) {
      setExpandedGroups({ [currentGroup.label]: true });
    }
  }, [pathname]);

  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);


  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col",
          sidebarBgClass,
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Primary"
      >
        {/* Logo row */}
        <div className={cn("flex h-14 shrink-0 items-center justify-between gap-2 px-4", logoRowBorder)} style={logoRowStyle}>
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/logolight.png"
              alt="Daily CRM"
              width={28}
              height={28}
              className="h-7 w-7 object-contain shrink-0"
              priority
            />
            <span className="font-semibold text-base tracking-tight truncate" style={{ color: '#ffffff' }}>Daily CRM</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className={cn("flex h-9 w-9 items-center justify-center rounded-md lg:hidden", closeButtonClass)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workspace Switcher */}
        <div className="px-3 pt-4 pb-1 shrink-0">
          <WorkspaceSwitcher />
        </div>

        {/* Main navigation — filtered by ABAC permissions */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter(
              (item) => !item.permission || can(item.permission)
            );

            if (visibleItems.length === 0) return null;

            const isExpanded = expandedGroups[group.label];

            return (
              <div key={group.label} className={cn("flex flex-col", groupIdx > 0 && "mt-2")}>
                <button 
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [group.label]: !prev[group.label] }))}
                  className={cn("flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors rounded-md", groupHeaderClass)}
                >
                  <span>{group.label}</span>
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                
                {isExpanded && (
                  <ul className="flex flex-col gap-1 mt-1">
                    {visibleItems.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));
                      const showUnreadDot =
                        item.href === "/inbox" && totalUnread > 0 && !isActive;

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                              linkClass(isActive)
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.label}</span>
                            {showUnreadDot && (
                              <span
                                aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? "" : "s"}`}
                                className="relative flex h-2 w-2"
                              >
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          <div className={cn("my-6", dividerClass)} />

          <div className="flex flex-col">
            <h4 className={cn("mb-2 px-3 text-xs font-semibold uppercase tracking-wider", settingsHeaderClass)} style={{ color: '#ffffff' }}>
              Settings
            </h4>
            <ul className="flex flex-col gap-1">
              {bottomNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                        linkClass(isActive)
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* User section */}
        <div className={cn("shrink-0 p-3 flex flex-col gap-2", userSectionBorder)}>
          <div className="px-2 pb-1 pt-2 flex items-center justify-center">
            <span className={cn("text-[10px] uppercase tracking-widest font-semibold", footerBrandTextClass)}>by Daylink</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus:outline-none", userTriggerClass)}>
              <Avatar className="size-8 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "Avatar"}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", userNameClass)}>
                  {profile?.full_name ?? "User"}
                </p>
                <p className={cn("truncate text-xs", userSubtextClass)}>
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56 bg-popover text-popover-foreground ring-border"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-muted focus:text-foreground"
                  />
                }
              >
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=overview"
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-muted focus:text-foreground"
                  />
                }
              >
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-popover-foreground focus:bg-muted focus:text-foreground"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
