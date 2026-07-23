"use client";

import { useState } from "react";
import Image from "next/image";
import { useWorkspace } from "@/hooks/use-workspace";
import { ChevronsUpDown, Plus, Check, Briefcase, AlertTriangle } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function WorkspaceSwitcher() {
  const {
    workspaces,
    activeWorkspace,
    activeRole,
    loading,
    switchWorkspace,
    createWorkspace,
  } = useWorkspace();

  const { mode } = useTheme();
  const isDark = mode === "dark";

  // Dynamic switcher styling depending on light vs dark sidebar look
  const switcherBg = isDark
    ? "border-border bg-card hover:bg-muted/80 text-foreground"
    : "border-slate-700 bg-slate-950/40 hover:bg-slate-800/80 text-white";

  const switcherTextClass = isDark ? "text-foreground" : "text-white";
  const switcherRoleClass = isDark ? "text-primary" : "text-primary-foreground/80";
  const switcherArrowClass = isDark ? "text-muted-foreground" : "text-slate-300";
  const switcherLogoBorder = isDark ? "border-border bg-muted" : "border-slate-800 bg-slate-950";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const maxWorkspaces = activeWorkspace?.plan_limits?.max_workspaces;
  const isLimitReached = maxWorkspaces !== null && maxWorkspaces !== undefined && workspaces.length >= maxWorkspaces;

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const created = await createWorkspace(newWorkspaceName.trim());
      if (created) {
        setNewWorkspaceName("");
        setIsDialogOpen(false);
        toast.success("Workspace created");
      }
    } catch (error: any) {
      console.error("Error creating workspace:", error);
      toast.error(error.message || "Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-between rounded-[10px] border border-border bg-card px-3 py-2 text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-dashed border-border bg-card px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
              <Plus className="h-4 w-4" />
            </div>
            <span className="truncate text-xs font-semibold">Create Workspace</span>
          </div>
        </button>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
            {isLimitReached ? (
              <div className="py-6 text-center space-y-4">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
                <DialogTitle className="text-lg font-semibold text-white">
                  Workspace limit reached
                </DialogTitle>
                <p className="text-sm text-slate-300">
                  You have reached the maximum of <strong>{maxWorkspaces}</strong> workspaces allowed by your current plan.
                </p>
                <p className="text-xs text-slate-400">
                  Upgrade your plan to unlock more workspaces.
                </p>
                <DialogFooter className="mt-4 justify-center sm:justify-center flex-row gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDialogOpen(false)}
                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setIsDialogOpen(false);
                      window.location.href = "/settings?tab=billing";
                    }}
                    className="bg-primary hover:bg-primary-hover text-white font-medium"
                  >
                    Upgrade Plan
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleCreateWorkspace}>
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-white">
                    Create New Workspace
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name-empty" className="text-sm font-medium text-slate-300">
                      Workspace Name
                    </Label>
                    <Input
                      id="name-empty"
                      placeholder="e.g. Sales Team, Marketing Dept"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      className="bg-slate-950 border-slate-800 focus:border-primary focus:ring-primary text-white"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDialogOpen(false)}
                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating || !newWorkspaceName.trim()}
                    className="bg-primary hover:bg-primary-hover text-white font-medium"
                  >
                    {isCreating ? "Creating..." : "Create Workspace"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={cn("flex w-full items-center justify-between gap-2 rounded-[10px] transition-all focus:outline-none focus:ring-1 focus:ring-primary px-3 py-2.5 text-left text-sm font-medium", switcherBg)}>
          <div className="flex items-center gap-2.5 min-w-0">
            {activeWorkspace.logo_url ? (
              <div className={cn("h-7 w-7 shrink-0 rounded overflow-hidden relative border", switcherLogoBorder)}>
                <Image
                  src={activeWorkspace.logo_url}
                  alt={activeWorkspace.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                <Briefcase className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <p className={cn("truncate text-xs font-semibold", switcherTextClass)}>
                {activeWorkspace.name}
              </p>
              <p className={cn("text-[10px] capitalize font-medium", switcherRoleClass)}>
                {activeRole || "Member"}
              </p>
            </div>
          </div>
          <ChevronsUpDown className={cn("h-4 w-4 shrink-0", switcherArrowClass)} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-56 bg-popover border-border text-popover-foreground rounded-[10px] shadow-md"
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1.5">
            Workspaces
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />
          <div className="max-h-60 overflow-y-auto">
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspace.id;
              return (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => switchWorkspace(workspace.id)}
                  className="flex items-center justify-between px-2 py-2 text-foreground focus:bg-primary/10 focus:text-primary cursor-pointer rounded-[8px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {workspace.logo_url ? (
                      <div className="h-5 w-5 shrink-0 rounded overflow-hidden relative border border-border bg-muted">
                        <Image
                          src={workspace.logo_url}
                          alt={workspace.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Briefcase className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <span className="truncate text-sm font-medium">
                      {workspace.name}
                    </span>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                </DropdownMenuItem>
              );
            })}
          </div>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2 px-2 py-2 text-primary focus:bg-primary/10 focus:text-primary font-medium cursor-pointer rounded-[8px]"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Create Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
          {isLimitReached ? (
            <div className="py-6 text-center space-y-4">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
              <DialogTitle className="text-lg font-semibold text-white">
                Workspace limit reached
              </DialogTitle>
              <p className="text-sm text-slate-300">
                You have reached the maximum of <strong>{maxWorkspaces}</strong> workspaces allowed by your current plan.
              </p>
              <p className="text-xs text-slate-400">
                Upgrade your plan to unlock more workspaces.
              </p>
              <DialogFooter className="mt-4 justify-center sm:justify-center flex-row gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false);
                    window.location.href = "/settings?tab=billing";
                  }}
                  className="bg-[#00aef0] hover:bg-[#008ec4] text-white font-medium"
                >
                  Upgrade Plan
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateWorkspace}>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-white">
                  Create New Workspace
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-sm font-medium text-slate-300">
                    Workspace Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Sales Team, Marketing Dept"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="bg-slate-950 border-slate-800 focus:border-[#00aef0] focus:ring-[#00aef0] text-white"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || !newWorkspaceName.trim()}
                  className="bg-[#00aef0] hover:bg-[#008ec4] text-white font-medium shadow-md shadow-[#00aef0]/10"
                >
                  {isCreating ? "Creating..." : "Create Workspace"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
