"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceSetup } from "@/hooks/use-workspace-setup";
import { setupSummary } from "@/lib/workspace/setup-checklist";
import { cn } from "@/lib/utils";

const SNOOZE_KEY = "setup_banner_snoozed_until";
const SNOOZE_MS = 8 * 60 * 60 * 1000;

/**
 * Persistent reminder that load-bearing setup is missing.
 *
 * Design decisions, since these are the ones that make a banner useful
 * rather than hated:
 *
 *  * Only shown to owners, admins and anyone with workspace settings —
 *    nobody else can act on it, and an un-actionable nag is just noise.
 *  * It names the CONSEQUENCE, not the task. "Set up letterhead" is a
 *    demand; "every offer letter goes out unbranded" is a reason.
 *  * Blocking items cannot be dismissed, only snoozed for 8 hours, and
 *    the snooze is per-browser. A missing letterhead degrades every
 *    document silently, so it has to keep coming back.
 *  * Recommendations CAN be dismissed for the session — they are advice.
 *  * It is not a marquee. Scrolling text is hard to read and reads as an
 *    advert; a static line with a link is faster to act on.
 */
export function SetupBanner() {
  const { status, loading, canAct } = useWorkspaceSetup();
  const [dismissed, setDismissed] = useState(false);

  const snoozedUntil =
    typeof window === "undefined" ? 0 : Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0);
  const snoozed = Date.now() < snoozedUntil;

  if (loading || !canAct || !status || status.outstanding.length === 0) return null;
  if (dismissed) return null;

  const hasBlocking = status.blocking.length > 0;
  // Only recommendations left, and the user has snoozed: stay quiet.
  if (!hasBlocking && snoozed) return null;

  const message = setupSummary(status);
  if (!message) return null;

  const snooze = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 text-xs",
        hasBlocking
          ? "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          : "border-border bg-muted/50 text-muted-foreground"
      )}
    >
      {hasBlocking ? (
        <AlertTriangle className="size-3.5 shrink-0" />
      ) : (
        <CheckCircle2 className="size-3.5 shrink-0" />
      )}

      <span className="min-w-0 flex-1">
        {message}{" "}
        <span className="opacity-70">
          ({status.completed} of {status.total} done)
        </span>
      </span>

      <Link href="/setup" className="shrink-0">
        <Button size="sm" variant={hasBlocking ? "default" : "outline"} className="h-7 gap-1 text-xs">
          Finish setup <ChevronRight className="size-3" />
        </Button>
      </Link>

      <Button
        size="sm"
        variant="ghost"
        onClick={snooze}
        aria-label={hasBlocking ? "Remind me later" : "Dismiss"}
        title={hasBlocking ? "Remind me in 8 hours" : "Dismiss"}
        className="h-7 shrink-0 px-2"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
