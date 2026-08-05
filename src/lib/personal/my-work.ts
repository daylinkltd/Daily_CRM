// ============================================================
// "My Work" — everything assigned to one member, across every module.
//
// THE TRAP THIS FILE EXISTS TO CONTAIN: assignment is not keyed
// consistently across the schema. Three different identities are used,
// and picking the wrong one returns an empty list with no error — the
// failure mode that hides broken features in this codebase.
//
//   workspace_members.id  tasks.assigned_workspace_member_id
//                         projects.manager_workspace_member_id
//                         project_members.workspace_member_id
//                         task_watchers.workspace_member_id
//                         hr_employee_requests.assigned_to_employee_id
//                             (repointed to workspace_members by 079,
//                              despite the _employee_id name)
//                         hr_policy_acknowledgements.workspace_member_id
//                         employee_profiles.manager_workspace_member_id
//
//   auth.users.id         conversations.assigned_agent_id
//                             (bare UUID, no FK; the inbox writes
//                              p.user_id — message-thread.tsx)
//
//   profiles.id           deals.assigned_to
//                             (FK to profiles, added in migration 002)
//
// DELIBERATELY EXCLUDED: hr_approval_steps.approver_employee_id and
// hr_performance_reviews.reviewer_employee_id still reference
// `hr_employees`, which is dormant and holds zero rows. A section built
// on them could never show anything, so showing an always-empty
// "Approvals" card would be worse than omitting it. Repoint those FKs to
// workspace_members (as 079 did for requests) and they can be added here.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

/** The identities needed to resolve every assignment source. */
export interface WorkerIdentity {
  workspaceId: string;
  /** workspace_members.id */
  memberId: string;
  /** auth.users.id */
  userId: string | null;
  /** profiles.id — null when the member has no profile row. */
  profileId: string | null;
}

export interface WorkItem {
  id: string;
  title: string;
  /** Secondary line: project name, contact, request type… */
  subtitle?: string | null;
  href: string;
  dueDate?: string | null;
  badge?: string | null;
}

export interface WorkSection {
  key: string;
  label: string;
  /** Which module this work came from, for the section chip. */
  module: string;
  items: WorkItem[];
  /** Total matching rows, which may exceed `items.length`. */
  total: number;
  emptyHint: string;
}

/** Cap per section — this is a dashboard, not a report. */
const SECTION_LIMIT = 8;

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
/** PostgREST returns an embedded to-one as an object, or an array in some shapes. */
function embedded(row: Row, key: string): Row | null {
  const v = row[key];
  if (Array.isArray(v)) return (v[0] as Row) ?? null;
  return v && typeof v === 'object' ? (v as Row) : null;
}

/**
 * Load every section. Each source is queried independently and a failure
 * in one degrades that section only — a missing table on an older
 * database must not blank the whole page.
 */
