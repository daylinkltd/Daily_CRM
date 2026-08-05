// ============================================================
// Personal to-dos and notes — shapes and pure helpers.
//
// These rows are private to one member (owner-only RLS, migration 098).
// They are NOT in the RBAC resource catalog, so no workspace permission
// gates them: being a member is the entitlement. See the migration header
// for why, and why to-dos are deliberately not assignable to anyone else.
// ============================================================

import { dueBucket, type DueBucket } from './my-work';

export const TODO_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export interface PersonalTodo {
  id: string;
  workspace_id: string;
  workspace_member_id: string;
  title: string;
  notes: string | null;
  priority: TodoPriority;
  due_date: string | null;
  remind_at: string | null;
  /** Null while open; a timestamp once ticked off. */
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PersonalNote {
  id: string;
  workspace_id: string;
  workspace_member_id: string;
  title: string;
  body_html: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface PersonalBookmark {
  id: string;
  workspace_id: string;
  workspace_member_id: string;
  label: string;
  href: string;
  sort_order: number;
  created_at: string;
}

export const isOpen = (t: PersonalTodo): boolean => t.completed_at === null;

/** Rank used for ordering: overdue first, then today, then dated, then undated. */
const BUCKET_RANK: Record<DueBucket, number> = {
  overdue: 0,
  today: 1,
  soon: 2,
  later: 3,
  none: 4,
};

const PRIORITY_RANK: Record<TodoPriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

/**
 * Order open to-dos the way someone actually works a list: what is late,
 * then what is due now, then by priority. Undated items sink to the bottom
 * rather than disappearing — an undated to-do is still a to-do.
 *
 * Returns a new array; the input is not mutated.
 */
export function sortTodos(todos: PersonalTodo[], today = new Date()): PersonalTodo[] {
  return [...todos].sort((a, b) => {
    const bucketDiff =
      BUCKET_RANK[dueBucket(a.due_date, today)] - BUCKET_RANK[dueBucket(b.due_date, today)];
    if (bucketDiff !== 0) return bucketDiff;

    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Same urgency and priority: respect the member's manual ordering, then
    // fall back to age so the list is stable across reloads.
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });
}

export interface TodoCounts {
  open: number;
  overdue: number;
  dueToday: number;
  completed: number;
}

/** Header counts. Completed items are counted but never called overdue. */
export function countTodos(todos: PersonalTodo[], today = new Date()): TodoCounts {
  const counts: TodoCounts = { open: 0, overdue: 0, dueToday: 0, completed: 0 };

  for (const todo of todos) {
    if (!isOpen(todo)) {
      counts.completed++;
      continue;
    }
    counts.open++;
    const bucket = dueBucket(todo.due_date, today);
    if (bucket === 'overdue') counts.overdue++;
    if (bucket === 'today') counts.dueToday++;
  }

  return counts;
}

/**
 * The subset worth interrupting someone about: open, and either already
 * late or due today. Used for the My Work banner.
 */
export function needsAttention(todos: PersonalTodo[], today = new Date()): PersonalTodo[] {
  return sortTodos(
    todos.filter((t) => {
      if (!isOpen(t)) return false;
      const bucket = dueBucket(t.due_date, today);
      return bucket === 'overdue' || bucket === 'today';
    }),
    today,
  );
}

/**
 * First line of a note's HTML, as plain text, for list previews.
 *
 * Tags are stripped rather than rendered: a list row must not inherit the
 * note's own formatting, and injecting stored HTML into a preview would
 * defeat the point of sanitising it on the way in.
 */
export function notePreview(bodyHtml: string, maxLength = 140): string {
  const text = bodyHtml
    // Turn block boundaries into spaces so words don't run together.
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

/** Pinned notes first, then most recently edited. */
export function sortNotes(notes: PersonalNote[]): PersonalNote[] {
  return [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

/** True for an in-app path, which should navigate rather than open a tab. */
export function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

/**
 * Normalise what someone typed into a usable href.
 *
 * A bare `example.com` becomes `https://example.com` — without a scheme the
 * browser resolves it as a relative path and the link 404s inside the app.
 * `javascript:` and `data:` are rejected outright: these are rendered as
 * anchors, so accepting them would be a stored-XSS vector.
 */
export function normalizeBookmarkHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (isInternalHref(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$|\?|#)/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}
