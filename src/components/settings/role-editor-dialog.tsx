"use client";

// ============================================================
// RoleEditorDialog — create / edit / duplicate a workspace role.
//
// Wraps <PermissionMatrix /> with the name + description fields and the
// save round-trip. Three modes:
//
//   create    — blank matrix (CRM-only default), POST /api/workspace/roles
//   duplicate — create, pre-filled from another role's matrix
//   edit      — PATCH /api/workspace/roles
//
// Built-in (`is_system`) roles are editable, but only their permissions:
// the name and description inputs are locked with an explanatory
// tooltip, matching the server, which allows a permissions-only PATCH on
// system roles and still refuses renames and deletes. That is what makes
// "a Viewer who only sees CRM" possible without inventing a new role.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  normalizePermissions,
  presetPermissions,
  type PermissionMap,
} from "@/lib/auth/permission-matrix";
import { PermissionMatrix } from "./permission-matrix";
import type { WorkspaceRoleRow } from "./workspace-role";

export type RoleEditorMode = "create" | "edit" | "duplicate";

export function RoleEditorDialog({
  open,
  onOpenChange,
  mode,
  role,
  workspaceId,
  readOnly = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: RoleEditorMode;
  /** The role being edited, or the source role when duplicating. */
  role: WorkspaceRoleRow | null;
  workspaceId: string;
  readOnly?: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<PermissionMap>(() =>
    presetPermissions("none"),
  );
  const [saving, setSaving] = useState(false);

  const isSystem = mode === "edit" && role?.is_system === true;
  const lockIdentity = isSystem || readOnly;

  // Reset the form every time the dialog opens so a cancelled edit
  // never leaks into the next one.
  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setName("");
      setDescription("");
      setPerms(presetPermissions("crm_only"));
      return;
    }
    if (!role) return;
    setName(mode === "duplicate" ? `${role.name} copy` : role.name);
    setDescription(role.description ?? "");
    setPerms(normalizePermissions(role.permissions));
  }, [open, mode, role]);

  const title = useMemo(() => {
    if (mode === "edit") return readOnly ? `${role?.name}` : `Edit ${role?.name}`;
    if (mode === "duplicate") return `Duplicate ${role?.name}`;
    return "New role";
  }, [mode, role?.name, readOnly]);

  async function handleSave() {
    if (readOnly) return;
    const trimmed = name.trim();
    if (!isSystem && !trimmed) {
      toast.error("Give the role a name");
      return;
    }

    setSaving(true);
    try {
      const isPatch = mode === "edit";
      const body = isPatch
        ? {
            workspace_id: workspaceId,
            role_id: role?.id,
            // System roles: permissions only. Sending the name would be
            // rejected server-side, so don't pretend it's editable.
            ...(isSystem
              ? {}
              : { name: trimmed, description: description.trim() }),
            permissions: perms,
          }
        : {
            workspace_id: workspaceId,
            name: trimmed,
            description: description.trim() || undefined,
            permissions: perms,
          };

      const res = await fetch("/api/workspace/roles", {
        method: isPatch ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error || "Failed to save role");
        return;
      }
      toast.success(
        isPatch ? `Updated ${role?.name}` : `Created role "${trimmed}"`,
      );
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      console.error("[RoleEditorDialog] save error:", err);
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSystem ? <Lock className="size-4 text-muted-foreground" /> : null}
            {title}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? "You need the owner role to change permissions."
              : isSystem
                ? "Built-in role. Its name is fixed, but you can narrow which modules and actions it grants."
                : "Pick the resources this role can touch. Members inherit these permissions the next time they load the app."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="role-name" className="text-muted-foreground">
                Role name
              </Label>
              {lockIdentity ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Input
                        id="role-name"
                        value={name}
                        readOnly
                        disabled
                        className="disabled:opacity-70"
                      />
                    }
                  />
                  <TooltipContent>
                    {isSystem
                      ? "Built-in roles can't be renamed — duplicate it to make a custom variant."
                      : "Only the workspace owner can edit roles."}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Input
                  id="role-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sales Agent"
                  autoComplete="off"
                />
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="role-desc" className="text-muted-foreground">
                Description{" "}
                <span className="text-xs font-normal">(optional)</span>
              </Label>
              <Input
                id="role-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={lockIdentity}
                placeholder="What this role is for"
                autoComplete="off"
                className="disabled:opacity-70"
              />
            </div>
          </div>

          {isSystem ? (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" />
              Owner and Admin bypass the matrix in the database, so their
              ticks are informational. Viewer is enforced — narrowing its
              modules genuinely restricts what those members can open.
            </p>
          ) : null}

          <PermissionMatrix
            value={perms}
            onChange={setPerms}
            readOnly={readOnly}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly ? (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : mode === "edit" ? (
                "Save changes"
              ) : (
                "Create role"
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
