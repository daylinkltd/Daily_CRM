"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Loader2, BookOpen } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface PolicyItem {
  id: string;
  title: string;
  category: string;
  status: string;
  mandatory: boolean;
}

interface AddPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  existingPolicyIds: string[];
  onAdded: () => void;
}

export function AddPolicyDialog({
  open,
  onOpenChange,
  workspaceId,
  existingPolicyIds,
  onAdded,
}: AddPolicyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open || !workspaceId) return;
    setLoading(true);
    setSelectedIds([]);
    setSearch("");

    fetch(`/api/hr/policies?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.policies) {
          // Filter out policies that are already in the handbook
          const available = data.policies.filter(
            (p: PolicyItem) => !existingPolicyIds.includes(p.id)
          );
          setPolicies(available);
        }
      })
      .catch((err) => {
        toast.error("Failed to load available policies");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [open, workspaceId, existingPolicyIds]);

  const filtered = policies.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    setAdding(true);
    try {
      const res = await fetch("/api/hr/handbook/add-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          policyIds: selectedIds,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add policies");

      toast.success(
        `Added ${selectedIds.length} policy section${selectedIds.length === 1 ? "" : "s"} to Handbook`
      );
      onAdded();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add policies to handbook");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Plus className="size-5 text-primary" /> Add Policies from Policies & Compliance
          </DialogTitle>
          <DialogDescription>
            Select existing policies from your workspace library to include as sections in the Employee Handbook.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search policies by title or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border border-border rounded-md flex-1 overflow-y-auto min-h-[220px] max-h-[360px] p-2 space-y-1">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                <BookOpen className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No available policies found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {policies.length === 0
                    ? "All workspace policies are already included in the handbook."
                    : "No policies match your search term."}
                </p>
              </div>
            ) : (
              filtered.map((policy) => {
                const checked = selectedIds.includes(policy.id);
                return (
                  <div
                    key={policy.id}
                    onClick={() => toggleSelect(policy.id)}
                    className={`flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer ${
                      checked
                        ? "bg-primary/10 border-primary/40"
                        : "bg-card border-border/60 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSelect(policy.id)}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{policy.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {policy.category.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {policy.mandatory && (
                        <Badge variant="outline" className="text-[10px] uppercase border-amber-500/30 text-amber-500 bg-amber-500/10">
                          Mandatory
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {policy.status}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {selectedIds.length} policy{selectedIds.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={selectedIds.length === 0 || adding}
            >
              {adding ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
              Add to Handbook
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
