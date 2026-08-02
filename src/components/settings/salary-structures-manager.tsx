"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Layers,
  Coins,
  Star,
  AlertTriangle,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeSalaryBreakdown,
  validateStructure,
  PAYROLL_FIELDS,
  type SalaryComponent,
  type ComponentType,
  type CalculationType,
  type PayrollField,
} from "@/lib/hr/salary";
import { IconAction } from "@/components/ui/icon-action";
import { BulkEntryDialog } from "@/components/ui/bulk-entry-dialog";
import { useRowSelection } from "@/hooks/use-row-selection";
import {
  BulkActionBar,
  SelectAllCheckbox,
  SelectRowCheckbox,
} from "@/components/ui/bulk-action-bar";

const PREVIEW_BASIC = 30_000;

const PAYROLL_FIELD_LABELS: Record<PayrollField, string> = {
  basic_salary: "Basic salary",
  hra: "HRA",
  special_allowance: "Special allowance",
  pf_deduction: "PF deduction",
  professional_tax: "Professional tax",
  tds_deduction: "TDS deduction",
};

interface ComponentRow extends SalaryComponent {
  is_active: boolean;
}

interface StructureRow {
  id: string;
  name: string;
  code: string | null;
  min_basic_percent: number | null;
  is_default: boolean;
  is_active: boolean;
}

/** A component as it sits inside one structure, carrying its rate override. */
interface StructureMember {
  component_id: string;
  value_override: number | null;
  calculation_type: CalculationType | null;
  sort_order: number;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);

const BLANK_COMPONENT = {
  id: null as string | null,
  name: "",
  code: "",
  type: "EARNING" as ComponentType,
  calculation_type: "PERCENTAGE_OF_BASIC" as CalculationType,
  value_number: "0",
  is_statutory: false,
  is_taxable: true,
  payroll_field: "" as PayrollField | "",
};

