"use client";

// ============================================================
// CreatableSelect — the app-wide "pick one, or make one" dropdown.
//
// A searchable Select with a pinned "+ Add …" footer that opens the
// caller's create dialog. The footer lives OUTSIDE the search filter,
// so it is visible exactly when it matters most: the user typed a
// value that doesn't exist yet. The dropdown closes itself before
// calling onCreate so the dialog isn't fighting a popup for focus.
//
// This is a pattern, not a printing feature: any picker in the app
// that has a "…but it doesn't exist yet" moment (contacts, ledgers,
// presets, products) should compose this instead of a bare Select.
//
//   <CreatableSelect
//     options={contacts.map(c => ({ value: c.id, label: c.name }))}
//     value={contactId}
//     onValueChange={setContactId}
//     createLabel="Add customer"
//     onCreate={() => setContactDialogOpen(true)}
//   />
// ============================================================

import * as React from "react";
import { Plus } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CreatableOption {
  value: string;
  label: string;
  /** Muted suffix, e.g. a company name after a contact. */
  hint?: string | null;
}

export function CreatableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  createLabel,
  onCreate,
  disabled,
  triggerClassName,
  "aria-label": ariaLabel,
}: {
  options: CreatableOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Footer text — rendered as "+ {createLabel}". */
  createLabel: string;
  /** Open the connected create dialog. The popup closes first. */
  onCreate: () => void;
  disabled?: boolean;
  triggerClassName?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const byValue = React.useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options],
  );

  return (
    <Select
      value={value}
      onValueChange={(v) => v != null && onValueChange(v as string)}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <SelectTrigger className={triggerClassName} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder}>
          {(v: string) => byValue.get(v)?.label ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        searchPlaceholder={searchPlaceholder}
        footer={
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
            className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
          >
            <Plus className="size-3.5" /> {createLabel}
          </button>
        }
      >
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
            {o.hint ? ` — ${o.hint}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
