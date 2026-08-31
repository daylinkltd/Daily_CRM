"use client";

import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { ChevronsUpDown, Plus, Check, Building2, AlertTriangle } from "lucide-react";
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
import {
  ModulePicker,
  initialSelection,
  type ModuleSelection,
} from "@/components/workspace/module-picker";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function WorkspaceSwitcher({ hideText = false, minimalist = false }: { hideText?: boolean; minimalist?: boolean }) {
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
  const switcherBg = minimalist
    ? "border-transparent bg-transparent hover:bg-muted/40 text-foreground px-2 py-1.5"
    : isDark
    ? "border-border bg-card hover:bg-muted/80 text-foreground"
    : "border-border bg-background/40 hover:bg-muted/80 text-foreground";

  const switcherTextClass = isDark ? "text-foreground" : "text-foreground";
  const switcherRoleClass = isDark ? "text-primary" : "text-primary-foreground/80";
  const switcherArrowClass = isDark ? "text-muted-foreground" : "text-foreground";
  const switcherLogoBorder = isDark ? "border-border bg-muted" : "border-border bg-background";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // A second workspace is usually a different part of the same business
  // -- a new branch, a new venture -- so it gets asked the same two
  // questions rather than inheriting the first one's module set.
  const [selection, setSelection] = useState<ModuleSelection>(() => initialSelection());

  const maxWorkspaces = activeWorkspace?.plan_limits?.max_workspaces;
  const isLimitReached = maxWorkspaces !== null && maxWorkspaces !== undefined && workspaces.length >= maxWorkspaces;

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const created = await createWorkspace(newWorkspaceName.trim());
      if (created) {
        // Applied after creation rather than inside it: the workspace is
        // the thing that must exist, and a module selection that failed
        // to save is recoverable in settings, whereas a workspace that
        // failed to create is not recoverable at all.
        const { error: moduleError } = await createClient().rpc(
          "set_workspace_modules",
          {
            p_workspace: created.id,
            p_modules: selection.modules,
            p_business_type: selection.businessType,
            p_team_size: selection.teamSize,
          },
        );
        if (moduleError) {
          toast.warning(
            "Workspace created, but the module selection did not save. Set it in Settings → Modules.",
          );
        } else {
          toast.success("Workspace created");
        }
        setNewWorkspaceName("");
        setSelection(initialSelection());
        setIsDialogOpen(false);
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
      <div className={cn("flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-muted-foreground", hideText ? "px-1.5 py-1.5" : "")}>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-pulse rounded-none bg-muted" />
          {!hideText && <div className="h-4 w-24 animate-pulse rounded-none bg-muted" />}
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
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
            hideText ? "px-1.5 py-1.5 justify-center" : ""
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-muted text-muted-foreground">
              <Plus className="h-4 w-4" />
            </div>
            {!hideText && <span className="truncate text-xs font-semibold">Create Workspace</span>}
          </div>
        </button>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
            {isLimitReached ? (
              <div className="py-6 text-center space-y-4">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Workspace limit reached
                </DialogTitle>
                <p className="text-sm text-foreground">
                  You have reached the maximum of <strong>{maxWorkspaces}</strong> workspaces allowed by your current plan.
                </p>
                <p className="text-xs text-muted-foreground">
                  Upgrade your plan to unlock more workspaces.
                </p>
                <DialogFooter className="mt-4 justify-center sm:justify-center flex-row gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDialogOpen(false)}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setIsDialogOpen(false);
                      window.location.href = "/settings?tab=billing";
                    }}
                    className="bg-primary hover:bg-primary-hover text-foreground font-medium"
                  >
                    Upgrade Plan
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleCreateWorkspace}>
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-foreground">
                    Create New Workspace
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name-empty" className="text-sm font-medium text-foreground">
                      Workspace Name
                    </Label>
                    <Input
                      id="name-empty"
                      placeholder="e.g. Sales Team, Marketing Dept"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      className="bg-background border-border focus:border-primary focus:ring-primary text-foreground"
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
                    className="text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating || !newWorkspaceName.trim()}
                    className="bg-primary hover:bg-primary-hover text-foreground font-medium"
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
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn("flex w-full items-center justify-between gap-2 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-primary px-3 py-2.5 text-left text-sm font-medium", switcherBg, hideText ? "px-1 py-1 justify-center" : "")}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Only a real logo is shown. The generic Building2 tile was
                    a placeholder standing in for branding that does not
                    exist — with the brand logo already in the sidebar beside
                    this, a second empty icon square is pure noise. When
                    collapsed there is nothing else to identify the
                    workspace, so an initial stands in there. */}
                {/* Only when collapsed. Expanded, the sidebar already shows
                    the workspace logo immediately to the left of this
                    switcher — rendering it again put two copies of the same
                    logo side by side. Collapsed there is nothing else, so
                    the logo (or an initial) still identifies the
                    workspace. */}
                {hideText && activeWorkspace.logo_url ? (
                  <div className={cn("relative h-7 w-7 shrink-0 overflow-hidden rounded border", switcherLogoBorder)}>
                    {/* Deliberately NOT next/image: it throws on a host
                        absent from remotePatterns, and this renders inside
                        the sidebar — so a single unexpected logo_url
                        white-screened the entire app shell. A plain img
                        degrades to a broken image instead. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeWorkspace.logo_url}
                      alt={activeWorkspace.name}
                      className="absolute inset-0 size-full object-cover"
                    />
                  </div>
                ) : hideText ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
                    {activeWorkspace.name?.charAt(0)?.toUpperCase() ?? "W"}
                  </div>
                ) : null}
                {!hideText && (
                  <div className="min-w-0">
                    <p className={cn("truncate text-xs font-semibold", switcherTextClass)}>
                      {activeWorkspace.name}
                    </p>
                    <p className={cn("text-[10px] capitalize font-medium", switcherRoleClass)}>
                      {activeRole || "Member"}
                    </p>
                  </div>
                )}
              </div>
              {!hideText && <ChevronsUpDown className={cn("h-4 w-4 shrink-0", switcherArrowClass)} />}
            </button>
          }
        />
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-56 bg-popover border-border text-popover-foreground rounded-lg shadow-md"
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
                  className="flex items-center justify-between px-2 py-2 text-foreground focus:bg-primary/10 focus:text-primary cursor-pointer rounded-md"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {workspace.logo_url ? (
                      <div className="h-5 w-5 shrink-0 rounded-none overflow-hidden relative border border-border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={workspace.logo_url}
                          alt={workspace.name}
                          className="absolute inset-0 size-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-none bg-primary/10 text-primary">
                        <Building2 className="h-3.5 w-3.5" />
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
          {/* Only the account owner creates workspaces. A new workspace
              inherits the tenant's plan and draws on its seat pool, so
              a member spinning one up would extend an account they do
              not pay for and the owner cannot see.

              `assert_may_create_workspace` is the actual rule; this
              just stops offering a button that would refuse. The empty
              state above stays open deliberately — someone with no
              workspace at all is signing up, not extending anyone. */}
          {activeRole === 'owner' && (
            <>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => setIsDialogOpen(true)}
                className="flex items-center gap-2 px-2 py-2 text-primary focus:bg-primary/10 focus:text-primary font-medium cursor-pointer rounded-md"
              >
                <Plus className="h-4 w-4 shrink-0" />
                Create Workspace
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
          {isLimitReached ? (
            <div className="py-6 text-center space-y-4">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
              <DialogTitle className="text-lg font-semibold text-foreground">
                Workspace limit reached
              </DialogTitle>
              <p className="text-sm text-foreground">
                You have reached the maximum of <strong>{maxWorkspaces}</strong> workspaces allowed by your current plan.
              </p>
              <p className="text-xs text-muted-foreground">
                Upgrade your plan to unlock more workspaces.
              </p>
              <DialogFooter className="mt-4 justify-center sm:justify-center flex-row gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false);
                    window.location.href = "/settings?tab=billing";
                  }}
                  className="bg-primary hover:bg-primary-hover text-primary-foreground font-medium"
                >
                  Upgrade Plan
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateWorkspace}>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Create New Workspace
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-sm font-medium text-foreground">
                    Workspace Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Sales Team, Marketing Dept"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="bg-background border-border focus:border-primary focus:ring-primary text-foreground"
                    required
                    autoFocus
                  />
                </div>

                <div className="max-h-[55vh] overflow-y-auto pr-1">
                  <ModulePicker value={selection} onChange={setSelection} />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || !newWorkspaceName.trim()}
                  className="bg-primary hover:bg-primary-hover text-primary-foreground font-medium shadow-md shadow-primary/10"
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