export async function loadMyWork(
  supabase: SupabaseClient,
  identity: WorkerIdentity,
): Promise<WorkSection[]> {
  const { workspaceId, memberId, userId, profileId } = identity;

  const settled = await Promise.allSettled([
    // ---- Projects module -------------------------------------------
    (async (): Promise<WorkSection> => {
      const { data, count } = await supabase
        .from('tasks')
        .select(
          'id, title, due_date, priority, project_id, projects(name), project_statuses(category)',
          { count: 'exact' },
        )
        .eq('workspace_id', workspaceId)
        .eq('assigned_workspace_member_id', memberId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(SECTION_LIMIT);

      // Completed work is still "assigned" but is not outstanding, so it
      // is filtered here rather than in SQL — status lives on the
      // embedded project_statuses.category, not on tasks.
      const rows = (data ?? []).filter(
        (r) => embedded(r as Row, 'project_statuses')?.category !== 'DONE',
      );

      return {
        key: 'tasks',
        label: 'Tasks assigned to me',
        module: 'Projects',
        total: count ?? rows.length,
        items: rows.map((r) => {
          const row = r as Row;
          return {
            id: String(row.id),
            title: str(row.title) ?? 'Untitled task',
            subtitle: embedded(row, 'projects')?.name
              ? String(embedded(row, 'projects')!.name)
              : null,
            href: `/tasks?task=${row.id}`,
            dueDate: str(row.due_date),
            badge: str(row.priority),
          };
        }),
        emptyHint: 'Nothing assigned to you right now.',
      };
    })(),

    (async (): Promise<WorkSection> => {
      const { data, count } = await supabase
        .from('projects')
        .select('id, name, status, deadline', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .eq('manager_workspace_member_id', memberId)
        .limit(SECTION_LIMIT);

      return {
        key: 'projects_managed',
        label: 'Projects I manage',
        module: 'Projects',
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as Row;
          return {
            id: String(row.id),
            title: str(row.name) ?? 'Untitled project',
            href: `/projects/${row.id}`,
            dueDate: str(row.deadline),
            badge: str(row.status),
          };
        }),
        emptyHint: 'You are not the manager on any project.',
      };
    })(),

    (async (): Promise<WorkSection> => {
      const { data, count } = await supabase
        .from('project_members')
        .select('id, role, project_id, projects!inner(name, status, workspace_id)', {
          count: 'exact',
        })
        .eq('workspace_member_id', memberId)
        // project_members has no workspace_id of its own.
        .eq('projects.workspace_id', workspaceId)
        .limit(SECTION_LIMIT);

      return {
        key: 'project_memberships',
        label: 'Projects I am on',
        module: 'Projects',
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as Row;
          const project = embedded(row, 'projects');
          return {
            id: String(row.id),
            title: project?.name ? String(project.name) : 'Project',
            subtitle: str(row.role),
            href: `/projects/${row.project_id}`,
            badge: project?.status ? String(project.status) : null,
          };
        }),
        emptyHint: 'You have not been added to a project team.',
      };
    })(),

    (async (): Promise<WorkSection> => {
      const { data, count } = await supabase
        .from('task_watchers')
        .select('task_id, tasks!inner(title, due_date, workspace_id)', { count: 'exact' })
        .eq('workspace_member_id', memberId)
        .eq('tasks.workspace_id', workspaceId)
        .limit(SECTION_LIMIT);

      return {
        key: 'watching',
        label: 'Tasks I am watching',
        module: 'Projects',
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as Row;
          const task = embedded(row, 'tasks');
          return {
            id: String(row.task_id),
            title: task?.title ? String(task.title) : 'Task',
            href: `/tasks?task=${row.task_id}`,
            dueDate: task?.due_date ? String(task.due_date) : null,
          };
        }),
        emptyHint: 'You are not watching any tasks.',
      };
    })(),

    // ---- CRM ------------------------------------------------------
    (async (): Promise<WorkSection> => {
      // Keyed by auth user id, NOT workspace_members.id.
      const empty: WorkSection = {
        key: 'conversations',
        label: 'Conversations assigned to me',
        module: 'CRM',
        total: 0,
        items: [],
        emptyHint: 'No chats are assigned to you.',
      };
      if (!userId) return empty;

      const { data, count } = await supabase
        .from('conversations')
        .select('id, last_message_text, last_message_at, unread_count, contacts(name, phone)', {
          count: 'exact',
        })
        .eq('workspace_id', workspaceId)
        .eq('assigned_agent_id', userId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(SECTION_LIMIT);

      return {
        ...empty,
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as Row;
          const contact = embedded(row, 'contacts');
          const unread = Number(row.unread_count ?? 0);
          return {
            id: String(row.id),
            title:
              (contact?.name ? String(contact.name) : null) ??
              (contact?.phone ? String(contact.phone) : null) ??
              'Conversation',
            subtitle: str(row.last_message_text),
            href: `/inbox?conversation=${row.id}`,
            badge: unread > 0 ? `${unread} unread` : null,
          };
        }),
      };
    })(),

    (async (): Promise<WorkSection> => {
      // Keyed by profiles.id, NOT workspace_members.id (migration 002).
      const empty: WorkSection = {
        key: 'deals',
        label: 'Deals assigned to me',
        module: 'CRM',
        total: 0,
        items: [],
        emptyHint: 'No deals are assigned to you.',
      };
      if (!profileId) return empty;

      const { data, count } = await supabase
        .from('deals')
        .select('id, title, value, currency, status, expected_close_date', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .eq('assigned_to', profileId)
        .limit(SECTION_LIMIT);

      return {
        ...empty,
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as Row;
          return {
            id: String(row.id),
            title: str(row.title) ?? 'Deal',
            href: `/pipelines?deal=${row.id}`,
            dueDate: str(row.expected_close_date),
            badge: str(row.status),
          };
        }),
      };
    })(),

    // ---- HR (routed to me as a colleague, not as an employee) -----
    (async (): Promise<WorkSection> => {
      const { data, count } = await supabase
        .from('hr_employee_requests')
        .select('id, request_type, status, created_at', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .eq('assigned_to_employee_id', memberId)
        .neq('status', 'RESOLVED')
        .limit(SECTION_LIMIT);

      return {
        key: 'hr_requests',
        label: 'Requests routed to me',
        module: 'HR',
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as Row;
          return {
            id: String(row.id),
            title: str(row.request_type) ?? 'Request',
            href: '/requests',
            badge: str(row.status),
          };
        }),
        emptyHint: 'No requests are waiting on you.',
      };
    })(),

    (async (): Promise<WorkSection> => {
      const { data, count } = await supabase
        .from('employee_profiles')
        .select('workspace_member_id, employee_code, designation_id', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .eq('manager_workspace_member_id', memberId)
        .limit(SECTION_LIMIT);

      return {
        key: 'direct_reports',
        label: 'My direct reports',
        module: 'HR',
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as Row;
          return {
            id: String(row.workspace_member_id),
            title: str(row.employee_code) ?? 'Team member',
            href: `/employees/${row.workspace_member_id}`,
          };
        }),
        emptyHint: 'Nobody reports to you.',
      };
    })(),

    (async (): Promise<WorkSection> => {
      // Policies I still need to sign off.
      const { data, count } = await supabase
        .from('hr_policy_acknowledgements')
        .select('id, policy_id, version_number, status, hr_policies(title)', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .eq('workspace_member_id', memberId)
        .is('acknowledged_at', null)
        .limit(SECTION_LIMIT);

      return {
        key: 'policy_acks',
        label: 'Policies awaiting my acknowledgement',
        module: 'HR',
        total: count ?? 0,
        items: (data ?? []).map((r) => {
          const row = r as Row;
          const policy = embedded(row, 'hr_policies');
          return {
            id: String(row.id),
            title: policy?.title ? String(policy.title) : 'Policy',
            subtitle: row.version_number ? `Version ${row.version_number}` : null,
            href: '/policies',
            badge: str(row.status),
          };
        }),
        emptyHint: 'You are up to date on policies.',
      };
    })(),
  ]);

  // A rejected source yields no section rather than taking the page down.
  return settled
    .filter(
      (r): r is PromiseFulfilledResult<WorkSection> => r.status === 'fulfilled',
    )
    .map((r) => r.value);
}

