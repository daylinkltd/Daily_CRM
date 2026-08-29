"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Trash2, GripVertical, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { IconAction } from "@/components/ui/icon-action";

export interface CandidateApplication {
  id: string;
  stage: string;
  candidate_id?: string | null;
  job_id?: string | null;
  candidate?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  job?: { title?: string | null } | null;
}

/**
 * Candidate pipeline as a drag-and-drop board.
 *
 * Replaces an "Advance" button that could only step one stage forward.
 * Hiring is not one-directional — an offer falls through and the candidate
 * goes back to Interview, or someone is moved straight to Rejected — so a
 * card can be dragged to any column, in either direction.
 */
export function CandidateBoard({
  stages,
  applications,
  canManage,
  onMove,
  onDelete,
  onEdit,
  onAddCandidate,
}: {
  stages: string[];
  applications: CandidateApplication[];
  canManage: boolean;
  onMove: (applicationId: string, stage: string) => void;
  onDelete: (application: CandidateApplication) => void;
  onEdit: (application: CandidateApplication) => void;
  /** Offered on the first column only — see StageColumn. */
  onAddCandidate?: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // A small distance threshold so a click on the delete button inside a
  // card is not swallowed as the start of a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const byStage = useMemo(() => {
    const map = new Map<string, CandidateApplication[]>();
    for (const stage of stages) map.set(stage, []);
    for (const app of applications) {
      // An application whose stage is not in the known list would vanish
      // silently; park it in the first column instead of dropping it.
      const key = map.has(app.stage) ? app.stage : stages[0];
      map.get(key)?.push(app);
    }
    return map;
  }, [applications, stages]);

  const activeApp = activeId
    ? applications.find((a) => a.id === activeId) ?? null
    : null;

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const applicationId = String(active.id);
    const target = String(over.id);
    const current = applications.find((a) => a.id === applicationId);
    if (!current || current.stage === target) return;

    onMove(applicationId, target);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-4 overflow-x-auto md:grid-cols-3 lg:grid-cols-6">
        {stages.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            applications={byStage.get(stage) ?? []}
            canManage={canManage}
            onDelete={onDelete}
            onEdit={onEdit}
            onAddCandidate={onAddCandidate}
          />
        ))}
      </div>

      {/* Follows the cursor so the card doesn't appear to vanish mid-drag. */}
      <DragOverlay>
        {activeApp ? (
          <div className="w-56 rotate-2 rounded-lg border border-primary/40 bg-card p-3 text-xs shadow-lg">
            <div className="font-semibold text-foreground">
              {activeApp.candidate?.full_name || "Candidate"}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {activeApp.job?.title || "Job opening"}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stage,
  applications,
  canManage,
  onDelete,
  onEdit,
  onAddCandidate,
}: {
  stage: string;
  applications: CandidateApplication[];
  canManage: boolean;
  onDelete: (application: CandidateApplication) => void;
  onEdit: (application: CandidateApplication) => void;
  onAddCandidate?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[200px] flex-col gap-3 rounded-lg border p-3 transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-foreground">
        <span>{stage}</span>
        <div className="flex items-center gap-1.5">
          {stage === 'APPLIED' && canManage && onAddCandidate && (
            <button
              type="button"
              onClick={onAddCandidate}
              className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-1.5 py-0.5 rounded font-bold transition-colors"
              title="Add Candidate to this pipeline"
            >
              + Add
            </button>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {applications.length}
          </Badge>
        </div>
      </div>

      <div className="min-h-[300px] space-y-2">
        {applications.map((app) => (
          <CandidateCard
            key={app.id}
            application={app}
            canManage={canManage}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
        {applications.length === 0 && (
          <div className="px-1 py-8 text-center text-[11px] text-muted-foreground flex flex-col items-center justify-center gap-2">
            <span>Drop a candidate here</span>
            {stage === 'APPLIED' && canManage && onAddCandidate && (
              <button
                type="button"
                onClick={onAddCandidate}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Add Candidate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateCard({
  application,
  canManage,
  onDelete,
  onEdit,
}: {
  application: CandidateApplication;
  canManage: boolean;
  onDelete: (application: CandidateApplication) => void;
  onEdit: (application: CandidateApplication) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: application.id,
    disabled: !canManage,
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 rounded-lg border border-border bg-card p-3 text-xs shadow-xs ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-1.5">
        {canManage && (
          // The handle carries the drag listeners, not the whole card, so
          // text stays selectable and the delete button stays clickable.
          <button
            type="button"
            aria-label={`Move ${application.candidate?.full_name || "candidate"}`}
            className="mt-0.5 cursor-grab text-muted-foreground active:cursor-grabbing"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-foreground">
            {application.candidate?.full_name || "Candidate"}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {application.candidate?.email || "No email"}
          </div>
        </div>
        {canManage && (
          <>
            <IconAction
              label="Edit application"
              icon={<Pencil className="size-3.5" />}
              onClick={() => onEdit(application)}
            />
            <IconAction
              label="Remove application"
              icon={<Trash2 className="size-3.5" />}
              destructive
              onClick={() => onDelete(application)}
            />
          </>
        )}
      </div>

      <Badge variant="outline" className="bg-secondary/40 text-[9px]">
        {application.job?.title || "Job opening"}
      </Badge>
    </div>
  );
}
