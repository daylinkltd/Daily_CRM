"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SubTab {
  id: string;
  label: string;
  render: () => ReactNode;
}

/**
 * Groups several related settings panels behind one rail entry.
 *
 * The rail had 22 items, which is a list you scan rather than read.
 * Merging is done by nesting the EXISTING panels rather than rewriting
 * them — every panel keeps its own logic, so nothing is lost or
 * duplicated, and a deep link to an old ?tab= value still lands on the
 * right sub-tab via `initialTab`.
 */
export function SettingsSubtabs({
  tabs,
  initialTab,
}: {
  tabs: SubTab[];
  initialTab?: string;
}) {
  const [active, setActive] = useState(
    () => tabs.find((t) => t.id === initialTab)?.id ?? tabs[0]?.id
  );

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      {tabs.length > 1 && (
        <div
          role="tablist"
          aria-label="Settings sections"
          className="mb-5 inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === active}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                t.id === active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {current?.render()}
    </div>
  );
}
