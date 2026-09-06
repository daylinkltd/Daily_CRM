"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  /** Second line, also searched — e.g. an email or SKU. */
  hint?: string | null;
}

/**
 * Match an option against a query.
 *
 * Every whitespace-separated term must appear somewhere in the label or
 * hint, so "priya sharma" finds "Sharma, Priya" and "acme inv" finds
 * "INV-204 — Acme Ltd". A plain substring test would miss both.
 */
export function matchesQuery(option: SearchableOption, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${option.label} ${option.hint ?? ""}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** Filter, preserving the caller's ordering. */
export function filterOptions(
  options: SearchableOption[],
  query: string,
): SearchableOption[] {
  return options.filter((o) => matchesQuery(o, query));
}

/**
 * A dropdown you can type into.
 *
 * A native `<select>` is fine for five options and unusable for two
 * hundred — you cannot see what you are looking for, and type-ahead only
 * matches from the first character. This keeps the same one-value-in,
 * one-value-out contract so it can replace a `<select>` in place.
 *
 * Generalised from the product combobox in the POS, which had the same
 * behaviour hard-wired to products.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyMessage = "No matches",
  disabled,
  clearable,
  className,
  ariaLabel,
  createLabel,
  onCreate,
}: {
  options: SearchableOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** Show an ✕ to unset the value. */
  clearable?: boolean;
  className?: string;
  ariaLabel?: string;
  /** With `onCreate`, pins a "+ {createLabel}" footer below the list —
   *  outside the filter, so it shows exactly when nothing matches.
   *  The dropdown closes before the caller's create dialog opens. */
  createLabel?: string;
  onCreate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);

  // Close on an outside click. Pointerdown rather than click so the
  // dropdown is gone before whatever was clicked handles its own event.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Clamped at render rather than reset from an effect: a filtered list can
  // be shorter than the current highlight, and setting state inside an
  // effect to fix that costs an extra render pass every keystroke.
  const highlighted = Math.min(highlight, Math.max(0, filtered.length - 1));

  const setOpenState = (next: boolean) => {
    setOpen(next);
    // Clearing here rather than in an effect keeps the reset on the one
    // action that causes it.
    if (!next) setQuery("");
  };

  const commit = (next: string | null) => {
    onChange(next);
    setOpenState(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(Math.min(highlighted + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(Math.max(highlighted - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[highlighted];
      if (option) commit(option.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpenState(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpenState(!open)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-sm",
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted/40",
        )}
      >
        <span
          className={cn(
            "truncate text-left",
            selected ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {clearable && selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                commit(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  commit(null);
                }
              }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown className="size-4 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-controls={listId}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => commit(option.value)}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2 text-left text-sm",
                        index === highlighted ? "bg-muted" : "hover:bg-muted/60",
                      )}
                    >
                      <Check
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0",
                          isSelected ? "text-primary" : "invisible",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-foreground">
                          {option.label}
                        </span>
                        {option.hint && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {option.hint}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {createLabel && onCreate && (
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => {
                  setOpenState(false);
                  onCreate();
                }}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
              >
                <Plus className="size-3.5" /> {createLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
