"use client";

import type { ReactNode } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The bar that appears once rows are selected, holding whatever bulk
 * actions the table supports.
 *
 * It floats above the content rather than pushing it down, so ticking a
 * row never reflows the list under the cursor and makes you mis-click
 * the next one.
 */
export function BulkActionBar({
  count,
  hiddenCount = 0,
  onClear,
  children,
  busy = false,
  noun = "item",
  className,
}: {
  count: number;
  /** Selected rows the current filter is hiding — worth saying out loud. */
  hiddenCount?: number;
  onClear: () => void;
  children: ReactNode;
  busy?: boolean;
  /** Singular noun for the count, e.g. "employee". */
  noun?: string;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label={`${count} ${noun}${count === 1 ? "" : "s"} selected`}
      className={cn(
        "sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2",
        "rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur",
        className
      )}
    >
      <span className="px-1 text-xs font-semibold text-foreground">
        {count} {noun}
        {count === 1 ? "" : "s"} selected
      </span>

      {hiddenCount > 0 && (
        <span className="text-[11px] text-muted-foreground">
          ({hiddenCount} hidden by the current filter)
        </span>
      )}

      <div className="mx-1 h-4 w-px bg-border" aria-hidden />

      <div className="flex flex-wrap items-center gap-1.5">{children}</div>

      {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        aria-label="Clear selection"
        className="ml-1 px-2 text-muted-foreground"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

/**
 * The header checkbox. Renders the indeterminate state that a native
 * checkbox can only be given imperatively, via the `ref` callback.
 */
export function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  label = "Select all rows",
  disabled,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      // `indeterminate` is a DOM property, not an attribute — React
      // cannot set it declaratively.
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      className="size-3.5 cursor-pointer accent-primary"
    />
  );
}

/** A row checkbox that forwards shift-click for range selection. */
export function SelectRowCheckbox({
  checked,
  onToggle,
  label,
  disabled,
}: {
  checked: boolean;
  onToggle: (opts: { shiftKey: boolean }) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      // onClick carries the modifier keys; onChange does not.
      onClick={(e) => onToggle({ shiftKey: e.shiftKey })}
      onChange={() => {}}
      className="size-3.5 cursor-pointer accent-primary"
    />
  );
}
