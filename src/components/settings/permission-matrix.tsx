"use client";

// ============================================================
// PermissionMatrix — the 32-resource × 4-action CRUD grid.
//
// Everything is driven off `@/lib/auth/resources` (the same catalog the
// RLS migration is generated from), so adding a resource there makes it
// appear here with no change to this file.
//
// Scale strategy for 128 checkboxes (see the helpers in
// `@/lib/auth/permission-matrix`, which are unit-tested):
//   • collapsible module groups, so at most one module is expanded
//   • a per-module master switch (writes `module_<key>` too)
//   • per-column header toggles, scoped to the module group
//   • a per-row "All" toggle
//   • select-all / clear-all for the whole matrix
//   • presets (Full access / Read-only / CRM only / No access)
//   • a live "48 of 128 permissions granted" readout, plus per-module
//     subtotals on every collapsed group header
//
// A module whose switch is off keeps its ticks (nothing is deleted) but
// the rows are dimmed and the header says the module is denied — the DB
// helper checks `module_<key>` before the CRUD key, so the ticks are
// inert until the module is switched back on.
// ============================================================

import { useState } from "react";
import { ChevronRight, EyeOff, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ACTIONS,
  ACTION_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
  permissionKey,
  resourcesByModule,
  type ModuleKey,
} from "@/lib/auth/resources";
import {
  MATRIX_PRESETS,
  countGrantedInModule,
  grantedSummary,
  isModuleEnabled,
  matrixState,
  moduleActionState,
  moduleState,
  presetPermissions,
  resourceState,
  setAllPermissions,
  setModule,
  setModuleAction,
  setModuleEnabled,
  setPermission,
  setResource,
  type PermissionMap,
  type TriState,
} from "@/lib/auth/permission-matrix";

/** Column template shared by the header row and every resource row. */
const GRID_COLS =
  "grid grid-cols-[minmax(10rem,1fr)_repeat(5,minmax(3.25rem,3.5rem))] items-center gap-x-1";

function TriCheckbox({
  state,
  onToggle,
  label,
  disabled,
}: {
  state: TriState;
  onToggle: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      aria-label={label}
      checked={state === "all"}
      indeterminate={state === "some"}
      disabled={disabled}
      onCheckedChange={() => onToggle(state !== "all")}
    />
  );
}

