"use client";

// ============================================================
// Settings → Workspace → Copy from another workspace
//
// A second workspace used to start empty: the handbook, the letter
// templates, the policies, the departments all had to be rebuilt by
// hand even though a finished set already existed next door.
//
// Pick a source, see exactly what would come across — and what is
// already here — then copy. Nothing is overwritten: anything the target
// already has is left alone, so this can be re-run later to pick up
// whatever was added to the source since.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { SettingsPanelHead } from "./settings-panel-head";

interface SourceWorkspace { id: string; name: string }
interface EntitySummary {
  key: string;
  label: string;
  description: string;
  available: number;
  alreadyPresent: number;
  willCopy: number;
}

export function CopyFromWorkspacePanel() {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();

  const [sources, setSources] = useState<SourceWorkspace[]>([]);
  const [sourceId, setSourceId] = useState<string>("");
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [copying, setCopying] = useState(false);

  const load = useCallback(
    async (withSource?: string) => {
      if (!activeWorkspace?.id) return;
      const qs = new URLSearchParams({ workspace_id: activeWorkspace.id });
      if (withSource) qs.set("source_id", withSource);
      try {
        const res = await fetch(`/api/workspace/copy?${qs}`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) {
          // A member without manage rights simply has no panel; that is
          // not an error worth shouting about.
          if (res.status !== 403) toast.error(payload.error || "Could not load workspaces");
          setSources([]);
          return;
        }
        setSources(payload.sources ?? []);
        setEntities(payload.entities ?? []);
        // Preselect only what would actually do something.
        setSelected(
          Object.fromEntries(
            (payload.entities ?? [])
              .filter((e: EntitySummary) => e.willCopy > 0)
              .map((e: EntitySummary) => [e.key, true]),
          ),
        );
      } catch {
        toast.error("Could not reach the server");
      } finally {
        setLoading(false);
        setScanning(false);
      }
    },
    [activeWorkspace?.id],
  );

  useEffect(() => { void load(); }, [load]);

  const chooseSource = async (id: string) => {
    setSourceId(id);
    setScanning(true);
    setEntities([]);
    await load(id);
  };

  const totalToCopy = entities
    .filter((e) => selected[e.key])
    .reduce((n, e) => n + e.willCopy, 0);

  async function handleCopy() {
    const keys = entities.filter((e) => selected[e.key] && e.willCopy > 0).map((e) => e.key);
    if (!keys.length) return;
    setCopying(true);
    try {
      const res = await fetch("/api/workspace/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace!.id,
          source_id: sourceId,
          keys,
        }),
      });
      const payload = await res.json();
      if (!res.ok) { toast.error(payload.error || "Copy failed"); return; }

      const failed = (payload.results ?? []).filter((r: { error?: string }) => r.error);
      if (failed.length) {
        toast.warning(
          `Copied ${payload.totalCopied}, but ${failed.length} item${failed.length === 1 ? "" : "s"} failed — ${failed[0].error}`,
        );
      } else {
        toast.success(`Copied ${payload.totalCopied} item${payload.totalCopied === 1 ? "" : "s"} across.`);
      }
      await load(sourceId);
      await refreshWorkspaces();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setCopying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  // Nothing to copy from — one workspace, or no manage rights elsewhere.
  if (sources.length === 0) return null;

  return (
    <section className="space-y-4">
      <SettingsPanelHead
        title="Copy from another workspace"
        description="Bring templates, policies, the handbook and other setup across instead of building it again. Nothing already here is overwritten."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={sourceId} onValueChange={(v) => v && chooseSource(v as string)}>
          <SelectTrigger className="w-64 bg-muted">
            <SelectValue placeholder="Copy from…" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sourceId && (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowRight className="size-3.5" />
            {activeWorkspace?.name}
          </span>
        )}
      </div>

      {scanning && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking what can come across…
        </div>
      )}

      {!scanning && sourceId && entities.length > 0 && (
        <>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {entities.map((e) => {
                  const nothingToDo = e.willCopy === 0;
                  return (
                    <li key={e.key} className="flex items-start gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        id={`copy-${e.key}`}
                        checked={Boolean(selected[e.key]) && !nothingToDo}
                        disabled={nothingToDo}
                        onChange={(ev) =>
                          setSelected((p) => ({ ...p, [e.key]: ev.target.checked }))
                        }
                        className="mt-1 size-4 accent-primary disabled:opacity-40"
                      />
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor={`copy-${e.key}`}
                          className="block text-sm font-semibold text-foreground"
                        >
                          {e.label}
                        </label>
                        <p className="text-xs text-muted-foreground">{e.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {e.willCopy > 0 ? (
                          <Badge className="border-primary/20 bg-primary/10 text-primary text-[10px]">
                            {e.willCopy} to copy
                          </Badge>
                        ) : e.available > 0 ? (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Check className="size-3" /> already here
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">none there</Badge>
                        )}
                        {e.alreadyPresent > 0 && e.willCopy > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            {e.alreadyPresent} skipped
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">
              {totalToCopy} item{totalToCopy === 1 ? "" : "s"} selected
            </span>
            <Button onClick={handleCopy} disabled={copying || totalToCopy === 0} className="gap-1.5">
              {copying ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
              Copy into {activeWorkspace?.name}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
