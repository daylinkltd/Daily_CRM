/**
 * Guard against the silent-success pattern.
 *
 * Supabase returns `{ error: null }` when an UPDATE or DELETE matches
 * ZERO rows — including when RLS silently filtered every candidate away.
 * So the obvious `if (error) throw` check passes, the UI fires a success
 * toast, and nothing happened. Leave stays PENDING, the deleted row
 * reappears on refresh, the salary is unchanged.
 *
 * The fix is always the same: add `.select(...)` to the mutation so
 * PostgREST returns the affected rows, then treat an empty result as a
 * failure. These helpers make that one call instead of six lines.
 *
 * There is a reference implementation of the raw pattern in
 * src/app/api/hr/policies/[id]/route.ts (DELETE).
 */

export interface MutationResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export class NoRowsAffectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoRowsAffectedError";
  }
}

/**
 * Throw unless the mutation actually changed something.
 *
 * `subject` completes the sentence "Could not update {subject}" — pass
 * something the reader recognises, e.g. `the leave request`.
 */
export function assertAffected<T>(
  result: MutationResult<T>,
  subject: string,
  verb: "update" | "delete" | "save" = "update"
): T[] {
  if (result.error) throw new Error(result.error.message);

  if (!result.data || result.data.length === 0) {
    throw new NoRowsAffectedError(
      `Could not ${verb} ${subject}. It may have been removed, or you may not have permission.`
    );
  }
  return result.data;
}

/**
 * Bulk variant: reports how many of the requested rows were actually
 * touched, so "Deleted 10" can never be shown when only 3 were.
 */
export function affectedCount<T>(
  result: MutationResult<T>,
  requested: number,
  subject: string
): { affected: number; partial: boolean; message: string } {
  if (result.error) throw new Error(result.error.message);
  const affected = result.data?.length ?? 0;

  if (affected === 0) {
    throw new NoRowsAffectedError(
      `No ${subject} were changed. They may have been removed, or you may not have permission.`
    );
  }
  return {
    affected,
    partial: affected < requested,
    message:
      affected < requested
        ? `${affected} of ${requested} ${subject} changed — the rest were not permitted or no longer exist.`
        : `${affected} ${subject} changed.`,
  };
}