function ModuleGroup({
  module,
  perms,
  onChange,
  readOnly,
  open,
  onOpenChange,
}: {
  module: ModuleKey;
  perms: PermissionMap;
  onChange: (next: PermissionMap) => void;
  readOnly: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const resources = resourcesByModule(module);
  const enabled = isModuleEnabled(perms, module);
  const subtotal = countGrantedInModule(perms, module);
  const groupState = moduleState(perms, module);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* ── Group header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-card-2/60 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-md"
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="truncate text-sm font-semibold text-foreground">
            {MODULE_LABELS[module]}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 tabular-nums",
              subtotal.granted === 0 && "text-muted-foreground",
            )}
          >
            {subtotal.granted}/{subtotal.total}
          </Badge>
          {!enabled ? (
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-border text-muted-foreground"
            >
              <EyeOff aria-hidden />
              Module off
            </Badge>
          ) : null}
        </button>

        {/* Module master switch. Flipping it ON grants the whole group,
            flipping it OFF revokes it — the "all or nothing" gesture.
            The subtler "keep the ticks, just close the module" case is
            the small link below the header. */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Switch
                  aria-label={`${MODULE_LABELS[module]} module access`}
                  checked={enabled}
                  disabled={readOnly}
                  onCheckedChange={(checked) => {
                    // Turning a module on also grants its rows when the
                    // group is empty, so the switch never leaves a role
                    // able to open a module with nothing in it.
                    if (checked && groupState === "none") {
                      onChange(setModule(perms, module, true));
                    } else if (!checked) {
                      onChange(setModuleEnabled(perms, module, false));
                    } else {
                      onChange(setModuleEnabled(perms, module, true));
                    }
                  }}
                />
              }
            />
            <TooltipContent>
              {enabled
                ? `Members with this role can open ${MODULE_LABELS[module]}.`
                : `${MODULE_LABELS[module]} is hidden for this role, whatever the ticks below say.`}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {open ? (
        <div className="overflow-x-auto">
          <div className="min-w-[34rem]">
            {/* ── Column headers with per-column bulk toggles ──── */}
            <div
              className={cn(
                GRID_COLS,
                "border-y border-border bg-muted/40 px-3 py-2",
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Resource
              </span>
              {ACTIONS.map((action) => {
                const colState = moduleActionState(perms, module, action);
                return (
                  <div
                    key={action}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {ACTION_LABELS[action]}
                    </span>
                    <TriCheckbox
                      state={colState}
                      disabled={readOnly}
                      onToggle={(next) =>
                        onChange(setModuleAction(perms, module, action, next))
                      }
                      label={`${ACTION_LABELS[action]} for every ${MODULE_LABELS[module]} resource`}
                    />
                  </div>
                );
              })}
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  All
                </span>
                <TriCheckbox
                  state={groupState}
                  disabled={readOnly}
                  onToggle={(next) => onChange(setModule(perms, module, next))}
                  label={`Every permission in ${MODULE_LABELS[module]}`}
                />
              </div>
            </div>

            {/* ── Resource rows ─────────────────────────────────── */}
            <ul className="divide-y divide-border/70">
              {resources.map((resource) => {
                const rowState = resourceState(perms, resource.key);
                return (
                  <li
                    key={resource.key}
                    className={cn(
                      GRID_COLS,
                      "px-3 py-2 transition-opacity hover:bg-muted/30",
                      // De-emphasise (never delete) rows in a disabled
                      // module — the ticks are kept, they're just inert.
                      !enabled && "opacity-45",
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {resource.label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {resource.description}
                      </p>
                    </div>
                    {ACTIONS.map((action) => (
                      <div key={action} className="flex justify-center">
                        <Checkbox
                          aria-label={`${ACTION_LABELS[action]} ${resource.label}`}
                          checked={
                            perms[permissionKey(resource.key, action)] === true
                          }
                          disabled={readOnly}
                          onCheckedChange={(checked) =>
                            onChange(
                              setPermission(
                                perms,
                                resource.key,
                                action,
                                checked === true,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                    <div className="flex justify-center">
                      <TriCheckbox
                        state={rowState}
                        disabled={readOnly}
                        onToggle={(next) =>
                          onChange(setResource(perms, resource.key, next))
                        }
                        label={`Every action on ${resource.label}`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            {!enabled ? (
              <p className="border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {MODULE_LABELS[module]} is switched off for this role. These
                ticks are kept but have no effect until the module is
                re-enabled.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PermissionMatrix({
  value,
  onChange,
  readOnly = false,
  className,
}: {
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  readOnly?: boolean;
  className?: string;
}) {
  // Start with CRM expanded: one open group keeps the initial view to a
  // single screenful instead of 32 rows of checkboxes.
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    crm: true,
  });

  const { granted, total } = grantedSummary(value);
  const overall = matrixState(value);

  return (
    <div className={cn("space-y-3", className)}>
      {/* ── Toolbar: live count + whole-matrix bulk actions ────── */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card-2/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground tabular-nums">
            {granted} of {total} permissions granted
          </p>
          <p className="text-xs text-muted-foreground">
            {overall === "all"
              ? "Full access to every resource."
              : granted === 0
                ? "No access yet — pick a preset or tick what this role needs."
                : "Modules that are switched off stay denied regardless of ticks."}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!readOnly ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Sparkles className="size-4" />
                    Preset
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Start from</DropdownMenuLabel>
                {MATRIX_PRESETS.map((preset) => (
                  <DropdownMenuItem
                    key={preset.value}
                    onClick={() => onChange(presetPermissions(preset.value))}
                  >
                    <span className="flex flex-col items-start">
                      <span className="text-sm">{preset.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {preset.hint}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || overall === "all"}
            onClick={() => onChange(setAllPermissions(value, true))}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || overall === "none"}
            onClick={() => onChange(setAllPermissions(value, false))}
          >
            Select none
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const allOpen = MODULE_KEYS.every((m) => openModules[m]);
              setOpenModules(
                Object.fromEntries(MODULE_KEYS.map((m) => [m, !allOpen])),
              );
            }}
          >
            {MODULE_KEYS.every((m) => openModules[m])
              ? "Collapse all"
              : "Expand all"}
          </Button>
        </div>
      </div>

      {/* ── One collapsible group per module ───────────────────── */}
      <div className="space-y-2">
        {MODULE_KEYS.map((module) => (
          <ModuleGroup
            key={module}
            module={module}
            perms={value}
            onChange={onChange}
            readOnly={readOnly}
            open={openModules[module] === true}
            onOpenChange={(open) =>
              setOpenModules((prev) => ({ ...prev, [module]: open }))
            }
          />
        ))}
      </div>
    </div>
  );
}
