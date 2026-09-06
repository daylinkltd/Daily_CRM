"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard] Section error caught:", error.digest ?? "(no digest)", error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-3xl border border-border bg-card/60 p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-3">
        <RefreshCw className="h-6 w-6" />
      </div>
      <h2 className="text-base font-bold text-foreground">
        Unable to load this section
      </h2>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">
        A temporary rendering issue occurred. You can retry loading this view or return to the main dashboard.
      </p>

      {error?.message && (
        <p className="mt-2 max-w-lg rounded-xl bg-muted/60 p-2 font-mono text-[11px] text-muted-foreground">
          {error.message}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Button
          onClick={() => reset()}
          size="sm"
          className="rounded-xl font-bold text-xs gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Section
        </Button>
        <Link href="/marketing/dashboard">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl font-bold text-xs gap-1.5"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Marketing Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