// ------------------------------------------------------------------
// Pure helpers — unit tested.
// ------------------------------------------------------------------

export type DueBucket = 'overdue' | 'today' | 'soon' | 'later' | 'none';

/**
 * Classify a date string relative to `today`.
 *
 * Compared as calendar dates in the caller's own timezone, never as
 * instants: `new Date('2026-08-06') < new Date()` is true for most of
 * 2026-08-06 in any timezone east of UTC, which would mark work due today
 * as already overdue.
 */
export function dueBucket(
  dueDate: string | null | undefined,
  today = new Date(),
): DueBucket {
  if (!dueDate) return 'none';
  const due = dueDate.slice(0, 10);
  const ref = toLocalDateString(today);
  if (due < ref) return 'overdue';
  if (due === ref) return 'today';

  const soon = new Date(today);
  soon.setDate(soon.getDate() + 7);
  return due <= toLocalDateString(soon) ? 'soon' : 'later';
}

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the day. */
export function toLocalDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Sections with nothing in them, so the UI can collapse or hide them. */
export function partitionSections(sections: WorkSection[]) {
  return {
    active: sections.filter((s) => s.items.length > 0),
    empty: sections.filter((s) => s.items.length === 0),
  };
}

/** Total outstanding items across every section — the header count. */
export function countOutstanding(sections: WorkSection[]): number {
  return sections.reduce((sum, s) => sum + s.items.length, 0);
}
