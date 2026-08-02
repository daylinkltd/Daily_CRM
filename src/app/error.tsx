"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/layout/error-state";

/**
 * Route-level error boundary: catches a render or data error in any page
 * and offers a retry, instead of Next's default stack trace.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack in production,
    // so it needs to reach the console even though it means nothing to the
    // person reading the page.
    console.error("Route error:", error.digest ?? "(no digest)", error);
  }, [error]);

  return (
    <ErrorState
      code="500"
      title="Something went wrong on this page"
      message="The error has been logged. Trying again often works — the page may have hit a temporary problem."
      onRetry={reset}
    >
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground/70">
          Reference: {error.digest}
        </p>
      )}
    </ErrorState>
  );
}
