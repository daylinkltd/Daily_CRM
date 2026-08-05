"use client";

import { Trash2, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { IconAction } from "@/components/ui/icon-action";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CandidateApplication } from "./candidate-board";

const STAGE_STYLES: Record<string, string> = {
  APPLIED: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
  SCREENING: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  INTERVIEW: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
  OFFER: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  HIRED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

/**
 * The same applications as the board, as a table.
 *
 * The board answers "where is everyone in the process"; this answers
 * "show me every candidate at once" — which a six-column board cannot do
 * past a handful of people per stage. Stage is a select here rather than a
 * drag, since there is nothing to drag between in a list.
 */
export function CandidateList({
  stages,
  applications,
  canManage,
  onMove,
  onDelete,
  onEdit,
}: {
  stages: string[];
  applications: CandidateApplication[];
  canManage: boolean;
  onMove: (applicationId: string, stage: string) => void;
  onDelete: (application: CandidateApplication) => void;
  onEdit: (application: CandidateApplication) => void;
}) {
  if (applications.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No candidates yet. Add one to start the pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>Candidate</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Applied for</TableHead>
            <TableHead>Stage</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => (
            <TableRow key={app.id} className="border-border hover:bg-muted/40">
              <TableCell className="font-medium text-foreground">
                {app.candidate?.full_name || "Candidate"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {app.candidate?.email || "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {app.job?.title || "—"}
              </TableCell>
              <TableCell>
                {canManage ? (
                  <select
                    value={app.stage}
                    onChange={(e) => onMove(app.id, e.target.value)}
                    aria-label={`Stage for ${app.candidate?.full_name || "candidate"}`}
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${STAGE_STYLES[app.stage] ?? ""}`}
                  >
                    {app.stage}
                  </Badge>
                )}
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <IconAction
                    label="Edit application"
                    icon={<Pencil className="size-3.5" />}
                    onClick={() => onEdit(app)}
                  />
                  <IconAction
                    label="Remove application"
                    icon={<Trash2 className="size-3.5" />}
                    destructive
                    onClick={() => onDelete(app)}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
