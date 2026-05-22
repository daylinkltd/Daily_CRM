"use client";

import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { ChevronsUpDown, Plus, Check, Briefcase } from "lucide-react";
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
    switchWorkspace,
    createWorkspace,
  } = useWorkspace();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-400">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-24 animate-pulse rounded bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-left text-sm font-medium text-white transition-all hover:bg-slate-800/80 hover:border-slate-700 focus:outline-none focus:ring-1 focus:ring-[#00aef0]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#00aef0]/10 text-[#00aef0]">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {activeWorkspace.name}
              </p>
              <p className="text-[10px] capitalize text-[#00aef0] font-medium">
                {activeRole || "Member"}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-56 bg-slate-900 border-slate-800 text-slate-100 ring-slate-700"
        >
          <DropdownMenuLabel className="text-xs text-slate-400 font-medium px-2 py-1.5">
            Workspaces
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-800" />
          <div className="max-h-60 overflow-y-auto">
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspace.id;
              return (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => switchWorkspace(workspace.id)}
                  className="flex items-center justify-between px-2 py-2 text-slate-200 focus:bg-[#00aef0]/15 focus:text-white cursor-pointer"
                >
                  <span className="truncate text-sm font-medium">
                    {workspace.name}
                  </span>
                  {isActive && <Check className="h-4 w-4 text-[#00aef0] shrink-0 ml-2" />}
                </DropdownMenuItem>
              );
            })}
          </div>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2 px-2 py-2 text-[#00aef0] focus:bg-[#00aef0]/10 focus:text-[#00aef0] font-medium cursor-pointer"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Create Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
