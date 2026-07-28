"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace, type WorkspacePermissions } from "@/hooks/use-workspace";
import type { ModuleKey } from "@/lib/auth/modules";
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
  FileCheck,
  ChevronLeft,
  ChevronsUpDown,
  AppWindow
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

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: keyof WorkspacePermissions;
  badge?: boolean;
};

type NavGroup = {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
};

/**
 * Maps each sidebar nav group's label to the app module that gates it.
 * `null` = ungated (always visible, e.g. the System group). Groups whose
 * module the member can't access are hidden from the module switcher.
 * Keep the keys in sync with the `navGroups` labels below.
 */
const NAV_GROUP_MODULE: Record<string, ModuleKey | null> = {
  CRM: "crm",
  Retail: "retail",
  "Project Management": "projects",
  "HR Management": "hr",
  System: null,
};

const navGroups: NavGroup[] = [
  {
    label: "CRM",
    icon: MessageSquare,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Inbox", icon: MessageSquare, permission: "inbox" as any, badge: true },
      { href: "/contacts", label: "Contacts", icon: Users, permission: "contacts" as any },
      { href: "/pipelines", label: "Pipelines", icon: GitBranch, permission: "pipelines" as any },
      { href: "/quotations", label: "Quotations", icon: Calculator },
      { href: "/broadcasts", label: "Broadcasts", icon: Radio, permission: "broadcasts" as any },
      { href: "/media", label: "Media", icon: ImageIcon },
      { href: "/forms", label: "Forms", icon: FileText },
    ]
  },
  {
    label: "Retail",
    icon: Store,
    items: [
      { href: "/pos", label: "POS Terminal", icon: ShoppingCart },
      { href: "/commerce/products", label: "Products", icon: Package },
      { href: "/commerce/inventory", label: "Inventory", icon: Layers },
      { href: "/commerce/ledger", label: "Customer Ledger / Khata", icon: Wallet },
      { href: "/commerce/accounting", label: "Accounting & GL", icon: BookOpen },
      { href: "/commerce/gst", label: "GST Reports", icon: FileText },
      { href: "/commerce/sales", label: "Sales & Invoices", icon: Receipt },
      { href: "/commerce/purchases", label: "Purchases & POs", icon: Truck },
      { href: "/commerce/suppliers", label: "Suppliers", icon: Building2 },
      { href: "/commerce/returns", label: "Returns", icon: RefreshCw },
      { href: "/settings?tab=retail", label: "Retail Settings", icon: Settings },
    ]
  },
  {
    label: "Project Management",
    icon: Briefcase,
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
    icon: Users,
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
  },
  {
    label: "System",
    icon: Settings,
    items: [
      { href: "/automations", label: "Automations", icon: Zap },
      { href: "/integrations", label: "Integrations", icon: Blocks },
      { href: "/docs", label: "Documentation", icon: BookOpen },
      { href: "/settings?tab=workspace", label: "Workspace Settings", icon: Settings },
    ]
  }
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { can, moduleAccess } = useWorkspace();
  const totalUnread = useTotalUnread();
  const { mode } = useTheme();
  const isDark = mode === "dark";

  // Sidebar Layout & Active Module state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeModule, setActiveModule] = useState<string>("CRM");

  // Sync collapsed preference
  useEffect(() => {
    const savedCollapse = localStorage.getItem("sidebar_collapsed");
    if (savedCollapse === "true") {
      setIsCollapsed(true);
    }
    const savedModule = localStorage.getItem("active_app_module");
    if (savedModule) {
      setActiveModule(savedModule);
    }
  }, []);

  // Determine current active group on page mount/change to auto-switch module active view
  useEffect(() => {
    const matchedGroup = navGroups.find(group =>
      group.items.some(item =>
        pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
      )
    );
    if (matchedGroup) {
      setActiveModule(matchedGroup.label);
      localStorage.setItem("active_app_module", matchedGroup.label);
    }
  }, [pathname]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  // Only surface module groups the current member can access. Ungated
  // groups (NAV_GROUP_MODULE === null, e.g. System) always show. Preserves
  // navGroups order, so accessibleGroups[0] is CRM whenever CRM is allowed.
  const accessibleGroups = useMemo(() => {
    return navGroups.filter((group) => {
      const mod = NAV_GROUP_MODULE[group.label];
      return mod == null || moduleAccess[mod];
    });
  }, [moduleAccess]);

  // If the active module became inaccessible (role change, direct nav),
  // fall back to the first accessible group (CRM when available).
  useEffect(() => {
    if (accessibleGroups.length === 0) return;
    const stillAccessible = accessibleGroups.some((g) => g.label === activeModule);
    if (!stillAccessible) {
      const fallback = accessibleGroups[0].label;
      setActiveModule(fallback);
      localStorage.setItem("active_app_module", fallback);
    }
  }, [accessibleGroups, activeModule]);

  const handleSwitchModule = (moduleLabel: string) => {
    setActiveModule(moduleLabel);
    localStorage.setItem("active_app_module", moduleLabel);

    // Auto-navigate to first item of switched module for clean user flow
    const group = accessibleGroups.find(g => g.label === moduleLabel);
    if (group && group.items.length > 0) {
      const firstItem = group.items.find(item => !item.permission || can(item.permission));
      if (firstItem) {
        router.push(firstItem.href);
      }
    }
  };

  // Get active menu items for selected module (only from accessible groups)
  const visibleItems = useMemo(() => {
    const group = accessibleGroups.find(g => g.label === activeModule);
    if (!group) return [];
    return group.items.filter(item => !item.permission || can(item.permission));
  }, [accessibleGroups, activeModule, can]);

  // Find active group icon
  const ActiveGroupIcon = useMemo(() => {
    const group = accessibleGroups.find(g => g.label === activeModule);
    return group ? group.icon : AppWindow;
  }, [accessibleGroups, activeModule]);

  // Dynamic Theme Colors
  const sidebarBgClass = isDark
    ? "bg-slate-950 border-r border-border text-foreground"
    : "bg-[#0f172a] border-r border-slate-800/80 text-slate-200";

  const switcherBg = isDark
    ? "border-border bg-transparent hover:bg-muted/10 text-foreground"
    : "border-slate-800/80 bg-transparent hover:bg-slate-800/30 text-white";

  const dividerClass = isDark ? "border-t border-border" : "border-t border-slate-800/60";

  const linkClass = (isActive: boolean) => {
    if (isActive) {
      return "bg-primary/15 text-primary";
    }
    return "text-slate-400 hover:bg-slate-800/30 hover:text-white";
  };

  return (
    <>
      {/* Mobile Overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity lg:hidden"
        />
      )}

      {/* Main Sidebar Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full flex-col transition-all duration-300 ease-in-out",
          sidebarBgClass,
          isCollapsed ? "w-16" : "w-60",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0 lg:transition-all"
        )}
        aria-label="Primary"
      >
        {/* Unified Header Row: Logo & Workspace Switcher in a single line */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-1.5 px-3 border-b border-slate-800/40">
          {isCollapsed ? (
            /* Collapsed view: Show just the workspace avatar dropdown centered */
            <div className="w-full flex justify-center py-1">
              <WorkspaceSwitcher hideText minimalist />
            </div>
          ) : (
            /* Expanded view: Logo + Workspace Switcher + Collapse button in a single line */
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Link href="/dashboard" className="shrink-0 flex items-center justify-center">
                <Image
                  src="/logolight.png"
                  alt="Daily CRM Logo"
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain shrink-0"
                  priority
                />
              </Link>
              <div className="flex-1 min-w-0">
                <WorkspaceSwitcher hideText={false} minimalist />
              </div>
            </div>
          )}

          {/* Collapse Toggle Button (Desktop Only) */}
          {!open && !isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-slate-850 text-slate-400 hover:text-white transition-colors"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={3} />
            </button>
          )}

          {/* Close button (Mobile Only) */}
          {open && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md lg:hidden text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* App Module Switcher Dropdown (Just like Workspace Switcher) */}
        <div className="px-3 pt-3 pb-3 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-1.5 rounded-lg border transition-all focus:outline-none px-2 py-1.5 text-left text-sm font-medium",
                    switcherBg,
                    isCollapsed ? "px-1 py-1 justify-center border-transparent bg-transparent hover:bg-slate-800/40" : ""
                  )}
                  title={isCollapsed ? `Module: ${activeModule}` : "Switch App Module"}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/15 text-primary border border-primary/20">
                      <ActiveGroupIcon className="h-3.5 w-3.5" />
                    </div>
                    {!isCollapsed && (
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white leading-tight">
                          {activeModule} Module
                        </p>
                        <p className="text-[8px] text-primary font-extrabold uppercase tracking-wider leading-none mt-0.5">
                          Switch Module
                        </p>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                </button>
              }
            />
            
            <DropdownMenuContent
              align={isCollapsed ? "start" : "center"}
              side={isCollapsed ? "right" : "bottom"}
              sideOffset={12}
              className="w-56 bg-slate-900 border border-slate-800 text-slate-200 p-1.5 rounded-2xl shadow-xl z-50"
            >
              <div className="px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                App Modules
              </div>
              <DropdownMenuSeparator className="bg-slate-800/60 my-1" />
              
              {accessibleGroups.map((group) => {
                const GroupIcon = group.icon;
                const isSelected = activeModule === group.label;
                
                return (
                  <DropdownMenuItem
                    key={group.label}
                    onClick={() => handleSwitchModule(group.label)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition-all focus:bg-slate-800 focus:text-white cursor-pointer",
                      isSelected
                        ? "bg-primary/15 text-primary focus:bg-primary/20 focus:text-primary"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{group.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Separator */}
        <div className="px-3 py-2 shrink-0">
          <div className="border-t border-slate-800/40 w-full" />
        </div>

        {/* Dynamic Sidebar Links (Only show selected module links) */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const showUnreadDot = item.href === "/inbox" && totalUnread > 0 && !isActive;
            const ItemIcon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold transition-all relative group",
                  linkClass(isActive),
                  isCollapsed ? "justify-center px-0 py-2.5 h-10 w-10 mx-auto rounded-xl" : ""
                )}
              >
                <ItemIcon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                
                {/* Collapsed Tooltip */}
                {isCollapsed && (
                  <span className="absolute left-14 scale-0 group-hover:scale-100 transition-all rounded bg-slate-950 text-white text-xs font-semibold px-2.5 py-1.5 shadow-md origin-left whitespace-nowrap z-50">
                    {item.label}
                  </span>
                )}

                {showUnreadDot && (
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Account Section */}
        <div className={cn("shrink-0 p-3 flex flex-col gap-2", dividerClass)}>
          {isCollapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="flex h-11 w-11 mx-auto items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-850 mb-1"
              title="Expand Sidebar"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={3} />
            </button>
          )}
          {!isCollapsed && (
            <div className="px-2 pb-1 flex items-center justify-between text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
              <span>CRM v2</span>
              <span>by Daylink</span>
            </div>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus:outline-none cursor-pointer hover:bg-slate-800/30",
                    isCollapsed ? "justify-center" : ""
                  )}
                >
                  <Avatar className="size-8 shrink-0">
                    {profile?.avatar_url && (
                      <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? "Avatar"} />
                    )}
                    <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary">
                      {profile?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">
                        {profile?.full_name ?? "User"}
                      </p>
                      <p className="truncate text-[10px] text-slate-400 mt-0.5">
                        {profile?.email ?? ""}
                      </p>
                    </div>
                  )}
                </button>
              }
            />
            
            <DropdownMenuContent
              align="end"
              side={isCollapsed ? "right" : "bottom"}
              sideOffset={12}
              className="min-w-56 bg-slate-900 border border-slate-800 text-slate-200 p-1.5 rounded-2xl shadow-xl z-50"
            >
              {!isCollapsed && (
                <div className="px-3 py-2 border-b border-slate-800/60 mb-1">
                  <p className="text-xs font-bold text-white truncate">{profile?.full_name ?? "User"}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{profile?.email ?? ""}</p>
                </div>
              )}
              <DropdownMenuItem render={<Link href="/settings?tab=profile" />}>
                <User className="size-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings?tab=overview" />}>
                <Settings className="size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800/60" />
              <DropdownMenuItem onClick={signOut} className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-400">
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
