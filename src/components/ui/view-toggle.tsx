"use client";

import { LayoutGrid, List } from "lucide-react";

export type BoardView = "kanban" | "list";

/**
 * Kanban / List switch for any board that has both.
 *
 * A board is good for moving work along and bad for scanning, comparing or
 * sorting fifty rows — so the same data gets two presentations rather than
 * one compromise. Rendered as radio buttons, not two toggle buttons, so
 * assistive tech announces it as one choice with a current value.
 */
export function ViewToggle({
  value,
  onChange,
  label = "View",
}: {
  value: BoardView;
  onChange: (view: BoardView) => void;
  label?: string;
}) {
  const options: { key: BoardView; icon: React.ElementType; text: string }[] = [
    { key: "kanban", icon: LayoutGrid, text: "Board" },
    { key: "list", icon: List, text: "List" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
    >
      {options.map(({ key, icon: Icon, text }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            {text}
          </button>
        );
      })}
    </div>
  );
}
