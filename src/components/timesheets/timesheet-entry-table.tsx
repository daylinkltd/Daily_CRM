"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { IconAction } from "@/components/ui/icon-action";
import {
  REFERENCE_SOURCES, parseFields, splitFields, sumHours, meaningfulEntryRows,
  validateEntry, type TimesheetField,
} from "@/lib/hr/timesheet-templates";
import { draftKey, parseDraft, serializeDraft } from "@/lib/tables/draft-storage";

type EntryRow = Record<string, string>;

interface RefOption { id: string; label: string }

/**
 * The punch-out timesheet: one row per ticket, driven by the assigned
 * template.
 *
 * Replaces a fixed single task/hours/notes form that ignored
 * `fields_json` entirely — so a developer and a salesperson were asked
 * the same three questions, and the six seeded templates were dead
 * config.
 *
 * Rows are drafted to local storage as they are typed, on the same
 * reasoning as bulk entry: losing a day's worth of logged tickets to a
 * stray reload is the failure worth engineering against.
 */
export function TimesheetEntryTable({
  open,
  onOpenChange,
  templateId,
  onSaved,
  loggedHours,
  mandatory = false,
  allowDateChange = false,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null falls back to a minimal task/hours/notes shape. */
  templateId: string | null;
  onSaved?: () => void;
  /** Hours actually clocked, shown so the total can be reconciled. */
  loggedHours?: number;
  /**
   * Punch-out is waiting on this timesheet. The dialog stops dismissing
   * itself on a stray click or Escape, and says what is being held up —
   * a required timesheet that closes on a misclick is not required.
   */
  mandatory?: boolean;
  /** Logging a past day, rather than the day being punched out of. */
  allowDateChange?: boolean;
  title?: string;
  description?: string;
}) {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<TimesheetField[]>([]);
  const [templateName, setTemplateName] = useState("Timesheet");
  const [refOptions, setRefOptions] = useState<Record<string, RefOption[]>>({});
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [dayValues, setDayValues] = useState<Record<string, string>>({});
  const today = new Date().toISOString().split("T")[0];
  const [logDate, setLogDate] = useState(today);
  // Billable is a real `time_logs` column, so it is a column here rather
  // than a template field — every row can differ.
  const [billable, setBillable] = useState<Record<number, boolean>>({});

  const { rowFields, dayFields } = useMemo(() => splitFields(fields), [fields]);
  const emptyRow = useMemo(
    () => Object.fromEntries(rowFields.map((f) => [f.key, ""])) as EntryRow,
    [rowFields]
  );
  const draftScope = `timesheet:${templateId ?? "default"}`;
  const storageKey = draftKey(draftScope, activeWorkspace?.id);

  const load = useCallback(async () => {
    if (!open || !activeWorkspace?.id) return;
    setLoading(true);
    try {
      let parsed: TimesheetField[] = [];
      if (templateId) {
        const { data } = await supabase
          .from("hr_timesheet_templates")
          .select("name, fields_json")
          .eq("id", templateId)
          .maybeSingle();
        if (data) {
          setTemplateName(String(data.name));
          parsed = parseFields(data.fields_json);
        }
      }
      if (parsed.length === 0) {
        // No template assigned: ask the minimum that time_logs needs.
        parsed = [
          { key: "task_id", label: "Task", type: "reference", source: "tasks", required: true, perRow: true },
          { key: "hours", label: "Hours", type: "number", required: true, min: 0, max: 24, perRow: true },
          { key: "work_done", label: "What did you do?", type: "textarea", perRow: true },
        ];
      }
      setFields(parsed);

      // Load the option lists every reference field needs, one query per
      // distinct source rather than one per field.
      const sources = Array.from(
        new Set(parsed.filter((f) => f.source).map((f) => f.source as string))
      );
      const loaded: Record<string, RefOption[]> = {};
      for (const src of sources) {
        const meta = REFERENCE_SOURCES[src as keyof typeof REFERENCE_SOURCES];
        if (!meta) continue;
        const { data } = await supabase
          .from(meta.table)
          .select(`id, ${meta.display}`)
          .eq("workspace_id", activeWorkspace.id)
          .limit(500);
        loaded[src] = ((data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id),
          label: String(r[meta.display] ?? "Untitled"),
        }));
      }
      setRefOptions(loaded);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load the timesheet");
    } finally {
      setLoading(false);
    }
  }, [open, activeWorkspace?.id, templateId, supabase]);

  useEffect(() => { load(); }, [load]);

  // Restore any draft once the field set is known.
  useEffect(() => {
    if (!open || rowFields.length === 0) return;
    const saved = parseDraft<EntryRow>(
      typeof window === "undefined" ? null : window.localStorage.getItem(storageKey),
      1,
      Date.now()
    );
    setRows(saved ? [...saved, { ...emptyRow }] : [{ ...emptyRow }, { ...emptyRow }]);
  }, [open, rowFields.length, storageKey, emptyRow]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const payload = serializeDraft(rows, 1, Date.now());
    if (payload) window.localStorage.setItem(storageKey, payload);
    else window.localStorage.removeItem(storageKey);
  }, [rows, open, storageKey]);

  const setCell = (i: number, key: string, value: string) =>
    setRows((prev) => {
      const next = prev.map((r, n) => (n === i ? { ...r, [key]: value } : r));
      const last = next[next.length - 1];
      if (last && Object.values(last).some((v) => v !== "")) next.push({ ...emptyRow });
      return next;
    });

  const filled = meaningfulEntryRows(rows);
  const total = sumHours(filled);
  const problems = validateEntry(rows, rowFields, dayValues, dayFields);
  // Worth flagging, never blocking: the clock is the record of attendance,
  // the timesheet is the record of what the time went on.
  const mismatch =
    loggedHours != null && filled.length > 0 && Math.abs(total - loggedHours) > 0.5;

  const save = async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    if (problems.length > 0) { toast.error(problems[0]); return; }

    setSaving(true);
    try {
      const hoursKey = rowFields.find((f) => f.type === "number")?.key ?? "hours";
      const taskKey = rowFields.find((f) => f.source === "tasks")?.key;
      const noteKey = rowFields.find((f) => f.type === "textarea")?.key;

      // time_logs.task_id is NOT NULL, so a row without a task cannot be
      // written — say so plainly rather than letting Postgres reject it.
      const missingTask = taskKey ? filled.filter((r) => !r[taskKey]).length : filled.length;
      if (!taskKey || missingTask > 0) {
        toast.error(
          "Every row needs a task selected — time is logged against a task. Add a task field to the template if it is missing."
        );
        setSaving(false);
        return;
      }

      const payload = filled.map((r) => ({
        workspace_id: activeWorkspace.id,
        workspace_member_id: activeMember.id,
        task_id: r[taskKey],
        log_date: logDate,
        duration: Number(r[hoursKey]) || 0,
        description: [
          noteKey ? r[noteKey] : "",
          // Anything the template asked that time_logs has no column for is
          // preserved in the description rather than silently dropped.
          ...rowFields
            .filter((f) => f.key !== taskKey && f.key !== hoursKey && f.key !== noteKey)
            .map((f) => (r[f.key] ? `${f.label}: ${r[f.key]}` : ""))
            .filter(Boolean),
          ...dayFields
            .map((f) => (dayValues[f.key] ? `${f.label}: ${dayValues[f.key]}` : ""))
            .filter(Boolean),
        ].filter(Boolean).join(" · "),
        // Keyed by position in `rows`, not in `filled` — the latter drops
        // blank rows, which would shift every flag onto the wrong entry.
        billable: billable[rows.indexOf(r)] ?? true,
      }));

      const { error } = await supabase.from("time_logs").insert(payload);
      if (error) throw error;

      if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
      toast.success(`Logged ${filled.length} entr${filled.length === 1 ? "y" : "ies"} · ${total}h.`);
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the timesheet");
    } finally {
      setSaving(false);
    }
  };

  const renderCell = (f: TimesheetField, row: EntryRow, i: number) => {
    const value = row[f.key] ?? "";
    if (f.type === "reference" || f.type === "reference_multi") {
      const opts = refOptions[f.source ?? ""] ?? [];
      return (
        <select
          value={value}
          onChange={(e) => setCell(i, f.key, e.target.value)}
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">Select…</option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      );
    }
    if (f.type === "textarea") {
      return (
        <Textarea
          plain
          rows={1}
          value={value}
          onChange={(e) => setCell(i, f.key, e.target.value)}
          className="min-h-8 text-xs"
        />
      );
    }
    return (
      <Input
        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
        min={f.min}
        max={f.max}
        value={value}
        onChange={(e) => setCell(i, f.key, e.target.value)}
        className="h-8 text-xs"
      />
    );
  };

  return (
    <Dialog
      open={open}
      // A mandatory timesheet ignores backdrop clicks and Escape. It is
      // still cancellable, but only through the button that says so.
      onOpenChange={(next) => { if (next || !mandatory) onOpenChange(next); }}
    >
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title ?? templateName}</DialogTitle>
          <DialogDescription>
            {description ??
              (mandatory
                ? "Your punch-out is waiting on this. Fill in the day, then save to clock out."
                : "One row per task. Rows are kept as you type, so a reload will not lose them.")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <Label htmlFor="ts-log-date" className="text-xs font-semibold">
                Log date
              </Label>
              <Input
                id="ts-log-date"
                type="date"
                value={logDate}
                max={today}
                disabled={!allowDateChange}
                onChange={(e) => setLogDate(e.target.value)}
                className="h-8 w-44 text-xs"
              />
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-8 px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground">#</th>
                    {rowFields.map((f) => (
                      <th key={f.key} className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground">
                        {f.label}
                        {f.required && <span className="ml-0.5 text-destructive">*</span>}
                      </th>
                    ))}
                    <th className="w-20 px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground">
                      Billable
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1 text-[11px] text-muted-foreground">{i + 1}</td>
                      {rowFields.map((f) => (
                        <td key={f.key} className="px-1 py-1">{renderCell(f, row, i)}</td>
                      ))}
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          aria-label={`Row ${i + 1} billable`}
                          checked={billable[i] ?? true}
                          onChange={(e) =>
                            setBillable((p) => ({ ...p, [i]: e.target.checked }))
                          }
                          className="size-3.5 accent-primary"
                        />
                      </td>
                      <td className="px-1 py-1">
                        {rows.length > 1 && (
                          <IconAction
                            label={`Remove row ${i + 1}`}
                            icon={<Trash2 className="size-3.5" />}
                            onClick={() => setRows((p) => p.filter((_, n) => n !== i))}
                            destructive
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRows((p) => [...p, { ...emptyRow }])}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="size-3.5" /> Add row
              </Button>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {filled.length} row{filled.length === 1 ? "" : "s"} · {total}h
                </Badge>
                {loggedHours != null && (
                  <Badge variant="outline" className="text-[10px]">Clocked {loggedHours}h</Badge>
                )}
              </div>
            </div>

            {mismatch && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Your rows total {total}h but you clocked {loggedHours}h. Not a blocker — worth a look.
              </p>
            )}

            {dayFields.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {dayFields.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {f.label}
                      {f.required && <span className="ml-0.5 text-destructive">*</span>}
                    </Label>
                    <Textarea
                      plain
                      rows={2}
                      value={dayValues[f.key] ?? ""}
                      onChange={(e) =>
                        setDayValues((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                      className="text-xs"
                    />
                  </div>
                ))}
              </div>
            )}

            {problems.length > 0 && (
              <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3">
                {problems.map((p) => (
                  <p key={p} className="text-[11px] text-muted-foreground">{p}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {mandatory ? "Cancel punch out" : "Close"}
          </Button>
          <Button
            onClick={save}
            disabled={saving || problems.length > 0 || filled.length === 0}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {mandatory
              ? `Save timesheet & punch out (${total}h)`
              : `Save timesheet (${total}h)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
