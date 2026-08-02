"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2, Plus, Umbrella } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveRequestForm } from "@/components/leave/leave-request-form";
import { IconAction } from "@/components/ui/icon-action";

interface LeaveRow {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

/** The employee's own leave: request it, and see where each request stands. */
export default function MyLeavePage() {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const fetchMine = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);
    try {
      // Scoped to this member only — self-service never reads a colleague's
      // leave, so nothing here needs an HR permission.
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, status, reason")
        .eq("workspace_id", activeWorkspace.id)
        .eq("workspace_member_id", activeMember.id)
        .order("start_date", { ascending: false });
      if (error) throw error;
      setRows((data as LeaveRow[] | null) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load your leave");
    } finally {
      setLoading(false);
    }
  }, [supabase, activeWorkspace?.id, activeMember?.id]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Leave"
        description="Request time off and track where each request stands."
        actions={
          <IconAction label="Request leave" icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)} className="gap-1.5" />
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <Umbrella className="mx-auto size-7 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium text-foreground">No leave requested yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your requests and their approval status will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {r.leave_type} · {r.start_date} to {r.end_date}
                </p>
                {r.reason && <p className="truncate text-xs text-muted-foreground">{r.reason}</p>}
              </div>
              <Badge className={`shrink-0 text-[10px] ${STATUS_STYLES[r.status] ?? ""}`}>
                {r.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <LeaveRequestForm open={formOpen} onOpenChange={setFormOpen} onSaved={fetchMine} />
    </div>
  );
}
