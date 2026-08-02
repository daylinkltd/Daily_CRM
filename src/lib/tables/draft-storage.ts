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

/* ─────────────────────────────────────────────────────────────
   Single-field text drafts (rich text editors)

   Motivating incident: someone typed a long policy into the editor, the
   tab closed, and the work was gone — never saved, unrecoverable, and
   they could not remember what they had written.

   Kept separate from the row-based helpers above because the recovery
   rule is different: a text draft is NEVER auto-applied. Silently
   replacing what the server sent with a local draft would let a stale
   draft clobber someone else's newer edit. It is offered, and the user
   decides.
   ───────────────────────────────────────────────────────────── */

export interface TextDraft {
  v: 1;
  at: number;
  /** The draft body. */
  html: string;
  /** What the server value was when this draft started, so a draft can be
   *  recognised as stale if the server has since moved on. */
  base: string;
}

/** Drafts older than this are abandoned. */
export const TEXT_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function textDraftKey(scope: string): string {
  return `textdraft:${scope}`;
}

/** Strip tags and whitespace so two renderings of the same text compare equal. */
function normalise(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Worth storing only when there is real content AND it differs from what
 * the server already has — otherwise every editor would leave a draft
 * that immediately offers to restore what is already on screen.
 */
export function shouldStoreTextDraft(html: string, base: string): boolean {
  const body = normalise(html);
  if (body.length === 0) return false;
  return body !== normalise(base);
}

export function serializeTextDraft(html: string, base: string, now: number): string | null {
  if (!shouldStoreTextDraft(html, base)) return null;
  return JSON.stringify({ v: 1, at: now, html, base } satisfies TextDraft);
}

/**
 * Returns the draft only when it is still worth offering: parseable,
 * current version, not expired, and genuinely different from the value
 * now on screen.
 */
export function parseTextDraft(
  raw: string | null,
  currentValue: string,
  now: number,
  maxAgeMs: number = TEXT_DRAFT_MAX_AGE_MS
): { html: string; at: number; baseChanged: boolean } | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const d = parsed as Partial<TextDraft>;
  if (d.v !== 1 || typeof d.html !== "string" || typeof d.at !== "number") return null;
  if (now - d.at > maxAgeMs) return null;
  if (normalise(d.html).length === 0) return null;
  // Already saved, or identical to what is displayed — nothing to offer.
  if (normalise(d.html) === normalise(currentValue)) return null;

  return {
    html: d.html,
    at: d.at,
    // The server value moved on since the draft began, so restoring would
    // discard someone else's change — the UI should say so.
    baseChanged: typeof d.base === "string" && normalise(d.base) !== normalise(currentValue),
  };
}

/** "2 minutes ago" — plain, for the recovery prompt. */
export function describeAge(at: number, now: number): string {
  const mins = Math.floor((now - at) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
