"use client";

import { useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { MODE_STORAGE_KEY, LEGACY_MODE_STORAGE_KEY, type Mode } from "@/lib/themes";

/** No native change event for a dataset attribute; the toggle re-renders itself. */
function subscribeToMode(): () => void {
  return () => {};
}

/**
 * Light/dark switch for the marketing site.
 *
 * Writes `html[data-mode]` and persists under the SAME storage key the app
 * uses, so a visitor who picks light here stays in light after signing in.
 * Two separate preferences for one person would be a bug, not a feature.
 *
 * Renders a placeholder of identical size until mounted: the real mode is
 * only knowable on the client, and rendering the wrong icon then swapping
 * it causes both a hydration mismatch and a visible flicker.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // `useSyncExternalStore` rather than a state-setting effect: the mode
  // lives on the <html> element, which is external to React. Reading it in
  // an effect and calling setState costs an extra render pass on every
  // mount and trips react-hooks/set-state-in-effect; this reads it during
  // render and still returns null on the server, so the placeholder below
  // keeps hydration honest.
  const mode = useSyncExternalStore<Mode | null>(
    subscribeToMode,
    () => (document.documentElement.dataset.mode === "dark" ? "dark" : "light"),
    () => null,
  );
  const [, forceUpdate] = useState(0);

  const toggle = () => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.mode = next;
    // The <html> dataset is not observable, so nudge a re-render to swap
    // the icon. Cheap, and confined to this component.
    forceUpdate((n) => n + 1);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
      // Clear the pre-rename key so it cannot win on the next boot.
      window.localStorage.removeItem(LEGACY_MODE_STORAGE_KEY);
    } catch {
      // Private mode / storage disabled: the toggle still works for this
      // page view, it just will not be remembered. Not worth surfacing.
    }
  };

  if (mode === null) {
    return <span aria-hidden className={`inline-block size-9 ${className ?? ""}`} />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex size-9 items-center justify-center border border-[var(--mkt-line)] bg-[var(--mkt-surface)] text-[var(--mkt-fg-muted)] transition-colors hover:text-[var(--mkt-fg)] ${className ?? ""}`}
    >
      {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
