"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace, type WorkspacePermissions } from "@/hooks/use-workspace";
import { useTotalUnread } from "@/hooks/use-total-unread";
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
  ShieldCheck,
  ImageIcon,
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

const navItems: {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: keyof WorkspacePermissions;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare, permission: "inbox" },
  { href: "/contacts", label: "Contacts", icon: Users, permission: "contacts" },
  { href: "/pipelines", label: "Pipelines", icon: GitBranch, permission: "pipelines" },
  { href: "/broadcasts", label: "Broadcasts", icon: Radio, permission: "broadcasts" },
  { href: "/automations", label: "Automations", icon: Zap, permission: "automations" },
  { href: "/integrations", label: "Integrations", icon: Blocks, permission: "integrations" },
  { href: "/media", label: "Media", icon: ImageIcon },
];

const bottomNavItems = [
  { href: "/docs", label: "Documentation", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
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

  // Filter nav items by ABAC permissions
  const visibleNavItems = navItems.filter(
    (item) => !item.permission || can(item.permission)
  );

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
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Primary"
      >
        {/* Logo row */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4">
          <Link href="/dashboard" className="flex items-center min-w-0">
            <Image
              src="/logolight.png"
              alt="Daily CRM"
              width={130}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
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
          <ul className="flex flex-col gap-1">
            {visibleNavItems.map((item) => {
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
                      isActive
                        ? "bg-[#00aef0]/15 text-[#00aef0]"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {showUnreadDot && (
                      <span
                        aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? "" : "s"}`}
                        className="relative flex h-2 w-2"
                      >
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00aef0] opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00aef0]" />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-4 border-t border-slate-800" />

          <ul className="flex flex-col gap-1">
            {bottomNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                      isActive
                        ? "bg-[#00aef0]/15 text-[#00aef0]"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-slate-800 p-3 flex flex-col gap-2">
          <div className="px-2 pb-1 pt-2 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">by Daylink</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-800/60 focus:bg-slate-800/60 focus:outline-none data-popup-open:bg-slate-800/60">
              <Avatar className="size-8 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "Avatar"}
                  />
                ) : null}
                <AvatarFallback className="bg-[#00aef0]/10 text-sm font-medium text-[#00aef0]">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56 bg-slate-900 text-slate-100 ring-slate-700"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
                    className="text-slate-200 focus:bg-slate-800 focus:text-white"
                  />
                }
              >
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=workspace"
                    onClick={onClose}
                    className="text-slate-200 focus:bg-slate-800 focus:text-white"
                  />
                }
              >
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-slate-200 focus:bg-slate-800 focus:text-white"
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
