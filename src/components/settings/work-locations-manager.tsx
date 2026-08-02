"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, MapPin, Pencil, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { GeofenceMapPicker } from "@/components/attendance/geofence-map-picker";
import { formatDistance } from "@/lib/attendance/geolocation";

const LOCATION_TYPES = ["OFFICE", "CLIENT_SITE", "WAREHOUSE", "BRANCH", "OTHER"] as const;
type LocationType = (typeof LOCATION_TYPES)[number];

const TYPE_LABELS: Record<LocationType, string> = {
  OFFICE: "Office",
  CLIENT_SITE: "Client site",
  WAREHOUSE: "Warehouse",
  BRANCH: "Branch",
  OTHER: "Other",
};

interface WorkLocationRow {
  id: string;
  name: string;
  type: LocationType;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
  is_default: boolean;
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

const BLANK = {
  id: null as string | null,
  name: "",
  type: "OFFICE" as LocationType,
  address: "",
  latitude: null as number | null,
  longitude: null as number | null,
  radius_m: 100,
  is_default: false,
};

/**
 * The shared registry of places the workspace works from.
 *
 * Attendance policies and per-employee rules point at one of these
 * instead of each carrying its own coordinates, so moving an office is
 * a single edit rather than a hunt through every policy that copied the
 * old position.
 */
export function WorkLocationsManager({ canEdit }: { canEdit: boolean }) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<WorkLocationRow[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(BLANK);

  const fetchLocations = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("work_locations")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      setLocations((data as WorkLocationRow[] | null) || []);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load work locations"));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const openNew = () => {
    setDraft(BLANK);
    setEditorOpen(true);
  };

  const openEdit = (l: WorkLocationRow) => {
    setDraft({
      id: l.id,
      name: l.name,
      type: l.type,
      address: l.address || "",
      latitude: l.latitude,
      longitude: l.longitude,
      radius_m: l.radius_m,
      is_default: l.is_default,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    if (!draft.name.trim()) {
      toast.error("Give the location a name.");
      return;
    }

    setSaving(true);
    try {
      // Only one default per workspace is enforced by a partial unique
      // index, so clear the previous one first rather than letting the
      // insert fail.
      if (draft.is_default) {
        await supabase
          .from("work_locations")
          .update({ is_default: false })
          .eq("workspace_id", activeWorkspace.id)
          .eq("is_default", true)
          .neq("id", draft.id ?? "00000000-0000-0000-0000-000000000000");
      }

      const payload = {
        workspace_id: activeWorkspace.id,
        name: draft.name.trim(),
        type: draft.type,
        address: draft.address.trim() || null,
        latitude: draft.latitude,
        longitude: draft.longitude,
        radius_m: draft.radius_m,
        is_default: draft.is_default,
      };

      const { error } = draft.id
        ? await supabase.from("work_locations").update(payload).eq("id", draft.id)
        : await supabase.from("work_locations").insert(payload);
      if (error) throw error;

      toast.success(draft.id ? "Location updated." : "Location added.");
      setEditorOpen(false);
      await fetchLocations();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save the location"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (l: WorkLocationRow) => {
    if (!confirm(`Remove "${l.name}"? Policies using it will fall back to no boundary.`)) return;
    try {
      // Soft delete: attendance rows already recorded against this place
      // keep a resolvable reference.
      const { error } = await supabase
        .from("work_locations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", l.id);
      if (error) throw error;
      toast.success("Location removed.");
      await fetchLocations();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove the location"));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-primary" /> Work locations
          </CardTitle>
          <CardDescription>
            Your offices, branches and client sites. Attendance rules point at these, so moving an
            office is one edit rather than a change to every policy.
          </CardDescription>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="shrink-0 gap-1.5">
            <Plus className="size-4" /> Add location
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : locations.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No locations yet. Add your office to start enforcing a geofence.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {locations.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{l.name}</p>
                    {l.is_default && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Star className="size-2.5" /> Default
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[l.type]}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.latitude != null
                      ? `${l.latitude.toFixed(5)}, ${l.longitude!.toFixed(5)} · ${formatDistance(l.radius_m)} radius`
                      : "No coordinates — cannot be geofenced"}
                    {l.address ? ` · ${l.address}` : ""}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(l)} className="px-2">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(l)}
                      className="px-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit location" : "Add a work location"}</DialogTitle>
            <DialogDescription>
              Place the pin where people actually stand — the building entrance rather than the
              postal centroid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Head Office"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Type</Label>
                <Select
                  value={draft.type}
                  onValueChange={(v) => setDraft((d) => ({ ...d, type: v as LocationType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Address</Label>
              <Input
                value={draft.address}
                onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                placeholder="Optional — for reference only"
              />
            </div>

            <GeofenceMapPicker
              label={draft.name || undefined}
              value={{
                latitude: draft.latitude,
                longitude: draft.longitude,
                radiusM: draft.radius_m,
              }}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  latitude: next.latitude,
                  longitude: next.longitude,
                  radius_m: next.radiusM,
                }))
              }
            />

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Use as the default location</p>
                <p className="text-xs text-muted-foreground">
                  Prefills new attendance policies. Only one location can be the default.
                </p>
              </div>
              <Switch
                checked={draft.is_default}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, is_default: v }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {draft.id ? "Save changes" : "Add location"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
