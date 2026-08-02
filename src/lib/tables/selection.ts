/**
 * Pure selection logic for tables — no React, so it is unit testable in
 * the project's node test environment.
 *
 * Two behaviours that are easy to get wrong and are decided here:
 *
 *  1. Selection survives filtering. Tick five rows, then type in the
 *     search box, and those five stay selected even while hidden.
 *     Dropping them silently is worse than keeping them, because the
 *     bulk action bar keeps showing the true count.
 *  2. "Select all" means all VISIBLE rows, never the whole table.
 *     Ticking the header box while a filter is active and then deleting
 *     must not touch rows the user could not see.
 */

/** Toggle one id on or off. */
export function toggleId(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Force one id to an explicit state. */
export function setId(selected: Set<string>, id: string, value: boolean): Set<string> {
  const next = new Set(selected);
  if (value) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * Extend the selection from `anchor` to `id` across the current visible
 * order. A range gesture only ever ADDS: letting it deselect makes
 * shift-click unpredictable, which is not how any desktop file manager
 * behaves.
 *
 * Falls back to a plain toggle when either end is not currently visible.
 */
export function selectRange(
  selected: Set<string>,
  visibleIds: string[],
  anchor: string | null,
  id: string
): Set<string> {
  if (!anchor || anchor === id) return toggleId(selected, id);
  const from = visibleIds.indexOf(anchor);
  const to = visibleIds.indexOf(id);
  if (from === -1 || to === -1) return toggleId(selected, id);

  const [lo, hi] = from < to ? [from, to] : [to, from];
  const next = new Set(selected);
  for (let i = lo; i <= hi; i++) next.add(visibleIds[i]);
  return next;
}

/**
 * Select every visible row, or clear them if they are all already
 * selected. Rows outside `visibleIds` are left exactly as they were.
 */
export function toggleAllVisible(
  selected: Set<string>,
  visibleIds: string[]
): Set<string> {
  const next = new Set(selected);
  if (allVisibleSelected(selected, visibleIds)) {
    visibleIds.forEach((id) => next.delete(id));
  } else {
    visibleIds.forEach((id) => next.add(id));
  }
  return next;
}

export function allVisibleSelected(selected: Set<string>, visibleIds: string[]): boolean {
  return visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
}

export function someVisibleSelected(selected: Set<string>, visibleIds: string[]): boolean {
  return (
    !allVisibleSelected(selected, visibleIds) && visibleIds.some((id) => selected.has(id))
  );
}

/** Selected ids the current filter has hidden. */
export function hiddenSelectedCount(selected: Set<string>, visibleIds: string[]): number {
  const visible = new Set(visibleIds);
  let n = 0;
  selected.forEach((id) => {
    if (!visible.has(id)) n++;
  });
  return n;
}

/** Drop any selection that no longer exists at all (e.g. after a delete). */
export function pruneMissing(selected: Set<string>, allKnownIds: string[]): Set<string> {
  const known = new Set(allKnownIds);
  const next = new Set<string>();
  selected.forEach((id) => {
    if (known.has(id)) next.add(id);
  });
  return next;
}
