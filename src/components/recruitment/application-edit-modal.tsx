"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";

export interface EditableApplication {
  id: string;
  stage: string;
  candidate_id?: string | null;
  job_id?: string | null;
  candidate?: { full_name?: string | null; email?: string | null; phone?: string | null } | null;
}

/**
 * Edit a candidate's details and where they sit in the pipeline.
 *
 * The name, email and phone belong to `hr_candidates` and the opening and
 * stage to `hr_job_applications`; the UPDATE_APPLICATION action writes
 * both so one save cannot leave the two halves disagreeing.
 */
export function ApplicationEditModal({
  open,
  onOpenChange,
  application,
  jobs,
  stages,
  workspaceId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: EditableApplication | null;
  jobs: { id: string; title: string }[];
  stages: string[];
  workspaceId: string | undefined;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [stage, setStage] = useState("");

  useEffect(() => {
    if (!open || !application) return;
    setFullName(application.candidate?.full_name ?? "");
    setEmail(application.candidate?.email ?? "");
    setPhone(application.candidate?.phone ?? "");
    setJobId(application.job_id ?? null);
    setStage(application.stage);
  }, [open, application]);

  const handleSave = async () => {
    if (!application || !workspaceId) return;
    if (!fullName.trim()) {
      toast.error("Candidate name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/hr/recruitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_APPLICATION",
          workspaceId,
          applicationId: application.id,
          candidateId: application.candidate_id,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          jobId,
          stage,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success("Application updated");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update application");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit application</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div>
            <Label className="text-foreground">Candidate name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5 bg-background"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-foreground">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 bg-background"
              />
            </div>
            <div>
              <Label className="text-foreground">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 bg-background"
              />
            </div>
          </div>

          <div>
            <Label className="text-foreground">Applied for</Label>
            <SearchableSelect
              className="mt-1.5"
              ariaLabel="Job opening"
              options={jobs.map((j) => ({ value: j.id, label: j.title }))}
              value={jobId}
              onChange={setJobId}
              placeholder="Select a job opening…"
              searchPlaceholder="Search openings…"
              emptyMessage="No openings match"
            />
          </div>

          <div>
            <Label className="text-foreground">Stage</Label>
            <SearchableSelect
              className="mt-1.5"
              ariaLabel="Pipeline stage"
              options={stages.map((s) => ({ value: s, label: s }))}
              value={stage}
              onChange={(v) => setStage(v ?? stage)}
              placeholder="Select a stage…"
              searchPlaceholder="Search stages…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
