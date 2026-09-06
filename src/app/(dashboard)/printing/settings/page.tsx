"use client";

/**
 * Printing → Settings — the shop's preset vocabulary.
 *
 * Everything the job form offers in its dropdowns is managed here:
 * sizes, paper types, GSM weights, print types, colour modes,
 * finishing options and units. Deleting a preset only removes it from
 * future dropdowns — jobs store the text itself, so history is never
 * rewritten by editing the vocabulary.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Settings2, X, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  groupPresets,
  PRESET_KINDS,
  PRESET_KIND_LABELS,
  PRESET_KIND_NOUN,
  type PresetKind,
  type PrintingPreset,
} from "@/lib/printing/presets";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { IconAction } from "@/components/ui/icon-action";
import { QuickCreatePreset } from "@/components/printing/quick-create-preset";

export default function PrintingSettingsPage() {
  const supabase = createClient();
  const { accountId, accountRole } = useAuth();
  const { activeWorkspace, can } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  // Managing the vocabulary is an update-shaped power on the module.
  const canManage =
    accountRole === "owner" || accountRole === "admin" || can("printing_orders:update");

  const [presets, setPresets] = useState<PrintingPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [addKind, setAddKind] = useState<PresetKind | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("printing_presets")
        .select("id, kind, label, sort_order, active")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .order("sort_order")
        .order("label");
      if (error) throw error;
      setPresets((data as PrintingPreset[]) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load presets");
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => groupPresets(presets), [presets]);

  async function remove(preset: PrintingPreset) {
    if (!workspaceId) return;
    setRemoving(preset.id);
    try {
      const { error } = await supabase
        .from("printing_presets")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("id", preset.id);
      if (error) throw error;
      setPresets((prev) => prev.filter((p) => p.id !== preset.id));
      toast.success(`${preset.label} removed — existing jobs keep it`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="p-(--page-padding-desktop)">
      <div className="flex items-start gap-3">
        <Link
          href="/printing"
          className="mt-1 rounded-lg border border-border p-2 text-muted-foreground hover:border-primary hover:text-primary"
          aria-label="Back to job orders"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeader
          title="Printing Presets"
          description="The options your job form offers — sizes, papers, GSM, print types, colours, finishing and units. Removing one never touches existing jobs."
        />
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {PRESET_KINDS.map((kind) => (
            <Card key={kind}>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Settings2 className="size-4 text-primary" />
                    {PRESET_KIND_LABELS[kind]}
                    <span className="text-xs font-normal text-muted-foreground">
                      {grouped[kind].length}
                    </span>
                  </h3>
                  {canManage && (
                    <IconAction
                      label={`Add ${PRESET_KIND_NOUN[kind]}`}
                      icon={<Plus />}
                      variant="outline"
                      onClick={() => setAddKind(kind)}
                    />
                  )}
                </div>
                {grouped[kind].length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing here yet — add the first {PRESET_KIND_NOUN[kind]}.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {grouped[kind].map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground"
                      >
                        {p.label}
                        {canManage && (
                          <button
                            type="button"
                            aria-label={`Remove ${p.label}`}
                            disabled={removing === p.id}
                            onClick={() => remove(p)}
                            className="rounded-sm text-muted-foreground transition-colors hover:text-red-400"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {addKind && (
        <QuickCreatePreset
          open={!!addKind}
          onOpenChange={(open) => !open && setAddKind(null)}
          workspaceId={workspaceId}
          kind={addKind}
          onCreated={(p) => {
            setPresets((prev) => [...prev, p]);
            setAddKind(null);
          }}
        />
      )}
    </div>
  );
}
