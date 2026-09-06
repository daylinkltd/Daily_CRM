"use client";

// The create half of the CreatableSelect pattern for printing presets:
// one input, because a preset IS one label. Opened from any attribute
// dropdown on the job form (kind pre-chosen) and from Printing →
// Settings.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  PRESET_KIND_NOUN,
  type PresetKind,
  type PrintingPreset,
} from "@/lib/printing/presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function QuickCreatePreset({
  open,
  onOpenChange,
  workspaceId,
  kind,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null | undefined;
  kind: PresetKind;
  onCreated: (preset: PrintingPreset) => void;
}) {
  const supabase = createClient();
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // A stale value from the previous kind would be a trap.
  useEffect(() => {
    if (open) setLabel("");
  }, [open, kind]);

  async function handleCreate() {
    if (!workspaceId || !label.trim()) {
      toast.error("Enter a value");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("printing_presets")
        .insert({
          workspace_id: workspaceId,
          kind,
          label: label.trim(),
          // New entries land after the seeds; reorder in settings later.
          sort_order: 1000,
        })
        .select("id, kind, label, sort_order, active")
        .single();
      if (error) {
        if (error.code === "23505") {
          toast.error(`"${label.trim()}" already exists in this list`);
          return;
        }
        throw error;
      }
      toast.success(`${data.label} added`);
      onOpenChange(false);
      onCreated(data as PrintingPreset);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add the preset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" /> Add {PRESET_KIND_NOUN[kind]}
          </DialogTitle>
        </DialogHeader>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={`New ${PRESET_KIND_NOUN[kind]}…`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
