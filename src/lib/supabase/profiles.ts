/**
 * supabase-profiles.ts
 *
 * Helper utilities for enriching workspace_members records with profile data.
 *
 * BACKGROUND:
 *   workspace_members.user_id is a FK to auth.users (not public.profiles).
 *   Supabase PostgREST can only auto-join within the public schema, so the
 *   common pattern `profiles:user_id(full_name)` throws a 400 error:
 *     "Could not find a relationship between 'workspace_members' and 'user_id'"
 *
 *   Use these helpers instead to do the two-step fetch pattern.
 */

type SupabaseClient = any;

/**
 * Given an array of records that each have a nested `{ user_id }` object at
 * `accessorKey` (e.g. records[n].manager = { id, user_id }), fetches profiles
 * for all those user_ids and merges them in as `.profiles`.
 *
 * @example
 * // For a flat list of workspace_members with user_id:
 * const members = await enrichMembersWithProfiles(supabase, rawMembers, null, ['full_name', 'avatar_url']);
 *
 * // For nested records like projects where project.manager = { id, user_id }:
 * const projects = await enrichNestedWithProfiles(supabase, rawProjects, 'manager', ['full_name', 'avatar_url']);
 */

/**
 * Enrich a flat array of workspace_member records (each with `user_id`) with
 * profile data merged in as `.profiles`.
 */
export async function enrichMembersWithProfiles(
  supabase: SupabaseClient,
  members: any[],
  fields: string[] = ['full_name', 'avatar_url']
): Promise<any[]> {
  if (!members || members.length === 0) return [];
  const userIds = members.map((m) => m.user_id).filter(Boolean);
  if (userIds.length === 0) return members;

  const { data: profilesData } = await supabase
    .from('profiles')
    .select(['user_id', ...fields].join(', '))
    .in('user_id', userIds);

  const profileMap = Object.fromEntries(
    (profilesData || []).map((p: any) => [p.user_id, p])
  );

  return members.map((m) => ({
    ...m,
    profiles: m.user_id ? profileMap[m.user_id] || null : null,
  }));
}

/**
 * Enrich an array of records where each record has a nested object at
 * `nestedKey` that contains `user_id`. Merges profile data into nested.profiles.
 *
 * e.g. for projects[] where project.manager = { id, user_id }
 *   enrichNestedWithProfiles(supabase, projects, 'manager', ['full_name', 'avatar_url'])
 */
export async function enrichNestedWithProfiles(
  supabase: SupabaseClient,
  records: any[],
  nestedKey: string,
  fields: string[] = ['full_name', 'avatar_url']
): Promise<any[]> {
  if (!records || records.length === 0) return [];
  const userIds = records.map((r) => r[nestedKey]?.user_id).filter(Boolean);
  if (userIds.length === 0) return records;

  const { data: profilesData } = await supabase
    .from('profiles')
    .select(['user_id', ...fields].join(', '))
    .in('user_id', userIds);

  const profileMap = Object.fromEntries(
    (profilesData || []).map((p: any) => [p.user_id, p])
  );

  return records.map((r) => ({
    ...r,
    [nestedKey]: r[nestedKey]
      ? { ...r[nestedKey], profiles: profileMap[r[nestedKey].user_id] || null }
      : r[nestedKey],
  }));
}
