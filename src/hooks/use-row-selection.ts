"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  allVisibleSelected as calcAllVisible,
  hiddenSelectedCount as calcHidden,
  pruneMissing,
  selectRange,
  setId,
  someVisibleSelected as calcSomeVisible,
  toggleAllVisible as calcToggleAll,
  toggleId,
} from "@/lib/tables/selection";

/**
 * Table selection state. The decisions live in `@/lib/tables/selection`
 * (pure and unit tested); this only holds the state and the shift-click
 * anchor.
 */
export interface RowSelection<T> {
  selectedIds: string[];
  selectedCount: number;
  /** Selected rows that are currently visible. */
  selectedRows: T[];
  isSelected: (id: string) => boolean;
  toggle: (id: string, opts?: { shiftKey?: boolean }) => void;
  setSelected: (id: string, selected: boolean) => void;
  toggleAllVisible: () => void;
  clear: () => void;
  /** Drop ids that no longer exist — call after a bulk delete. */
  prune: (allKnownIds: string[]) => void;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  hiddenSelectedCount: number;
}

export function useRowSelection<T>(
  visibleRows: T[],
  getId: (row: T) => string
): RowSelection<T> {
  const [selected, setSelectedState] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<string | null>(null);

  const visibleIds = useMemo(() => visibleRows.map(getId), [visibleRows, getId]);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback(
    (id: string, opts?: { shiftKey?: boolean }) => {
      setSelectedState((prev) =>
        opts?.shiftKey
          ? selectRange(prev, visibleIds, anchorRef.current, id)
          : toggleId(prev, id)
      );
      anchorRef.current = id;
    },
    [visibleIds]
  );

  const setSelected = useCallback((id: string, value: boolean) => {
    setSelectedState((prev) => setId(prev, id, value));
    anchorRef.current = id;
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedState((prev) => calcToggleAll(prev, visibleIds));
  }, [visibleIds]);

  const clear = useCallback(() => {
    setSelectedState(new Set());
    anchorRef.current = null;
  }, []);

  const prune = useCallback((allKnownIds: string[]) => {
    setSelectedState((prev) => pruneMissing(prev, allKnownIds));
  }, []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selected.has(getId(r))),
    [visibleRows, selected, getId]
  );

  return {
    selectedIds,
    selectedCount: selected.size,
    selectedRows,
    isSelected,
    toggle,
    setSelected,
    toggleAllVisible,
    clear,
    prune,
    allVisibleSelected: calcAllVisible(selected, visibleIds),
    someVisibleSelected: calcSomeVisible(selected, visibleIds),
    hiddenSelectedCount: calcHidden(selected, visibleIds),
  };
}
