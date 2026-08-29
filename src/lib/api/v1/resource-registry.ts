// ============================================================
// Public API (v1) resource registry — derived from the RBAC catalog.
//
// The dashboard's permission matrix, the generated RLS policies, and the
// public API all come from `src/lib/auth/resources.ts`. Adding a resource
// there makes it reachable over the API automatically, so the two cannot
// drift into "the matrix knows about payroll but the API doesn't".
//
// ROUTING MODEL — every table in the catalog gets its own path, plus a
// friendly alias for each resource's primary table:
//
//   /api/v1/payroll_cycles     the table, by name
//   /api/v1/payroll            alias → payroll_cycles
//   /api/v1/epics              a second table of the `sprints` resource
//
// Scopes are keyed by the OWNING RESOURCE, not the path, exactly as the
// RLS policies are: `epics` is gated by `sprints:read` in the database, so
// it is gated by `sprints:read` here too. That keeps ~100 scopes rather
// than ~375, and means a scope grant in the UI covers the same set of
// tables it covers internally.
//
// An earlier version exposed only one "primary" table per resource. That
// silently dropped tables and, for the `sprints` resource — which owns
// both `epics` and `sprints` — served epics at /api/v1/sprints. Hence one
// entry per table.
//
// SECURITY — read before changing anything here.
//
// The v1 routes authenticate with an API key, so there is no
// `auth.uid()` and therefore NO RLS: `requireApiKey` hands back a
// service-role client that can see every tenant's rows. Three rules keep
// that safe, and all three live in this file:
//
//   1. ALLOW-LIST ONLY. A request's path segment is looked up here and
//      rejected if absent. Without that, `/api/v1/<any_table>` would be a
//      read-write window onto the entire database.
//   2. EVERY query is constrained by `workspaceFilterColumn()`. A table
//      either carries `workspace_id` or reaches one through a FK; a table
//      with neither is not exposed. (Verified: all 32 parent-scoped
//      tables have a workspace-scoped parent.)
//   3. `workspace_id` on writes comes from the key, never the body.
//
// `api_keys` is deliberately NOT exposed: the rows hold key hashes, and
// an endpoint that can create them would let any key mint a
// broader-scoped successor — privilege escalation with extra steps.
// ============================================================

import { RESOURCES, type ModuleKey, type Resource } from '@/lib/auth/resources';

/** Resources withheld from the public API regardless of scope grants. */
// `team_members` is excluded because it has no tables to expose and
// because membership changes must go through the member APIs, which
// enforce seat limits and the rank rules — generic CRUD would not.
export const V1_EXCLUDED_RESOURCES = new Set<string>(['api_keys', 'team_members']);

export type V1Scoping =
  | { kind: 'workspace' }
  | { kind: 'parent'; parent: string; fk: string };

export interface V1Resource {
  /** URL segment: either a table name or a resource-key alias. */
  path: string;
  /** Scope prefix — the owning catalog resource's key. */
  scopeKey: string;
  module: ModuleKey;
  label: string;
  /** The table this path reads and writes. */
  table: string;
  scoping: V1Scoping;
  /** True when `path` is the resource-key alias rather than a table name. */
  isAlias: boolean;
  /**
   * Column that `/<path>/<id>` addresses, or null when the table has no
   * single-column key. Null means the item routes are unavailable and the
   * collection route is the only way in.
   */
  primaryKey: string | null;
}

/**
 * Tables whose single-row key is not `id`. Verified against the live
 * schema, which is the only authority here — `employee_profiles` genuinely
 * has no `id` column, it is keyed by the member it describes.
 */
const PRIMARY_KEY_OVERRIDES: Record<string, string> = {
  employee_profiles: 'workspace_member_id',
};

/**
 * Pure join tables with composite primary keys and no surrogate id. They
 * are listable and insertable but not addressable as `/<path>/<id>`.
 */
const COMPOSITE_KEY_TABLES = new Set<string>([
  'task_components',
  'task_labels',
  'task_watchers',
]);

