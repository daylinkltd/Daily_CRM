/**
 * Narrow helpers for recognising specific Postgres failures behind a
 * PostgREST/Supabase error object, so routes can degrade gracefully
 * instead of returning an opaque 500.
 */

/** Shape of the error objects `@supabase/supabase-js` returns. */
export interface PostgresErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * Postgres 42P10 — `ON CONFLICT (...)` naming columns with no matching
 * unique/exclusion constraint. In this codebase it means a table exists
 * in the deployment without the UNIQUE constraint its migration declares
 * (e.g. `message_reactions`, whose constraint migration 071 repairs), so
 * an upsert can only be served by a manual delete-then-insert.
 */
export function isMissingOnConflictConstraint(
  error: PostgresErrorLike | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "42P10") return true;
  const haystack = [error.message, error.details, error.hint]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(
    "no unique or exclusion constraint matching the on conflict",
  );
}

/** Human-readable one-liner for logs and API error payloads. */
export function describePostgresError(
  error: PostgresErrorLike | null | undefined,
): string {
  if (!error) return "unknown database error";
  const message = error.message?.trim();
  const code = error.code?.trim();
  if (message && code) return `${message} (${code})`;
  return message || code || "unknown database error";
}
