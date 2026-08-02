"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, Pencil, ClipboardList, Copy, GripVertical, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IconAction } from "@/components/ui/icon-action";
import {
  FIELD_TYPES, FIELD_TYPE_LABELS, REFERENCE_SOURCES, parseFields, keyFromLabel,
  splitFields, type TimesheetField, type FieldType, type ReferenceSource,
} from "@/lib/hr/timesheet-templates";

interface Row {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  role_preset: string | null;
  fields_json: unknown;
  is_system: boolean;
  is_active: boolean;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

const BLANK_FIELD: TimesheetField = {
  key: "", label: "", type: "text", required: false, perRow: true,
};

/**
 * See and control what a timesheet asks for.
 *
 * Migration 086 seeded six templates with a full `fields_json`, but
 * nothing could read or edit them — so nobody could tell what a given
 * role would actually be asked at punch-out. This makes the question set
 * visible and editable.
 *
 * Library templates (workspace_id IS NULL) are read-only by design and
 * are duplicated into the workspace to be changed, which is the same
 * adopt-a-copy rule the message template library uses.
 */
export function TimesheetTemplatesManager({ canEdit }: { canEdit: boolean }) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<TimesheetField[]>([]);

  const fetchAll = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hr_timesheet_templates")
        .select("id, workspace_id, name, description, role_preset, fields_json, is_system, is_active")
        .or(`workspace_id.is.null,workspace_id.eq.${activeWorkspace.id}`)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      setRows((data as Row[] | null) || []);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load timesheet templates"));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => {
    setEditId(null);
    setName("");
    setDescription("");
    setFields([
      { key: "ticket_ids", label: "Tasks / tickets worked on", type: "reference_multi", source: "tasks", required: true, perRow: true },
      { key: "hours", label: "Hours spent", type: "number", required: true, min: 0, max: 24, perRow: true },
      { key: "work_done", label: "What did you do?", type: "textarea", required: true, perRow: true },
    ]);
    setEditorOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditId(r.id);
    setName(r.name);
    setDescription(r.description || "");
    setFields(parseFields(r.fields_json));
    setEditorOpen(true);
  };

  /** A library template is copied before it can be edited. */
  const duplicate = async (r: Row) => {
    if (!activeWorkspace?.id) return;
    try {
      const { error } = await supabase.from("hr_timesheet_templates").insert({
        workspace_id: activeWorkspace.id,
        name: `${r.name} (copy)`,
        description: r.description,
        role_preset: r.role_preset,
        fields_json: parseFields(r.fields_json),
        is_system: false,
      });
      if (error) throw error;
      toast.success("Copied into your workspace — now editable.");
      await fetchAll();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to copy the template"));
    }
  };

  const save = async () => {
    if (!activeWorkspace?.id) return;
    if (!name.trim()) { toast.error("Give the template a name."); return; }
    const clean = fields
      .map((f) => ({ ...f, key: f.key.trim() || keyFromLabel(f.label), label: f.label.trim() }))
      .filter((f) => f.label !== "");
    if (clean.length === 0) { toast.error("Add at least one question."); return; }
    const dupes = clean.filter((f, i) => clean.findIndex((g) => g.key === f.key) !== i);
    if (dupes.length > 0) {
      toast.error(`Two questions share the key "${dupes[0].key}" — rename one.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        description: description.trim() || null,
        fields_json: clean,
        is_system: false,
      };
      const { error } = editId
        ? await supabase.from("hr_timesheet_templates").update(payload).eq("id", editId)
        : await supabase.from("hr_timesheet_templates").insert(payload);
      if (error) throw error;
      toast.success(editId ? "Template updated." : "Template created.");
      setEditorOpen(false);
      await fetchAll();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save the template"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete "${r.name}"? Policies using it fall back to no timesheet.`)) return;
    try {
      const { error } = await supabase
        .from("hr_timesheet_templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) throw error;
      toast.success("Template deleted.");
      await fetchAll();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete the template"));
    }
  };

  const setField = (i: number, patch: Partial<TimesheetField>) =>
    setFields((prev) => prev.map((f, n) => (n === i ? { ...f, ...patch } : f)));

  const { rowFields, dayFields } = splitFields(fields);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-primary" /> Timesheet templates
          </CardTitle>
          <CardDescription>
            Exactly what each role is asked when they punch out. Assign one to a person on their
            Attendance tab.
          </CardDescription>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="shrink-0 gap-1.5">
            <Plus className="size-4" /> New template
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {rows.map((r) => {
              const parsed = parseFields(r.fields_json);
              const isLibrary = r.workspace_id === null;
              return (
                <div key={r.id} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                        {isLibrary && (
                          <Badge variant="outline" className="text-[10px]">Library</Badge>
                        )}
                      </div>
                      {r.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                      )}
                      {/* The whole point: the questions are visible without
                          opening anything. */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {parsed.map((f) => (
                          <Badge key={f.key} variant="secondary" className="text-[10px]">
                            {f.label}
                            {f.required && <span className="ml-0.5 text-destructive">*</span>}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-1">
                        {isLibrary ? (
                          <IconAction
                            label={`Copy "${r.name}" to edit it`}
                            icon={<Copy className="size-3.5" />}
                            onClick={() => duplicate(r)}
                          />
                        ) : (
                          <>
                            <IconAction
                              label={`Edit ${r.name}`}
                              icon={<Pencil className="size-3.5" />}
                              onClick={() => openEdit(r)}
                            />
                            <IconAction
                              label={`Delete ${r.name}`}
                              icon={<Trash2 className="size-3.5" />}
                              onClick={() => remove(r)}
                              destructive
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit template" : "New timesheet template"}</DialogTitle>
            <DialogDescription>
              Each question becomes a field at punch-out. Per-row questions become columns in the
              entry table, so one row can be filled in per ticket.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Software Developer" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who this is for" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Questions</Label>
              <div className="space-y-2 rounded-lg border border-border p-2">
                {fields.map((f, i) => (
                  <div key={i} className="space-y-2 rounded-md bg-muted/40 p-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />
                      <Input
                        value={f.label}
                        onChange={(e) =>
                          setField(i, {
                            label: e.target.value,
                            // Keep the key in step until it is edited by hand.
                            key: f.key && f.key !== keyFromLabel(f.label) ? f.key : keyFromLabel(e.target.value),
                          })
                        }
                        placeholder="Question shown to the employee"
                        className="h-8 flex-1 text-xs"
                      />
                      <IconAction
                        label="Remove this question"
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() => setFields((p) => p.filter((_, n) => n !== i))}
                        destructive
                      />
                    </div>

                    <div className="grid gap-2 pl-6 sm:grid-cols-4">
                      <Select value={f.type} onValueChange={(v) => setField(i, { type: v as FieldType })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {(f.type === "reference" || f.type === "reference_multi") && (
                        <Select
                          value={f.source ?? "tasks"}
                          onValueChange={(v) => setField(i, { source: v as ReferenceSource })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(REFERENCE_SOURCES).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Switch
                          checked={f.required === true}
                          onCheckedChange={(v) => setField(i, { required: v })}
                        />
                        Required
                      </label>

                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Switch
                          checked={f.perRow === true}
                          onCheckedChange={(v) => setField(i, { perRow: v })}
                        />
                        Per row
                      </label>
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFields((p) => [...p, { ...BLANK_FIELD }])}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" /> Add question
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                At punch-out this shows a table with {rowFields.length} column
                {rowFields.length === 1 ? "" : "s"} — {rowFields.map((f) => f.label || "untitled").join(", ") || "none"}
                {dayFields.length > 0 && (
                  <> — and asks {dayFields.map((f) => f.label || "untitled").join(", ")} once for the day</>
                )}
                .
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editId ? "Save template" : "Create template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
