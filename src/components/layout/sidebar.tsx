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
  UserCircle,
  Inbox,
  ListChecks,
  NotebookPen,
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
  Handshake,
  Landmark,
  PenSquare,
  Scale,
  Briefcase,
  CheckSquare,
  Clock,
  CalendarClock,
  Umbrella,
  Building,
  BadgeCheck,
  Laptop,
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
  ChevronRight,
  Activity,
  Calendar,
  TrendingUp,
  FileCheck,
  ChevronLeft,
  ChevronsUpDown,
  AppWindow,
  Tag,
  Bookmark
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
  /**
   * Hide unless the member has an `employee_profiles` row.
   *
   * Not a permission — an entitlement of a different kind. A solo owner or
   * an external collaborator is a member without being staff, and payslips,
   * leave balances and a staff handbook are meaningless (and misleading)
   * for them. The pages guard themselves too; this only tidies the nav.
   */
  employeeOnly?: boolean;
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
  // Self-service is deliberately ungated: requesting your own leave or
  // seeing your own payslip is not an HR-module capability, and routing
  // staff through the HR module to do it both exposes the whole module and
  // requires a permission they should not need.
  "My Workspace": null,
  CRM: "crm",
  Accounting: "accounting",
  Retail: "retail",
  "Project Management": "projects",
  "HR Management": "hr",
  System: null,
};

/**
 * Two independent gates: a permission the member's role must grant, and —
 * for the employee self-service pages — an `employee_profiles` row. Both
 * must pass.
 *
 * Deliberately a plain function rather than a useCallback: as a hook its
 * `can` dependency comes from context, which the React Compiler cannot
 * prove stable, so it reported the surrounding memoization as unpreservable.
 */
function isItemVisible(
  item: NavItem,
  can: (key: keyof WorkspacePermissions) => boolean,
  isEmployee: boolean,
): boolean {
  return (
    (!item.permission || can(item.permission)) &&
    (!item.employeeOnly || isEmployee)
  );
}

