"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2, Plus, Umbrella, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveRequestForm } from "@/components/leave/leave-request-form";
import { IconAction } from "@/components/ui/icon-action";

interface LeaveRow {
  id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  status: string;
  reason: string | null;
  approved_by?: string | null;
  approver?: {
    id: string;
    user_id: string;
    profiles?: {
      full_name: string;
      avatar_url?: string;
    } | null;
  } | null;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold",
  rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold",
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
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          id, leave_type, from_date, to_date, status, reason, approved_by,
          approver:workspace_members!leave_requests_approved_by_fkey ( id, user_id )
        `)
        .eq("workspace_id", activeWorkspace.id)
        .eq("workspace_member_id", activeMember.id)
        .order("from_date", { ascending: false });

      if (error) throw error;

      let resultRows = (data as any[] | null) || [];

      if (resultRows.length > 0) {
        const approverUserIds = resultRows.map((r) => r.approver?.user_id).filter(Boolean);
        const uniqueUserIds = [...new Set(approverUserIds)];
        const profileMap: Record<string, any> = {};

        if (uniqueUserIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url")
            .in("user_id", uniqueUserIds);

          (profilesData || []).forEach((p: any) => {
            profileMap[p.user_id] = p;
          });
        }

        resultRows.forEach((r) => {
          if (r.approver?.user_id) {
            r.approver.profiles = profileMap[r.approver.user_id] || null;
          }
        });
      }

      setRows(resultRows);
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
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((r) => {
            const approverName = r.approver?.profiles?.full_name;
            const statusKey = (r.status || "pending").toLowerCase();

            return (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {r.leave_type} · {r.from_date} to {r.to_date}
                  </p>
                  {r.reason && <p className="truncate text-xs text-muted-foreground mt-0.5">{r.reason}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${STATUS_STYLES[statusKey] ?? ""}`}>
                    {r.status}
                  </Badge>
                  {statusKey === "approved" && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="size-3" />
                      {approverName ? `Approved by ${approverName}` : "Approved"}
                    </span>
                  )}
                  {statusKey === "rejected" && (
                    <span className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                      <XCircle className="size-3" />
                      {approverName ? `Rejected by ${approverName}` : "Rejected"}
                    </span>
                  )}
                  {statusKey === "pending" && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3 text-amber-500" /> Awaiting Review
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeaveRequestForm open={formOpen} onOpenChange={setFormOpen} onSaved={fetchMine} />
    </div>
  );
}
