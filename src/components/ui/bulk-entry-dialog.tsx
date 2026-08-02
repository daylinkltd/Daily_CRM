"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ClipboardPaste, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconAction } from "@/components/ui/icon-action";
import {
  draftKey,
  meaningfulRows,
  parseDraft,
  parsePastedGrid,
  serializeDraft,
} from "@/lib/tables/draft-storage";

export interface BulkColumn {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number";
  required?: boolean;
  width?: string;
}

export type BulkRow = Record<string, string>;

/**
 * Add many records at once, without losing work.
 *
 * Every keystroke is written to a draft in local storage, keyed by form
 * and workspace. Closing the tab, hitting back, or a crash all leave the
 * rows recoverable — they are cleared only on a successful save or a
 * cancel the user confirms. That is the whole point: typing fifteen rows
 * and losing them to a stray back button is the failure this prevents.
 */
export function BulkEntryDialog({
  open,
  onOpenChange,
  title,
  description,
  columns,
  onSubmit,
  scope,
  workspaceId,
  version = 1,
  noun = "row",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  columns: BulkColumn[];
  /** Receives only non-blank rows. Throw to keep the dialog open. */
  onSubmit: (rows: BulkRow[]) => Promise<void>;
  /** Stable id for the draft, e.g. "departments". */
  scope: string;
  workspaceId: string | null | undefined;
  /** Bump when the column set changes so old drafts are discarded. */
  version?: number;
  noun?: string;
}) {
  const emptyRow = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, ""])) as BulkRow,
    [columns]
  );

  const [rows, setRows] = useState<BulkRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [restored, setRestored] = useState(false);

  const key = draftKey(scope, workspaceId);

  // Restore on open.
  useEffect(() => {
    if (!open) return;
    const saved = parseDraft<BulkRow>(
      typeof window === "undefined" ? null : window.localStorage.getItem(key),
      version,
      Date.now()
    );
    if (saved) {
      setRows([...saved, { ...emptyRow }]);
      setRestored(true);
    } else {
      setRows([{ ...emptyRow }, { ...emptyRow }, { ...emptyRow }]);
      setRestored(false);
    }
    setConfirmingCancel(false);
  }, [open, key, version, emptyRow]);

  // Persist on every change.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const payload = serializeDraft(rows, version, Date.now());
    if (payload) window.localStorage.setItem(key, payload);
    else window.localStorage.removeItem(key);
  }, [rows, open, key, version]);

  const clearDraft = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  }, [key]);

  const filled = meaningfulRows(rows);

  const setCell = (rowIndex: number, colKey: string, value: string) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === rowIndex ? { ...r, [colKey]: value } : r));
      // Keep one spare row at the bottom so there is always somewhere to type.
      const last = next[next.length - 1];
      if (last && Object.values(last).some((v) => v !== "")) next.push({ ...emptyRow });
      return next;
    });
  };

  /** Paste a block from a spreadsheet, expanding across columns and rows. */
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const text = e.clipboardData.getData("text/plain");
    const grid = parsePastedGrid(text);
    if (grid.length <= 1 && (grid[0]?.length ?? 0) <= 1) return; // single cell: default behaviour
    e.preventDefault();

    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      grid.forEach((line, r) => {
        const target = rowIndex + r;
        while (next.length <= target) next.push({ ...emptyRow });
        line.forEach((cell, c) => {
          const col = columns[colIndex + c];
          if (col) next[target][col.key] = cell.trim();
        });
      });
      if (Object.values(next[next.length - 1]).some((v) => v !== "")) next.push({ ...emptyRow });
      return next;
    });
    toast.success(`Pasted ${grid.length} ${noun}${grid.length === 1 ? "" : "s"}.`);
  };

  const handleSave = async () => {
    if (filled.length === 0) {
      toast.error(`Add at least one ${noun}.`);
      return;
    }
    const missing = columns.filter(
      (c) => c.required && filled.some((r) => !r[c.key]?.trim())
    );
    if (missing.length > 0) {
      toast.error(`${missing.map((m) => m.label).join(", ")} is required on every row.`);
      return;
    }

    setSaving(true);
    try {
      await onSubmit(filled);
      clearDraft();
      onOpenChange(false);
    } catch (err) {
      // Draft deliberately survives a failed save.
      toast.error(err instanceof Error ? err.message : `Failed to add ${noun}s`);
    } finally {
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (filled.length > 0) setConfirmingCancel(true);
    else {
      clearDraft();
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing via the backdrop or Escape must not silently bin the work.
        if (!next) requestClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || `Add several ${noun}s at once. Paste a column straight from a spreadsheet.`}
          </DialogDescription>
        </DialogHeader>

        {restored && filled.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <p className="text-xs text-foreground">
              Restored {filled.length} unsaved {noun}
              {filled.length === 1 ? "" : "s"} from your last session.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                setRows([{ ...emptyRow }, { ...emptyRow }, { ...emptyRow }]);
                clearDraft();
                setRestored(false);
              }}
            >
              <RotateCcw className="size-3.5" /> Start fresh
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-8 px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground">
                  #
                </th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground"
                    style={{ width: c.width }}
                  >
                    {c.label}
                    {c.required && <span className="ml-0.5 text-destructive">*</span>}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-border">
                  <td className="px-2 py-1 text-[11px] text-muted-foreground">{rowIndex + 1}</td>
                  {columns.map((c, colIndex) => (
                    <td key={c.key} className="px-1 py-1">
                      <Input
                        type={c.type === "number" ? "number" : "text"}
                        value={row[c.key] ?? ""}
                        placeholder={c.placeholder}
                        onChange={(e) => setCell(rowIndex, c.key, e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                        className="h-8 text-xs"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    {rows.length > 1 && (
                      <IconAction
                        label={`Remove row ${rowIndex + 1}`}
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() => setRows((p) => p.filter((_, i) => i !== rowIndex))}
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRows((p) => [...p, { ...emptyRow }])}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="size-3.5" /> Add row
            </Button>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ClipboardPaste className="size-3" /> Paste from a spreadsheet to fill many at once
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {filled.length} ready · saved as you type
          </Badge>
        </div>

        {confirmingCancel ? (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-foreground">
              Discard {filled.length} unsaved {noun}
              {filled.length === 1 ? "" : "s"}?
            </p>
            <p className="text-xs text-muted-foreground">
              They are kept if you close without discarding — this deletes them for good.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setConfirmingCancel(false)}>
                Keep editing
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearDraft();
                  setConfirmingCancel(false);
                  onOpenChange(false);
                }}
                className="text-destructive"
              >
                Discard them
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setConfirmingCancel(false);
                  onOpenChange(false);
                }}
              >
                Close and keep
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || filled.length === 0} className="gap-1.5">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Add {filled.length > 0 ? filled.length : ""} {noun}
              {filled.length === 1 ? "" : "s"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
