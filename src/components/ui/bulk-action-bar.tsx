"use client";

import type { ReactNode } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
 * The header checkbox — a real bordered box with a tick, not a bare
 * native input. Shows a dash when only some rows are selected.
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
    <Checkbox
      aria-label={label}
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      onCheckedChange={onChange}
      className="size-[18px] rounded-[4px]"
    />
  );
}

/**
 * A row checkbox that forwards shift-click for range selection.
 *
 * The handler is on `onClick` rather than `onCheckedChange` because only
 * the click event carries the modifier keys — `onCheckedChange` receives
 * just the new boolean, which is not enough to know a range was meant.
 */
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
    <Checkbox
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onClick={(e) => {
        // Our own state owns `checked`, so stop the primitive from also
        // toggling and cancelling this out.
        e.preventDefault();
        onToggle({ shiftKey: e.shiftKey });
      }}
      className="size-[18px] rounded-[4px]"
    />
  );
}
