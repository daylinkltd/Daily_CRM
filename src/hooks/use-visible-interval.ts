import { useEffect, useRef } from "react";

/**
 * Run an async callback on an interval, but only while the tab is
 * actually being looked at.
 *
 * Replaces bare `setInterval(fetch, 4000)` polling, which had three
 * cost/correctness problems:
 *
 *   1. It kept firing in background tabs. A dashboard left open in a
 *      pinned tab issued ~900 requests/hour per poller forever — pure
 *      waste, and it's billed per request.
 *   2. Overlapping runs. A slow response didn't stop the next tick, so
 *      responses could land out of order and clobber newer state with
 *      older data.
 *   3. Nothing caught up on return. Coming back to a hidden tab you
 *      waited up to a full interval to see anything new.
 *
 * This hook pauses while `document.hidden`, guards against overlapping
 * runs, and fires immediately when the tab becomes visible again so
 * returning to it feels instant.
 *
 * Live updates arrive over Supabase realtime; this polling is only a
 * safety net for missed events, which is why the default interval is
 * deliberately relaxed.
 */
export function useVisibleInterval(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options: { enabled?: boolean; runOnMount?: boolean } = {},
) {
  const { enabled = true, runOnMount = true } = options;

  // Keep the latest callback without restarting the timer — otherwise
  // every parent re-render would reset the interval and, with an
  // immediate leading run, hammer the endpoint.
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    let cancelled = false;

    const run = async () => {
      if (cancelled || inFlightRef.current) return;
      if (document.hidden) return;
      inFlightRef.current = true;
      try {
        await callbackRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    if (runOnMount) void run();

    let timer: ReturnType<typeof setInterval> | null = null;
    const startTimer = () => {
      if (timer === null) timer = setInterval(() => void run(), intervalMs);
    };
    const stopTimer = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        // Catch up on whatever was missed while hidden, then resume.
        void run();
        startTimer();
      }
    };

    if (!document.hidden) startTimer();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs, runOnMount]);
}

/**
 * Safety-net interval for views that also receive Supabase realtime
 * events. Long on purpose: realtime delivers the live updates, so this
 * only needs to repair the rare missed event.
 */
export const REALTIME_BACKUP_POLL_MS = 20_000;
