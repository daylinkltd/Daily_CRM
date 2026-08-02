/**
 * Draft persistence for data-entry forms.
 *
 * The problem this solves: someone types fifteen rows into a bulk-add
 * dialog, hits the back button or reloads, and every one is gone. Work
 * in progress is saved as it is typed and restored when the same form
 * reopens; it is cleared only on a successful save or a deliberate,
 * confirmed cancel.
 *
 * Pure so it can be unit tested — the browser storage call lives in the
 * hook that wraps this.
 */

export interface Draft<T> {
  /** Schema version, so a changed form shape does not restore garbage. */
  v: number;
  /** Epoch ms of the last edit. */
  at: number;
  rows: T[];
}

/** Drafts older than this are treated as abandoned and discarded. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function draftKey(scope: string, workspaceId: string | null | undefined): string {
  return `draft:${scope}:${workspaceId ?? "none"}`;
}

/** A row is worth keeping only if the user actually typed something. */
export function isBlankRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every(
    (v) => v === "" || v === null || v === undefined || v === false
  );
}

export function meaningfulRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.filter((r) => !isBlankRow(r));
}

export function serializeDraft<T extends Record<string, unknown>>(
  rows: T[],
  version: number,
  now: number
): string | null {
  const keep = meaningfulRows(rows);
  // Nothing typed yet — storing an empty draft would resurrect a blank
  // form and make "restore" look broken.
  if (keep.length === 0) return null;
  return JSON.stringify({ v: version, at: now, rows: keep } satisfies Draft<T>);
}

/**
 * Parse a stored draft, rejecting anything malformed, stale, or written
 * by a different version of the form.
 */
export function parseDraft<T extends Record<string, unknown>>(
  raw: string | null,
  version: number,
  now: number,
  maxAgeMs: number = DRAFT_MAX_AGE_MS
): T[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const d = parsed as Partial<Draft<T>>;
  if (d.v !== version) return null;
  if (typeof d.at !== "number" || now - d.at > maxAgeMs) return null;
  if (!Array.isArray(d.rows) || d.rows.length === 0) return null;

  const rows = d.rows.filter(
    (r): r is T => Boolean(r) && typeof r === "object" && !Array.isArray(r)
  );
  return rows.length > 0 ? rows : null;
}

/**
 * Split pasted spreadsheet text into rows and cells.
 *
 * Copying from Excel or Sheets yields tab-separated columns and
 * newline-separated rows, so pasting a column of names into the first
 * cell should fill the grid rather than dumping everything into one box.
 */
export function parsePastedGrid(text: string): string[][] {
  if (!text) return [];
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.split("\t"));
}
