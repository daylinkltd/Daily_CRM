"use client";

// ============================================================
// RolesPanel — Settings → Roles & permissions.
//
// Its own settings section (registered in settings-sections.ts) rather
// than a block buried inside workspace-settings.tsx. Lists every
// `workspace_roles` row for the ACTIVE workspace only — the select is
// filtered on `workspace_id` and RLS scopes the table as well, so another
// tenant's roles can never appear here.
//
// Per row: name, description, a "System" badge for built-ins, how many
// members use it, and Edit / Duplicate / Delete. Delete and rename are
// disabled for `is_system` roles with a tooltip saying why; permissions
// on built-ins (notably Viewer) stay editable.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Copy,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { MODULE_KEYS, MODULE_LABELS } from "@/lib/auth/resources";
import {
  countGranted,
  isModuleEnabled,
  normalizePermissions,
  TOTAL_CRUD_PERMISSIONS,
} from "@/lib/auth/permission-matrix";
import { SettingsPanelHead } from "./settings-panel-head";
import { RoleEditorDialog, type RoleEditorMode } from "./role-editor-dialog";
import {
  sortRoles,
  WORKSPACE_ROLE_COLUMNS,
  type WorkspaceRoleRow,
} from "./workspace-role";
import { IconAction } from "@/components/ui/icon-action";

export function RolesPanel() {
  const supabase = createClient();
  const {
    activeWorkspace,
    activeRole,
    loading: workspaceLoading,
  } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;

  // The roles API is owner-gated, so anyone else gets a read-only view
  // rather than buttons that 403.
  const canManage = activeRole === "owner";

  const [roles, setRoles] = useState<WorkspaceRoleRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<RoleEditorMode>("create");
  const [editorRole, setEditorRole] = useState<WorkspaceRoleRow | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceRoleRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    // Both queries are filtered on the active workspace — multi-tenant
    // safe on top of RLS.
    const [rolesRes, membersRes] = await Promise.all([
      supabase
        .from("workspace_roles")
        .select(WORKSPACE_ROLE_COLUMNS)
        .eq("workspace_id", workspaceId),
      supabase
        .from("workspace_members")
        .select("role_id")
        .eq("workspace_id", workspaceId),
    ]);

    if (rolesRes.error) {
      console.error("[RolesPanel] load roles error:", rolesRes.error);
      toast.error("Failed to load roles");
      setLoading(false);
      return;
    }

    setRoles(sortRoles((rolesRes.data ?? []) as WorkspaceRoleRow[]));

    const counts: Record<string, number> = {};
    for (const row of membersRes.data ?? []) {
      const id = (row as { role_id: string | null }).role_id;
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    }
    setMemberCounts(counts);
    setLoading(false);
  }, [supabase, workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      // Don't spin forever if the workspace context settled with nothing.
      if (!workspaceLoading) setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [load, workspaceId, workspaceLoading]);

  const customCount = useMemo(
    () => roles.filter((r) => !r.is_system).length,
    [roles],
  );

  function openEditor(mode: RoleEditorMode, role: WorkspaceRoleRow | null) {
    setEditorMode(mode);
    setEditorRole(role);
    setEditorOpen(true);
  }

  async function handleDelete() {
    if (!deleting || !workspaceId) return;
    setDeletePending(true);
    try {
      const res = await fetch("/api/workspace/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          role_id: deleting.id,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error || "Failed to delete role");
        return;
      }
      toast.success(`Deleted "${deleting.name}"`);
      setDeleting(null);
      await load();
    } catch (err) {
      console.error("[RolesPanel] delete error:", err);
      toast.error("Could not reach the server");
    } finally {
      setDeletePending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Roles & permissions"
          description="Pick a workspace to manage its roles."
        />
      </section>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-5 duration-200">
      <SettingsPanelHead
        title="Roles & permissions"
        description="A role is a grid of create / read / update / delete ticks across every resource in the app. Assign one to each teammate from Team members."
        action={
          canManage ? (
            <IconAction label="New role" icon={<Plus className="size-4" />} onClick={() => openEditor("create", null)} />
          ) : null
        }
      />

      {!canManage ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          You can review roles here, but only the workspace owner can create
          or change them.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {roles.length} role{roles.length === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground/70">
          · {roles.length - customCount} built-in · {customCount} custom
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {roles.map((role) => {
              const perms = normalizePermissions(role.permissions);
              const granted = countGranted(perms);
              const members = memberCounts[role.id] ?? 0;
              const enabledModules = MODULE_KEYS.filter((m) =>
                isModuleEnabled(perms, m),
              );

              return (
                <li
                  key={role.id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {role.name}
                      </span>
                      {role.is_system ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-primary/40 bg-primary/10 text-primary"
                        >
                          <ShieldCheck aria-hidden />
                          System
                        </Badge>
                      ) : null}
                      <Badge
                        variant="outline"
                        className="gap-1 border-border text-muted-foreground"
                      >
                        <UsersRound aria-hidden />
                        {members} member{members === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    {role.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {role.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {granted} of {TOTAL_CRUD_PERMISSIONS} permissions ·{" "}
                      {enabledModules.length === MODULE_KEYS.length
                        ? "all modules"
                        : enabledModules.length === 0
                          ? "no modules"
                          : enabledModules
                              .map((m) => MODULE_LABELS[m])
                              .join(", ")}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditor("edit", role)}
                    >
                      <Pencil className="size-4" />
                      {canManage ? "Edit" : "View"}
                    </Button>

                    {canManage ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <IconAction label="Duplicate" icon={<Copy className="size-4" />} variant="outline"
                              onClick={() => openEditor("duplicate", role)} />
                          }
                        />
                        <TooltipContent>
                          Duplicate as a new custom role
                        </TooltipContent>
                      </Tooltip>
                    ) : null}

                    {canManage ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={role.is_system || members > 0}
                              onClick={() => setDeleting(role)}
                              className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          }
                        />
                        <TooltipContent>
                          {role.is_system
                            ? "Built-in roles can't be renamed or deleted — you can still change their permissions."
                            : members > 0
                              ? "Re-assign the members using this role first."
                              : "Delete this role"}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <RoleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editorMode}
        role={editorRole}
        workspaceId={workspaceId}
        readOnly={!canManage}
        onSaved={load}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Delete role
            </DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">
                {deleting?.name}
              </span>
              ? This can&apos;t be undone. Members are never deleted — but no
              member may be assigned to this role.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deletePending}
              className="bg-destructive text-foreground hover:bg-destructive/90"
            >
              {deletePending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