export function SalaryStructuresManager({ canEdit }: { canEdit: boolean }) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [structures, setStructures] = useState<StructureRow[]>([]);

  // Component editor
  const [componentEditorOpen, setComponentEditorOpen] = useState(false);
  const [componentDraft, setComponentDraft] = useState(BLANK_COMPONENT);
  const [savingComponent, setSavingComponent] = useState(false);

  // Structure editor
  const [structureEditorOpen, setStructureEditorOpen] = useState(false);
  const [structureId, setStructureId] = useState<string | null>(null);
  const [structureName, setStructureName] = useState("");
  const [structureCode, setStructureCode] = useState("");
  const [minBasicPercent, setMinBasicPercent] = useState("0");
  const [isDefault, setIsDefault] = useState(false);
  const [members, setMembers] = useState<StructureMember[]>([]);
  const [savingStructure, setSavingStructure] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const structureSelection = useRowSelection(structures, (x) => x.id);
  const componentSelection = useRowSelection(components, (x) => x.id);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const [compRes, structRes] = await Promise.all([
        supabase
          .from("hr_salary_components")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .is("deleted_at", null)
          .order("sort_order"),
        supabase
          .from("hr_salary_structures")
          .select("id, name, code, min_basic_percent, is_default, is_active")
          .eq("workspace_id", activeWorkspace.id)
          .is("deleted_at", null)
          .order("name"),
      ]);

      setComponents((compRes.data as ComponentRow[] | null) || []);
      setStructures((structRes.data as StructureRow[] | null) || []);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load salary settings"));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const componentById = useMemo(
    () => new Map(components.map((c) => [c.id, c])),
    [components]
  );

  // ── Component editor ───────────────────────────────────────────
  const openComponentNew = () => {
    setComponentDraft(BLANK_COMPONENT);
    setComponentEditorOpen(true);
  };

  const openComponentEdit = (c: ComponentRow) => {
    setComponentDraft({
      id: c.id,
      name: c.name,
      code: c.code || "",
      type: c.type,
      calculation_type: c.calculation_type,
      value_number: String(c.value_number),
      is_statutory: c.is_statutory,
      is_taxable: (c as ComponentRow & { is_taxable?: boolean }).is_taxable ?? true,
      payroll_field: c.payroll_field || "",
    });
    setComponentEditorOpen(true);
  };

  const handleSaveComponent = async () => {
    if (!activeWorkspace?.id) return;
    if (!componentDraft.name.trim()) {
      toast.error("Give the component a name.");
      return;
    }
    const value = Number(componentDraft.value_number);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("The value must be zero or more.");
      return;
    }

    setSavingComponent(true);
    try {
      const payload = {
        workspace_id: activeWorkspace.id,
        name: componentDraft.name.trim(),
        code: componentDraft.code.trim() || null,
        type: componentDraft.type,
        calculation_type: componentDraft.calculation_type,
        value_number: value,
        is_statutory: componentDraft.is_statutory,
        is_taxable: componentDraft.is_taxable,
        payroll_field: componentDraft.payroll_field || null,
      };
      const { error } = componentDraft.id
        ? await supabase.from("hr_salary_components").update(payload).eq("id", componentDraft.id)
        : await supabase.from("hr_salary_components").insert(payload);
      if (error) throw error;
      toast.success(componentDraft.id ? "Component updated." : "Component added.");
      setComponentEditorOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save component"));
    } finally {
      setSavingComponent(false);
    }
  };

  const handleDeleteComponent = async (c: ComponentRow) => {
    if (!confirm(`Remove "${c.name}"? Structures using it will drop it.`)) return;
    try {
      const { error } = await supabase
        .from("hr_salary_components")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", c.id);
      if (error) throw error;
      toast.success("Component removed.");
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove component"));
    }
  };

  // ── Structure editor ───────────────────────────────────────────
  const openStructureNew = () => {
    setStructureId(null);
    setStructureName("");
    setStructureCode("");
    setMinBasicPercent("0");
    setIsDefault(false);
    // Start with EVERY component — earnings and deductions. Seeding only
    // earnings produced a structure where gross equalled net, because PF,
    // professional tax and TDS were silently left out.
    setMembers(
      components.map((c, i) => ({
        component_id: c.id,
        value_override: null,
        calculation_type: null,
        sort_order: i,
      }))
    );
    setStructureEditorOpen(true);
  };

  const openStructureEdit = async (s: StructureRow) => {
    setStructureId(s.id);
    setStructureName(s.name);
    setStructureCode(s.code || "");
    setMinBasicPercent(String(s.min_basic_percent ?? 0));
    setIsDefault(s.is_default);
    const { data } = await supabase
      .from("hr_salary_structure_components")
      .select("component_id, value_override, calculation_type, sort_order")
      .eq("structure_id", s.id)
      .order("sort_order");
    setMembers((data as StructureMember[] | null) || []);
    setStructureEditorOpen(true);
  };

  const toggleMember = (componentId: string) => {
    setMembers((prev) => {
      const exists = prev.some((m) => m.component_id === componentId);
      if (exists) return prev.filter((m) => m.component_id !== componentId);
      return [
        ...prev,
        {
          component_id: componentId,
          value_override: null,
          calculation_type: null,
          sort_order: prev.length,
        },
      ];
    });
  };

  const setMemberOverride = (componentId: string, raw: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.component_id === componentId
          ? { ...m, value_override: raw === "" ? null : Number(raw) }
          : m
      )
    );
  };

  /** The resolved components of the structure under edit, for the preview. */
  const editorComponents = useMemo<SalaryComponent[]>(() => {
    return members
      .map((m, i) => {
        const c = componentById.get(m.component_id);
        if (!c) return null;
        return {
          ...c,
          value_number: m.value_override ?? c.value_number,
          calculation_type: m.calculation_type || c.calculation_type,
          sort_order: m.sort_order ?? i,
        } as SalaryComponent;
      })
      .filter((c): c is SalaryComponent => c !== null);
  }, [members, componentById]);

  const preview = useMemo(
    () => computeSalaryBreakdown(editorComponents, PREVIEW_BASIC),
    [editorComponents]
  );
  const editorProblems = useMemo(
    () => validateStructure(editorComponents, Number(minBasicPercent) || 0),
    [editorComponents, minBasicPercent]
  );

  const handleSaveStructure = async () => {
    if (!activeWorkspace?.id) return;
    if (!structureName.trim()) {
      toast.error("Give the structure a name.");
      return;
    }
    if (members.length === 0) {
      toast.error("Add at least one component.");
      return;
    }

    setSavingStructure(true);
    try {
      // Only one default per workspace (partial unique index), so clear the
      // previous default before setting this one.
      if (isDefault) {
        await supabase
          .from("hr_salary_structures")
          .update({ is_default: false })
          .eq("workspace_id", activeWorkspace.id)
          .eq("is_default", true)
          .neq("id", structureId ?? "00000000-0000-0000-0000-000000000000");
      }

      const structurePayload = {
        workspace_id: activeWorkspace.id,
        name: structureName.trim(),
        code: structureCode.trim() || null,
        min_basic_percent: Number(minBasicPercent) || 0,
        is_default: isDefault,
      };

      let sid = structureId;
      if (sid) {
        const { error } = await supabase
          .from("hr_salary_structures")
          .update(structurePayload)
          .eq("id", sid);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("hr_salary_structures")
          .insert(structurePayload)
          .select("id")
          .single();
        if (error) throw error;
        sid = data.id;
      }

      // Replace the component set wholesale: it is small, and diffing rows
      // would be more code than it saves.
      await supabase.from("hr_salary_structure_components").delete().eq("structure_id", sid);
      if (members.length > 0) {
        const rows = members.map((m, i) => ({
          structure_id: sid,
          component_id: m.component_id,
          value_override: m.value_override,
          calculation_type: m.calculation_type,
          sort_order: m.sort_order ?? i,
        }));
        const { error } = await supabase.from("hr_salary_structure_components").insert(rows);
        if (error) throw error;
      }

      toast.success(structureId ? "Structure updated." : "Structure created.");
      setStructureEditorOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save structure"));
    } finally {
      setSavingStructure(false);
    }
  };

  const bulkAddComponents = async (rows: Record<string, string>[]) => {
    const { error } = await supabase.from("hr_salary_components").insert(
      rows.map((r) => {
        const type = (r.type || "EARNING").trim().toUpperCase();
        return {
          workspace_id: activeWorkspace!.id,
          name: r.name.trim(),
          code: r.code?.trim() || null,
          type: type === "DEDUCTION" ? "DEDUCTION" : "EARNING",
          // A row with a % value is a percentage of basic; anything else
          // is a flat monthly amount.
          calculation_type: r.percent_of_basic?.trim()
            ? "PERCENTAGE_OF_BASIC"
            : "FIXED_AMOUNT",
          value_number:
            Number(r.percent_of_basic || r.fixed_amount || 0) || 0,
        };
      })
    );
    if (error) throw error;
    toast.success(`Added ${rows.length} component${rows.length === 1 ? "" : "s"}.`);
    await fetchData();
  };

  const bulkSoftDelete = async (
    table: "hr_salary_structures" | "hr_salary_components",
    ids: string[],
    noun: string,
    onDone: () => void
  ) => {
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} ${noun}${ids.length === 1 ? "" : "s"}?`)) return;
    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids)
        .eq("workspace_id", activeWorkspace!.id);
      if (error) throw error;
      toast.success(`Deleted ${ids.length} ${noun}${ids.length === 1 ? "" : "s"}.`);
      onDone();
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, `Failed to delete ${noun}s`));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDeleteStructure = async (s: StructureRow) => {
    if (!confirm(`Delete "${s.name}"? Employees on it keep their current salary.`)) return;
    try {
      const { error } = await supabase
        .from("hr_salary_structures")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", s.id);
      if (error) throw error;
      toast.success("Structure deleted.");
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete structure"));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Structures */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-primary" /> Salary structures
            </CardTitle>
            <CardDescription>
              Reusable slabs — a set of earnings and deductions. Assign one to an employee with a
              basic salary and the whole breakdown is derived.
            </CardDescription>
          </div>
          {canEdit && (
            <IconAction label="New structure" icon={<Plus className="size-4" />} onClick={openStructureNew} className="shrink-0 gap-1.5" disabled={components.length === 0} />
          )}
        </CardHeader>
        <CardContent>
          {structures.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {components.length === 0
                ? "Add some components below first, then build a structure from them."
                : "No structures yet. Create one from your components."}
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {canEdit && (
                <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5">
                  <SelectAllCheckbox
                    checked={structureSelection.allVisibleSelected}
                    indeterminate={structureSelection.someVisibleSelected}
                    onChange={structureSelection.toggleAllVisible}
                    label="Select all structures"
                  />
                  <span className="text-[11px] text-muted-foreground">Select all</span>
                </div>
              )}
              {structures.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    {canEdit && (
                      <SelectRowCheckbox
                        checked={structureSelection.isSelected(s.id)}
                        onToggle={(o) => structureSelection.toggle(s.id, o)}
                        label={`Select ${s.name}`}
                      />
                    )}
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    {s.is_default && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Star className="size-2.5" /> Default
                      </Badge>
                    )}
                    {s.code && (
                      <Badge variant="outline" className="font-mono text-[10px]">{s.code}</Badge>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <IconAction
                        label={`Edit ${s.name}`}
                        icon={<Pencil className="size-3.5" />}
                        onClick={() => openStructureEdit(s)}
                      />
                      <IconAction
                        label={`Delete ${s.name}`}
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() => handleDeleteStructure(s)}
                        destructive
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Components */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="size-4 text-primary" /> Pay components
            </CardTitle>
            <CardDescription>
              The individual heads — basic, allowances and deductions — that structures are built
              from. A starter set is provided; add your own custom allowances here.
            </CardDescription>
          </div>
          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              <IconAction label="Bulk add" icon={<Layers className="size-4" />} onClick={() => setBulkAddOpen(true)} variant="outline" className="gap-1.5" />
              <IconAction label="Add component" icon={<Plus className="size-4" />} onClick={openComponentNew} variant="outline" className="gap-1.5" />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {components.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No components yet. Add basic salary, then allowances and deductions.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {canEdit && (
                <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5">
                  <SelectAllCheckbox
                    checked={componentSelection.allVisibleSelected}
                    indeterminate={componentSelection.someVisibleSelected}
                    onChange={componentSelection.toggleAllVisible}
                    label="Select all components"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Select all · shift-click to pick a range
                  </span>
                </div>
              )}
              {components.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {canEdit && (
                      <SelectRowCheckbox
                        checked={componentSelection.isSelected(c.id)}
                        onToggle={(o) => componentSelection.toggle(c.id, o)}
                        label={`Select ${c.name}`}
                      />
                    )}
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${
                        c.type === "EARNING"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {c.type === "EARNING" ? "Earning" : "Deduction"}
                    </Badge>
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.calculation_type === "PERCENTAGE_OF_BASIC"
                        ? `${c.value_number}% of basic`
                        : `${money(c.value_number)} fixed`}
                    </span>
                    {c.is_statutory && (
                      <Badge variant="outline" className="text-[10px]">Statutory</Badge>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <IconAction
                        label={`Edit ${c.name}`}
                        icon={<Pencil className="size-3.5" />}
                        onClick={() => openComponentEdit(c)}
                      />
                      <IconAction
                        label={`Remove ${c.name}`}
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() => handleDeleteComponent(c)}
                        destructive
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BulkActionBar
        count={structureSelection.selectedCount}
        onClear={structureSelection.clear}
        busy={bulkBusy}
        noun="structure"
      >
        <IconAction label="Delete" icon={<Trash2 className="size-3.5" />} variant="outline"
          onClick={() =>
            bulkSoftDelete("hr_salary_structures", structureSelection.selectedIds, "structure", structureSelection.clear)
          }
          disabled={bulkBusy}
          className="h-7 gap-1.5 text-xs text-destructive" />
      </BulkActionBar>

      <BulkActionBar
        count={componentSelection.selectedCount}
        onClear={componentSelection.clear}
        busy={bulkBusy}
        noun="component"
      >
        <IconAction label="Delete" icon={<Trash2 className="size-3.5" />} variant="outline"
          onClick={() =>
            bulkSoftDelete("hr_salary_components", componentSelection.selectedIds, "component", componentSelection.clear)
          }
          disabled={bulkBusy}
          className="h-7 gap-1.5 text-xs text-destructive" />
      </BulkActionBar>

      <BulkEntryDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        title="Add several pay components"
        description="Fill EITHER a percentage of basic OR a fixed amount for each row."
        scope="hr_salary_components"
        workspaceId={activeWorkspace?.id}
        noun="component"
        columns={[
          { key: "name", label: "Name", required: true, placeholder: "Transport Allowance" },
          { key: "code", label: "Code", placeholder: "TA" },
          { key: "type", label: "EARNING / DEDUCTION", placeholder: "EARNING" },
          { key: "percent_of_basic", label: "% of basic", type: "number", placeholder: "10" },
          { key: "fixed_amount", label: "Fixed amount", type: "number", placeholder: "1600" },
        ]}
        onSubmit={bulkAddComponents}
      />

      {/* Component editor dialog */}
      <Dialog open={componentEditorOpen} onOpenChange={setComponentEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{componentDraft.id ? "Edit component" : "Add component"}</DialogTitle>
            <DialogDescription>
              A single head of pay. It becomes reusable across every structure.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Name</Label>
                <Input
                  value={componentDraft.name}
                  onChange={(e) => setComponentDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Transport Allowance"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Code</Label>
                <Input
                  value={componentDraft.code}
                  onChange={(e) => setComponentDraft((d) => ({ ...d, code: e.target.value }))}
                  placeholder="TA"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Type</Label>
                <Select
                  value={componentDraft.type}
                  onValueChange={(v) => setComponentDraft((d) => ({ ...d, type: v as ComponentType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EARNING">Earning</SelectItem>
                    <SelectItem value="DEDUCTION">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Calculated as</Label>
                <Select
                  value={componentDraft.calculation_type}
                  onValueChange={(v) =>
                    setComponentDraft((d) => ({ ...d, calculation_type: v as CalculationType }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE_OF_BASIC">Percentage of basic</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {componentDraft.calculation_type === "PERCENTAGE_OF_BASIC" ? "Percent" : "Amount"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={componentDraft.value_number}
                  onChange={(e) => setComponentDraft((d) => ({ ...d, value_number: e.target.value }))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Maps to payroll field</Label>
                <Select
                  value={componentDraft.payroll_field || "none"}
                  onValueChange={(v) =>
                    setComponentDraft((d) => ({ ...d, payroll_field: v === "none" ? "" : (v as PayrollField) }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not on payslip</SelectItem>
                    {PAYROLL_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>{PAYROLL_FIELD_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The payroll field decides which column on the payslip this feeds. Several components
              can share one — conveyance and medical both land in special allowance.
            </p>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Statutory</p>
                <p className="text-xs text-muted-foreground">Governed by law — PF, ESI, PT, TDS.</p>
              </div>
              <Switch
                checked={componentDraft.is_statutory}
                onCheckedChange={(v) => setComponentDraft((d) => ({ ...d, is_statutory: v }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setComponentEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveComponent} disabled={savingComponent} className="gap-1.5">
              {savingComponent && <Loader2 className="size-4 animate-spin" />}
              {componentDraft.id ? "Save" : "Add"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Structure editor dialog */}
      <Dialog open={structureEditorOpen} onOpenChange={setStructureEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{structureId ? "Edit structure" : "New structure"}</DialogTitle>
            <DialogDescription>
              Choose which components make up this slab. The preview uses a sample basic of{" "}
              {money(PREVIEW_BASIC)} to show the shape.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Name</Label>
                <Input
                  value={structureName}
                  onChange={(e) => setStructureName(e.target.value)}
                  placeholder="Grade A — Senior Staff"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Code</Label>
                <Input
                  value={structureCode}
                  onChange={(e) => setStructureCode(e.target.value)}
                  placeholder="GRADE-A"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Minimum basic (% of gross)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minBasicPercent}
                  onChange={(e) => setMinBasicPercent(e.target.value)}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Warns if basic falls below this. 0 to disable.
                </p>
              </div>
              <div className="flex items-end">
                <div className="flex w-full items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Default structure</p>
                    <p className="text-xs text-muted-foreground">Prefilled for new hires.</p>
                  </div>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                </div>
              </div>
            </div>

            {/* Component picker */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Components</Label>
              <div className="space-y-3 rounded-lg border border-border p-2">
                {(["EARNING", "DEDUCTION"] as const).map((group) => {
                  const inGroup = components.filter((c) => c.type === group);
                  if (inGroup.length === 0) return null;
                  return (
                    <div key={group} className="space-y-1.5">
                      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group === "EARNING" ? "Earnings & allowances" : "Deductions"}
                      </p>
                      {inGroup.map((c) => {
                        const member = members.find((m) => m.component_id === c.id);
                        const included = Boolean(member);
                        // Basic is the figure the whole structure is scaled
                        // from, so a rate on it is meaningless — showing an
                        // editable "20%" invites someone to set basic to a
                        // fifth of itself.
                        const isBasic = c.payroll_field === "basic_salary";
                        return (
                          <div
                            key={c.id}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                              included ? "bg-muted/60" : ""
                            }`}
                          >
                            <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />
                            <Switch
                              checked={included}
                              onCheckedChange={() => toggleMember(c.id)}
                              disabled={isBasic && included}
                            />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {c.name}
                              {c.is_statutory && (
                                <span className="ml-1.5 text-[10px] text-muted-foreground">
                                  statutory
                                </span>
                              )}
                            </span>
                            {included && (
                              <div className="flex shrink-0 items-center gap-1">
                                {isBasic ? (
                                  <span className="text-[11px] text-muted-foreground">
                                    the base figure
                                  </span>
                                ) : (
                                  <>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={member?.value_override ?? c.value_number}
                                      onChange={(e) => setMemberOverride(c.id, e.target.value)}
                                      className="h-7 w-20 font-mono text-xs"
                                    />
                                    <span className="w-8 text-[11px] text-muted-foreground">
                                      {c.calculation_type === "PERCENTAGE_OF_BASIC" ? "% of basic" : "flat"}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {editorProblems.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                {editorProblems.map((p) => (
                  <p key={p} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {p}
                  </p>
                ))}
              </div>
            )}

            {/* Live preview */}
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Preview at {money(PREVIEW_BASIC)} basic
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Gross</p>
                  <p className="font-mono text-base font-semibold">{money(preview.grossMonthly)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Deductions</p>
                  <p className="font-mono text-base font-semibold">{money(preview.totalDeductions)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Net</p>
                  <p className="font-mono text-base font-bold text-foreground">{money(preview.netMonthly)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setStructureEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveStructure} disabled={savingStructure} className="gap-1.5">
              {savingStructure && <Loader2 className="size-4 animate-spin" />}
              {structureId ? "Save structure" : "Create structure"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
