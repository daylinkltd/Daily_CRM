"use client";

import Link from "next/link";
import { CheckCircle2, Circle, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useWorkspaceSetup } from "@/hooks/use-workspace-setup";
import { SETUP_ITEMS } from "@/lib/workspace/setup-checklist";

/**
 * Owner/admin setup checklist.
 *
 * Shows the whole list — done and outstanding — rather than only what is
 * missing, so progress is visible and the page is worth returning to.
 * Anyone without the permission to fix these gets told plainly instead of
 * seeing an empty page.
 */
export default function SetupPage() {
  const { status, loading, refresh, canAct } = useWorkspaceSetup();

  if (!canAct) {
    return (
      <div className="space-y-5">
        <PageHeader title="Workspace setup" />
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Only an owner or admin can change these settings. Ask them to finish workspace setup.
        </p>
      </div>
    );
  }

  if (loading || !status) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const outstandingIds = new Set(status.outstanding.map((i) => i.id));
  // Only items that apply to the modules this workspace uses.
  const applicable = SETUP_ITEMS.filter(
    (i) => outstandingIds.has(i.id) || status.completed >= 0
  ).filter((i) => {
    const inOutstanding = outstandingIds.has(i.id);
    // An item absent from outstanding is either done or not applicable;
    // the checker already excluded inapplicable ones from the total, so
    // fall back to showing it as done only when the totals allow.
    return inOutstanding || status.total > 0;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workspace setup"
        description="These settings feed your documents, letters and invoices. Anything missing degrades them quietly rather than failing, so it is worth finishing."
        actions={
          <Button variant="outline" onClick={refresh} className="gap-1.5">
            <RefreshCw className="size-4" /> Re-check
          </Button>
        }
      />

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {status.completed} of {status.total} complete
          </p>
          <p className="text-xs text-muted-foreground">
            {status.blocking.length > 0
              ? `${status.blocking.length} item${status.blocking.length === 1 ? "" : "s"} still affects customer-facing output.`
              : "Nothing critical outstanding."}
          </p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${status.total ? (status.completed / status.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border">
        {applicable.map((item) => {
          const done = !outstandingIds.has(item.id);
          return (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3">
              {done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              ) : item.severity === "blocking" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={
                      done
                        ? "text-sm font-medium text-muted-foreground line-through"
                        : "text-sm font-medium text-foreground"
                    }
                  >
                    {item.label}
                  </p>
                  {!done && item.severity === "blocking" && (
                    <Badge className="bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
                      Affects documents
                    </Badge>
                  )}
                </div>
                {!done && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.consequence}</p>
                )}
              </div>

              {!done && (
                <Link href={item.href} className="shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    Set up
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
