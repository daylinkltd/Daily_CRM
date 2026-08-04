import { describe, expect, it } from 'vitest';

import { RESOURCES, MODULE_KEYS } from '@/lib/auth/resources';
import {
  V1_PATHS,
  V1_SCOPE_RESOURCES,
  V1_EXCLUDED_RESOURCES,
  findV1Resource,
  scopedSelect,
  workspaceFilterColumn,
  ownsWorkspaceColumn,
} from './resource-registry';

describe('v1 resource registry', () => {
  it('exposes every catalog table except the excluded resources', () => {
    const expected = RESOURCES.filter(
      (r) => !V1_EXCLUDED_RESOURCES.has(r.key)
    ).flatMap((r) => r.tables.map((t) => t.name));

    const tablePaths = V1_PATHS.filter((p) => !p.isAlias).map((p) => p.table);
    expect(new Set(tablePaths)).toEqual(new Set(expected));
  });

  it('covers all five modules, so no module is unreachable', () => {
    const covered = new Set(V1_PATHS.map((r) => r.module));
    // Not `module` as the loop variable — Next forbids assigning to it.
    for (const moduleKey of MODULE_KEYS) expect(covered).toContain(moduleKey);
  });

  // The whole point of the allow-list: the handlers run on a service-role
  // client, so an unresolved segment must never reach `.from()`.
  it('refuses paths that are not in the catalog', () => {
    expect(findV1Resource('workspace_members')).toBeNull();
    expect(findV1Resource('profiles')).toBeNull();
    expect(findV1Resource('workspaces')).toBeNull();
    expect(findV1Resource('')).toBeNull();
    expect(findV1Resource('../secrets')).toBeNull();
  });

  it('never exposes api_keys — a key could otherwise mint a broader one', () => {
    expect(findV1Resource('api_keys')).toBeNull();
    expect(V1_PATHS.some((r) => r.table === 'api_keys')).toBe(false);
    expect(V1_SCOPE_RESOURCES.some((r) => r.key === 'api_keys')).toBe(false);
  });

  it('gives every exposed path a workspace constraint', () => {
    for (const r of V1_PATHS) {
      expect(r.scoping.kind === 'workspace' || r.scoping.kind === 'parent').toBe(
        true
      );
      expect(workspaceFilterColumn(r)).toBeTruthy();
    }
  });

  it('filters workspace-scoped tables on their own column', () => {
    const cycles = findV1Resource('payroll_cycles');
    expect(cycles?.table).toBe('payroll_cycles');
    expect(workspaceFilterColumn(cycles!)).toBe('workspace_id');
    expect(scopedSelect(cycles!)).toBe('*');
    expect(ownsWorkspaceColumn(cycles!)).toBe(true);
  });

  it('reaches a parent for tables with no workspace_id of their own', () => {
    const comments = findV1Resource('task_comments');
    expect(comments!.scoping).toEqual({
      kind: 'parent',
      parent: 'tasks',
      fk: 'task_id',
    });
    expect(scopedSelect(comments!)).toBe('*, tasks!inner(workspace_id)');
    expect(workspaceFilterColumn(comments!)).toBe('tasks.workspace_id');
    // Must NOT set workspace_id directly — the column doesn't exist there.
    expect(ownsWorkspaceColumn(comments!)).toBe(false);
  });

  it('uses !inner for parent joins so a null FK cannot slip through', () => {
    for (const r of V1_PATHS) {
      if (r.scoping.kind === 'parent') {
        expect(scopedSelect(r)).toContain('!inner');
      }
    }
  });

  // Regression: an earlier registry kept one "primary" table per resource
  // and picked tables[0]. The `sprints` resource lists epics first, so
  // /api/v1/sprints served EPICS and the sprints table was unreachable.
  it('serves each sibling table of a multi-table resource at its own path', () => {
    const sprints = findV1Resource('sprints');
    const epics = findV1Resource('epics');

    expect(sprints!.table).toBe('sprints');
    expect(epics!.table).toBe('epics');

    // Both belong to the `sprints` resource, so both are gated by its scope
    // — exactly as the RLS policies gate them.
    expect(sprints!.scopeKey).toBe('sprints');
    expect(epics!.scopeKey).toBe('sprints');
  });

  it('maps a resource-key alias onto that resource own table', () => {
    // `payroll` is not a table name; it aliases payroll_cycles.
    const alias = findV1Resource('payroll');
    expect(alias!.isAlias).toBe(true);
    expect(alias!.table).toBe('payroll_cycles');
    expect(alias!.scopeKey).toBe('payroll');

    // `employees` aliases employee_profiles (hr_employees is dormant).
    expect(findV1Resource('employees')!.table).toBe('employee_profiles');
  });

  it('never points an alias at another resource table', () => {
    for (const r of V1_PATHS) {
      if (!r.isAlias) continue;
      const owner = RESOURCES.find((res) => res.key === r.scopeKey);
      expect(owner!.tables.map((t) => t.name)).toContain(r.table);
    }
  });

  // Verified against the live schema: these four tables have no `id`, so a
  // hardcoded .eq('id', …) in the item routes would have failed on them.
  it('addresses employee_profiles by workspace_member_id, since it has no id', () => {
    expect(findV1Resource('employee_profiles')!.primaryKey).toBe(
      'workspace_member_id'
    );
    // The `employees` alias points at the same table, so same key.
    expect(findV1Resource('employees')!.primaryKey).toBe('workspace_member_id');
  });

  it('marks composite-key join tables as not addressable by a single id', () => {
    for (const table of ['task_components', 'task_labels', 'task_watchers']) {
      expect(findV1Resource(table)!.primaryKey).toBeNull();
    }
  });

  it('defaults every other table to id', () => {
    expect(findV1Resource('tasks')!.primaryKey).toBe('id');
    expect(findV1Resource('payroll_cycles')!.primaryKey).toBe('id');
    expect(findV1Resource('sprints')!.primaryKey).toBe('id');
  });

  it('has one entry per path, with no duplicates', () => {
    const paths = V1_PATHS.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('gives every path a scope key that exists in the scope list', () => {
    const keys = new Set(V1_SCOPE_RESOURCES.map((r) => r.key));
    for (const r of V1_PATHS) expect(keys).toContain(r.scopeKey);
  });
});
