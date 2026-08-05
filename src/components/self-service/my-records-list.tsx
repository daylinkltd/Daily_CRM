"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Loader2, Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type Row = Record<string, unknown>;

/**
 * A read-only list of the signed-in member's OWN records.
 *
 * Every query is filtered to `workspace_member_id = activeMember.id`, so
 * these pages need no HR permission: an employee reading their own
 * attendance is not the same capability as HR reading everyone's.
 *
 * `memberColumn` exists because the schema is not consistent — most
 * tables key on workspace_member_id, but a few use their own name.
 */
export function MyRecordsList({
  title,
  description,
  table,
  columns,
  orderBy,
  memberColumn = "workspace_member_id",
  equals,
  isNull,
  renderRow,
  emptyMessage,
  actions,
}: {
  title: string;
  description: string;
  table: string;
  columns: string;
  orderBy: string;
  memberColumn?: string;
  /** Extra equality filters, e.g. { linked_entity_type: "Employee" }. */
  equals?: Record<string, string>;
  /** Columns that must be NULL, e.g. ["deleted_at"] for soft deletes. */
  isNull?: string[];
  renderRow: (row: Row) => ReactNode;
  emptyMessage: string;
  actions?: ReactNode;
}) {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  const equalsKey = JSON.stringify(equals ?? {});
  const isNullKey = (isNull ?? []).join(",");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const fetchMine = useCallback(async () => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    setLoading(true);
    setFailed(null);
    try {
      let query = supabase
        .from(table)
        .select(columns)
        .eq("workspace_id", activeWorkspace.id)
        .eq(memberColumn, activeMember.id);

      for (const [column, value] of Object.entries(
        JSON.parse(equalsKey) as Record<string, string>,
      )) {
        query = query.eq(column, value);
      }
      // Soft-deleted rows must disappear here the moment HR removes them —
      // there is one table, so "deleted there" has to mean "gone here".
      for (const column of isNullKey ? isNullKey.split(",") : []) {
        query = query.is(column, null);
      }

      const { data, error } = await query.order(orderBy, { ascending: false });
      if (error) throw error;
      // `columns` is a runtime string, so PostgREST's generic types cannot
      // infer the row shape — via unknown rather than a direct assertion.
      setRows(((data as unknown) as Row[] | null) || []);
    } catch (err) {
      // Shown in place rather than only as a toast: an empty list and a
      // failed query look identical otherwise, which is how "nothing here"
      // silently hides a permission problem.
      const msg = err instanceof Error ? err.message : "Could not load these records";
      setFailed(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    supabase,
    activeWorkspace?.id,
    activeMember?.id,
    table,
    columns,
    orderBy,
    memberColumn,
    // Serialised: callers pass object/array literals, whose identity changes
    // every render — depending on them directly would refetch forever.
    equalsKey,
    isNullKey,
  ]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} actions={actions} />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : failed ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
          {failed}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <Inbox className="mx-auto size-7 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium text-foreground">Nothing here yet</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r, i) => (
            <div key={String(r.id ?? i)} className="px-4 py-3">
              {renderRow(r)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