const navGroups: NavGroup[] = [
  {
    label: "My Workspace",
    icon: UserCircle,
    items: [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard },
      // Everything assigned to me, from every module.
      { href: "/me/work", label: "My Work", icon: Inbox },
      { href: "/me/todos", label: "My To-dos", icon: ListChecks },
      { href: "/me/notes", label: "My Notes", icon: NotebookPen },
      // Timesheets stay ungated: time is logged against project tasks, which
      // a contractor or agency member does without being on the payroll.
      { href: "/me/timesheets", label: "My Timesheets", icon: Clock },
      // Submit-only. There is deliberately no My Attendance / My Leave /
      // My Payslips: an employee punches in and out and raises requests,
      // and everything after that is HR's to see and act on.
      { href: "/me/requests", label: "Raise a Request", icon: FileCheck, employeeOnly: true },
      { href: "/me/documents", label: "My Documents", icon: FileText, employeeOnly: true },
      { href: "/handbook", label: "Handbook", icon: BookOpen, employeeOnly: true },
      { href: "/settings?tab=profile", label: "My Profile", icon: Settings },
    ]
  },
  {
    label: "CRM",
    icon: MessageSquare,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Inbox", icon: MessageSquare, permission: "inbox", badge: true },
      // Ordered to follow the customer lifecycle end to end:
      // Contacts -> Pipelines -> Commercials -> Quotations -> Invoices.
      { href: "/contacts", label: "Contacts", icon: Users, permission: "contacts" },
      { href: "/pipelines", label: "Pipelines", icon: GitBranch, permission: "pipelines" },
      { href: "/commercials", label: "Commercials", icon: Handshake },
      { href: "/quotations", label: "Quotations", icon: Calculator },
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/broadcasts", label: "Broadcasts", icon: Radio, permission: "broadcasts" },
      { href: "/media", label: "Media", icon: ImageIcon },
      { href: "/forms", label: "Forms", icon: FileText },
      { href: "/settings?tab=crm", label: "CRM Settings", icon: Settings },
    ]
  },
  {
    // Finance lives in its own module now — the ledger, GST and GL
    // pages moved here out of Retail, which keeps only store
    // operations. Physical table names keep their commerce_ prefix;
    // the module split is presentation + RBAC only.
    label: "Accounting",
    icon: Landmark,
    items: [
      { href: "/accounting/ledgers", label: "Ledgers", icon: BookOpen },
      { href: "/accounting/new-entry", label: "New Entry", icon: PenSquare },
      { href: "/commerce/accounting", label: "Day Book", icon: CalendarClock },
      { href: "/accounting/trial-balance", label: "Trial Balance", icon: Scale },
      { href: "/accounting/profit-loss", label: "Profit & Loss", icon: TrendingUp },
      { href: "/accounting/balance-sheet", label: "Balance Sheet", icon: Landmark },
      { href: "/commerce/ledger", label: "Receivables / Khata", icon: Wallet },
      { href: "/commerce/gst", label: "GST Reports", icon: FileText },
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/expenses", label: "Expenses", icon: Receipt, permission: "people_view" },
      { href: "/settings?tab=accounting", label: "Accounting Settings", icon: Settings },
    ]
  },
  {
    label: "Retail",
    icon: Store,
    items: [
      { href: "/pos", label: "POS Terminal", icon: ShoppingCart },
      { href: "/commerce/products", label: "Products", icon: Package },
      { href: "/commerce/categories", label: "Categories", icon: Tag },
      { href: "/commerce/brands", label: "Brands", icon: Bookmark },
      { href: "/commerce/units", label: "Units", icon: Scale },
      { href: "/commerce/inventory", label: "Inventory", icon: Layers },
      { href: "/commerce/sales", label: "Sales Orders", icon: Receipt },
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
      { href: "/projects/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "projects_view" },
      { href: "/projects", label: "Projects", icon: Briefcase, permission: "projects_view" },
      { href: "/planning", label: "Planning", icon: CalendarClock, permission: "projects_view" },
      { href: "/tasks", label: "Tasks", icon: CheckSquare, permission: "projects_view" },
      { href: "/workloads", label: "Workload", icon: Activity, permission: "projects_view" },
      { href: "/timesheets", label: "Timesheets", icon: Clock, permission: "projects_view" },
      { href: "/invoices", label: "Invoices", icon: Receipt, permission: "projects_view" },
      { href: "/settings?tab=projects", label: "Project Settings", icon: Settings, permission: "projects_manage" },
    ]
  },
  {
    label: "HR Management",
    icon: Users,
    items: [
      { href: "/hr-dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "people_view" },
      { href: "/employees", label: "Employees", icon: Users, permission: "people_view" },
      { href: "/recruitment", label: "Recruitment", icon: Briefcase, permission: "people_manage" },
      { href: "/policies", label: "Policies & Compliance", icon: ShieldCheck, permission: "people_view" },
      { href: "/handbook", label: "Employee Handbook", icon: BookOpen, permission: "people_view" },
      { href: "/attendance", label: "Attendance", icon: CalendarClock, permission: "people_view" },
      // Also in Project Management, but its own page gates on
      // attendance_manage/people_manage — so an HR manager without
      // projects_view previously had no route to it at all.
      { href: "/timesheets", label: "Timesheets", icon: Clock, permission: "people_view" },
      { href: "/shifts", label: "Shifts", icon: Clock, permission: "people_manage" },
      { href: "/holidays", label: "Holidays", icon: Calendar, permission: "people_view" },
      { href: "/leave", label: "Leave", icon: Umbrella, permission: "people_view" },
      { href: "/payroll", label: "Payroll", icon: Banknote, permission: "people_manage" },
      { href: "/expenses", label: "Expenses", icon: Receipt, permission: "people_view" },
      { href: "/performance", label: "Performance", icon: TrendingUp, permission: "people_manage" },
      { href: "/requests", label: "Requests", icon: FileCheck, permission: "people_view" },
      { href: "/assets", label: "Assets", icon: Laptop, permission: "people_manage" },
      { href: "/documents", label: "Official Documents", icon: FileText },
      { href: "/departments", label: "Departments", icon: Building, permission: "people_manage" },
      { href: "/designations", label: "Designations", icon: BadgeCheck, permission: "people_manage" },
      { href: "/reports", label: "Analytics & Reports", icon: BarChart3, permission: "people_manage" },
      { href: "/settings?tab=hr", label: "HR Settings", icon: Settings, permission: "people_manage" },
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
  const { can, moduleAccess, activeWorkspace, isEmployee } = useWorkspace();
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
    // Ignore the query string: an item href of "/settings?tab=hr" must
    // still match the pathname "/settings", otherwise those links never
    // highlight and the group never opens.
    const matches = (item: { href: string }) => {
      const base = item.href.split("?")[0];
      return pathname === base || (base !== "/dashboard" && pathname.startsWith(base));
    };

    // Several destinations legitimately belong to more than one module —
    // /invoices sits in CRM, Accounting AND Project Management, /expenses in
    // both Accounting and HR. Picking the first match sent the rail jumping
    // to a different module than the one you clicked from. Staying put when
    // the current module also owns the destination is what makes navigation
    // feel predictable.
    const currentGroup = navGroups.find((g) => g.label === activeModule);
    if (currentGroup?.items.some(matches)) return;

    const matchedGroup = navGroups.find((group) => group.items.some(matches));
    if (matchedGroup) {
      setActiveModule(matchedGroup.label);
      localStorage.setItem("active_app_module", matchedGroup.label);
    }
  }, [pathname, activeModule]);

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
      const firstItem = group.items.find((item) => isItemVisible(item, can, isEmployee));
      if (firstItem) {
        router.push(firstItem.href);
      }
    }
  };

  // Get active menu items for selected module (only from accessible groups)
  const visibleItems = useMemo(() => {
    const group = accessibleGroups.find(g => g.label === activeModule);
    if (!group) return [];
    return group.items.filter((item) => isItemVisible(item, can, isEmployee));
  }, [accessibleGroups, activeModule, can, isEmployee]);

  // Find active group icon
  const ActiveGroupIcon = useMemo(() => {
    const group = accessibleGroups.find(g => g.label === activeModule);
    return group ? group.icon : AppWindow;
  }, [accessibleGroups, activeModule]);

  // Dynamic Theme Colors
  const sidebarBgClass = "bg-sidebar border-r border-sidebar-border text-sidebar-foreground";

  const switcherBg = isDark
    ? "border-border bg-transparent hover:bg-muted/10 text-foreground"
    : "border-border/80 bg-transparent hover:bg-muted/30 text-foreground";

  const dividerClass = isDark ? "border-t border-border" : "border-t border-border/60";

  const linkClass = (isActive: boolean) => {
    if (isActive) {
      return "bg-[rgba(37,99,235,0.16)] text-foreground font-medium";
    }
    return "text-muted-foreground hover:bg-muted/30 hover:text-foreground";
  };

  return (
    <>
      {/* Mobile Overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden"
        />
      )}

      {/* Main Sidebar Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full flex-col transition-all duration-300 ease-in-out",
          sidebarBgClass,
          isCollapsed ? "w-16" : "w-[248px]",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0 lg:transition-all"
        )}
        aria-label="Primary"
      >
        {/* Unified Header Row: Logo & Workspace Switcher in a single line */}
        <div className="flex h-[56px] shrink-0 items-center justify-between gap-1.5 px-3 border-b border-sidebar-border">
          {isCollapsed ? (
            /* Collapsed view: Show just the workspace avatar dropdown centered */
            <div className="w-full flex justify-center py-1">
              <WorkspaceSwitcher hideText minimalist />
            </div>
          ) : (
            /* Expanded view: Logo + Workspace Switcher + Collapse button in a single line */
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* The workspace's own logo when they have uploaded one in
                  Branding, so the tool wears the customer's brand rather
                  than ours. Falls back to ours only when none is set. */}
              <Link href="/dashboard" className="shrink-0 flex items-center justify-center">
                {activeWorkspace?.logo_url ? (
                   
                  // user-uploaded URL on an arbitrary host; next/image would
                  // need every one of them in remotePatterns.
                  <img
                    src={activeWorkspace.logo_url}
                    alt={activeWorkspace.name}
                    className="h-9 w-9 shrink-0 rounded object-contain"
                  />
                ) : (
                  <Image
                    src="/logolight.png"
                    alt="Dailybuz Logo"
                    width={36}
                    height={36}
                    className="h-9 w-9 object-contain shrink-0"
                    priority
                  />
                )}
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
              className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-slate-850 text-muted-foreground hover:text-foreground transition-colors"
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
              className="flex h-8 w-8 items-center justify-center rounded-md lg:hidden text-muted-foreground hover:text-foreground"
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
                    isCollapsed ? "px-1 py-1 justify-center border-transparent bg-transparent hover:bg-muted/40" : ""
                  )}
                  title={isCollapsed ? activeModule : "Switch module"}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none bg-primary/15 text-primary border border-primary/20">
                      <ActiveGroupIcon className="h-3.5 w-3.5" />
                    </div>
                    {!isCollapsed && (
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground leading-tight">
                          {activeModule}
                        </p>
                        <p className="text-[8px] text-primary font-extrabold uppercase tracking-wider leading-none mt-0.5">
                          Switch module
                        </p>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
              }
            />
            
            <DropdownMenuContent
              align={isCollapsed ? "start" : "center"}
              side={isCollapsed ? "right" : "bottom"}
              sideOffset={12}
              className="w-56 bg-card border border-border text-foreground p-1.5 rounded-2xl shadow-xl z-50"
            >
              <div className="px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                App Modules
              </div>
              <DropdownMenuSeparator className="bg-border my-1" />
              
              {accessibleGroups.map((group) => {
                const GroupIcon = group.icon;
                const isSelected = activeModule === group.label;
                
                return (
                  <DropdownMenuItem
                    key={group.label}
                    onClick={() => handleSwitchModule(group.label)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition-all focus:bg-muted focus:text-foreground cursor-pointer",
                      isSelected
                        ? "bg-primary/15 text-primary focus:bg-primary/20 focus:text-primary"
                        : "text-muted-foreground hover:text-foreground"
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
          <div className="border-t border-border/40 w-full" />
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
                // Collapsed hides the label span, leaving the link with no
                // accessible name at all — an icon is not a name.
                aria-label={isCollapsed ? item.label : undefined}
                title={undefined}
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
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-14 z-50 origin-left scale-0 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md transition-transform group-hover:scale-100 group-focus-visible:scale-100"
                  >
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
              className="flex h-11 w-11 mx-auto items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-850 mb-1"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={3} />
            </button>
          )}
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground/60">
              <span>CRM v2</span>
              <span>by Daylink</span>
            </div>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  // Collapsed shows only the avatar, so the trigger needs a
                  // name of its own.
                  aria-label={isCollapsed ? `Account: ${profile?.full_name ?? "User"}` : undefined}
                  title={isCollapsed ? (profile?.full_name ?? "Account") : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus:outline-none cursor-pointer hover:bg-muted/30",
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
                      <p className="truncate text-xs font-bold text-foreground">
                        {profile?.full_name ?? "User"}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground mt-0.5">
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
              className="min-w-56 bg-card border border-border text-foreground p-1.5 rounded-2xl shadow-xl z-50"
            >
              {!isCollapsed && (
                <div className="px-3 py-2 border-b border-border/60 mb-1">
                  <p className="text-xs font-bold text-foreground truncate">{profile?.full_name ?? "User"}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{profile?.email ?? ""}</p>
                </div>
              )}
              <DropdownMenuItem render={<Link href="/settings?tab=profile" />}>
                <User className="size-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings?tab=overview" />}>
                <Settings className="size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-muted/60" />
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