function primaryKeyFor(table: string): string | null {
  if (COMPOSITE_KEY_TABLES.has(table)) return null;
  return PRIMARY_KEY_OVERRIDES[table] ?? 'id';
}

/**
 * The table a resource-key alias should point at: the one named after the
 * resource if there is one, else the workspace-scoped one, else the first.
 */
function primaryTable(resource: Resource) {
  return (
    resource.tables.find((t) => t.name === resource.key) ??
    resource.tables.find((t) => t.scope === 'workspace') ??
    resource.tables[0]
  );
}

function scopingOf(table: { scope: Resource['tables'][number]['scope'] }): V1Scoping {
  return table.scope === 'workspace'
    ? { kind: 'workspace' }
    : { kind: 'parent', parent: table.scope.parent, fk: table.scope.fk };
}

function buildRegistry(): Map<string, V1Resource> {
  const out = new Map<string, V1Resource>();

  // 1. One entry per table, keyed by the table's own name.
  for (const resource of RESOURCES) {
    if (V1_EXCLUDED_RESOURCES.has(resource.key)) continue;
    for (const table of resource.tables) {
      out.set(table.name, {
        path: table.name,
        scopeKey: resource.key,
        module: resource.module,
        label: resource.label,
        table: table.name,
        scoping: scopingOf(table),
        isAlias: false,
        primaryKey: primaryKeyFor(table.name),
      });
    }
  }

  // 2. A friendly alias per resource, where the key isn't already a table.
  for (const resource of RESOURCES) {
    if (V1_EXCLUDED_RESOURCES.has(resource.key)) continue;
    if (out.has(resource.key)) continue;
    const table = primaryTable(resource);
    if (!table) continue;
    out.set(resource.key, {
      path: resource.key,
      scopeKey: resource.key,
      module: resource.module,
      label: resource.label,
      table: table.name,
      scoping: scopingOf(table),
      isAlias: true,
      primaryKey: primaryKeyFor(table.name),
    });
  }

  return out;
}

const REGISTRY = buildRegistry();

/** Every path reachable at `/api/v1/<path>` — tables and aliases. */
export const V1_PATHS: readonly V1Resource[] = [...REGISTRY.values()];

/**
 * One entry per catalog resource, for generating scopes. Scopes are per
 * resource, not per path, so this is what `scopes.ts` iterates.
 */
export const V1_SCOPE_RESOURCES: readonly {
  key: string;
  label: string;
  module: ModuleKey;
}[] = RESOURCES.filter((r) => !V1_EXCLUDED_RESOURCES.has(r.key)).map((r) => ({
  key: r.key,
  label: r.label,
  module: r.module,
}));

/**
 * Resolve a URL segment to a resource, or null if it is not exposed.
 * Null MUST become a 404 — never fall through to a raw table name.
 */
export function findV1Resource(path: string): V1Resource | null {
  return REGISTRY.get(path) ?? null;
}

/**
 * The select string needed to constrain rows to one workspace.
 *
 * Parent-scoped tables need the parent embedded with `!inner` so the join
 * both filters and cannot be satisfied by a null FK; the caller pairs this
 * with `workspaceFilterColumn()`.
 */
export function scopedSelect(resource: V1Resource, columns = '*'): string {
  if (resource.scoping.kind === 'workspace') return columns;
  return `${columns}, ${resource.scoping.parent}!inner(workspace_id)`;
}

/** The column to match the caller's workspace id against. */
export function workspaceFilterColumn(resource: V1Resource): string {
  return resource.scoping.kind === 'workspace'
    ? 'workspace_id'
    : `${resource.scoping.parent}.workspace_id`;
}

/**
 * True when a row can be created by setting `workspace_id` directly.
 * Parent-scoped rows inherit their workspace from the parent, so the
 * caller must supply a valid parent FK instead — and the create handler
 * verifies that parent belongs to their workspace before inserting.
 */
export function ownsWorkspaceColumn(resource: V1Resource): boolean {
  return resource.scoping.kind === 'workspace';
}
