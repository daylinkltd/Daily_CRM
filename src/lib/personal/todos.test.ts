import { describe, expect, it } from 'vitest';

import {
  sortTodos,
  countTodos,
  needsAttention,
  notePreview,
  sortNotes,
  isInternalHref,
  normalizeBookmarkHref,
  isOpen,
  type PersonalTodo,
  type PersonalNote,
  type TodoPriority,
} from './todos';

const TODAY = new Date(2026, 7, 6, 10, 0, 0); // 6 Aug 2026, local

function todo(over: Partial<PersonalTodo> & { id: string }): PersonalTodo {
  return {
    workspace_id: 'w',
    workspace_member_id: 'm',
    title: over.id,
    notes: null,
    priority: 'MEDIUM' as TodoPriority,
    due_date: null,
    remind_at: null,
    completed_at: null,
    sort_order: 0,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over,
  };
}

describe('isOpen', () => {
  it('is open only while completed_at is null', () => {
    expect(isOpen(todo({ id: 'a' }))).toBe(true);
    expect(isOpen(todo({ id: 'b', completed_at: '2026-08-05T09:00:00Z' }))).toBe(false);
  });
});

describe('sortTodos', () => {
  it('puts overdue first, then due today, then future, then undated', () => {
    const sorted = sortTodos(
      [
        todo({ id: 'undated' }),
        todo({ id: 'later', due_date: '2026-12-01' }),
        todo({ id: 'today', due_date: '2026-08-06' }),
        todo({ id: 'overdue', due_date: '2026-08-01' }),
      ],
      TODAY,
    );
    expect(sorted.map((t) => t.id)).toEqual(['overdue', 'today', 'later', 'undated']);
  });

  it('breaks ties on priority', () => {
    const sorted = sortTodos(
      [
        todo({ id: 'low', due_date: '2026-08-06', priority: 'LOW' }),
        todo({ id: 'high', due_date: '2026-08-06', priority: 'HIGH' }),
        todo({ id: 'med', due_date: '2026-08-06', priority: 'MEDIUM' }),
      ],
      TODAY,
    );
    expect(sorted.map((t) => t.id)).toEqual(['high', 'med', 'low']);
  });

  it('falls back to manual order then age, so the list is stable', () => {
    const sorted = sortTodos(
      [
        todo({ id: 'second', sort_order: 2 }),
        todo({ id: 'first', sort_order: 1 }),
        todo({ id: 'older', sort_order: 1, created_at: '2026-07-01T00:00:00Z' }),
      ],
      TODAY,
    );
    expect(sorted.map((t) => t.id)).toEqual(['older', 'first', 'second']);
  });

  it('does not mutate its input', () => {
    const input = [todo({ id: 'b', due_date: '2026-12-01' }), todo({ id: 'a', due_date: '2026-08-01' })];
    const order = input.map((t) => t.id);
    sortTodos(input, TODAY);
    expect(input.map((t) => t.id)).toEqual(order);
  });
});

describe('countTodos', () => {
  it('counts open, overdue, due today and completed', () => {
    const counts = countTodos(
      [
        todo({ id: 'a', due_date: '2026-08-01' }),
        todo({ id: 'b', due_date: '2026-08-06' }),
        todo({ id: 'c' }),
        todo({ id: 'd', completed_at: '2026-08-05T00:00:00Z' }),
      ],
      TODAY,
    );
    expect(counts).toEqual({ open: 3, overdue: 1, dueToday: 1, completed: 1 });
  });

  it('never counts a completed item as overdue, however old', () => {
    const counts = countTodos(
      [todo({ id: 'done', due_date: '2020-01-01', completed_at: '2026-08-05T00:00:00Z' })],
      TODAY,
    );
    expect(counts).toEqual({ open: 0, overdue: 0, dueToday: 0, completed: 1 });
  });
});

describe('needsAttention', () => {
  it('returns only open items that are overdue or due today, in order', () => {
    const items = needsAttention(
      [
        todo({ id: 'future', due_date: '2026-09-01' }),
        todo({ id: 'today', due_date: '2026-08-06' }),
        todo({ id: 'late', due_date: '2026-07-30' }),
        todo({ id: 'undated' }),
        todo({ id: 'done', due_date: '2026-07-01', completed_at: '2026-08-01T00:00:00Z' }),
      ],
      TODAY,
    );
    expect(items.map((t) => t.id)).toEqual(['late', 'today']);
  });
});

describe('notePreview', () => {
  it('strips tags and collapses whitespace', () => {
    expect(notePreview('<p>Hello   <strong>world</strong></p>')).toBe('Hello world');
  });

  it('keeps words apart across block boundaries', () => {
    // Without the block-to-space step this would read "OneTwo".
    expect(notePreview('<p>One</p><p>Two</p>')).toBe('One Two');
    expect(notePreview('One<br>Two')).toBe('One Two');
  });

  it('decodes the common entities', () => {
    expect(notePreview('<p>Tom &amp; Jerry&nbsp;show</p>')).toBe('Tom & Jerry show');
  });

  it('truncates with an ellipsis', () => {
    expect(notePreview('<p>' + 'a'.repeat(50) + '</p>', 10)).toBe('aaaaaaaaa…');
  });

  it('returns empty string for an empty note', () => {
    expect(notePreview('')).toBe('');
    expect(notePreview('<p></p>')).toBe('');
  });
});

describe('sortNotes', () => {
  const note = (id: string, pinned: boolean, updated: string): PersonalNote => ({
    id,
    workspace_id: 'w',
    workspace_member_id: 'm',
    title: id,
    body_html: '',
    is_pinned: pinned,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: updated,
  });

  it('puts pinned notes first, then most recently edited', () => {
    const sorted = sortNotes([
      note('old', false, '2026-01-01T00:00:00Z'),
      note('recent', false, '2026-08-01T00:00:00Z'),
      note('pinned-old', true, '2026-02-01T00:00:00Z'),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(['pinned-old', 'recent', 'old']);
  });
});

describe('isInternalHref', () => {
  it('accepts app paths and rejects protocol-relative URLs', () => {
    expect(isInternalHref('/invoices/1')).toBe(true);
    // '//evil.com' is external despite the leading slash.
    expect(isInternalHref('//evil.com')).toBe(false);
    expect(isInternalHref('https://example.com')).toBe(false);
  });
});

describe('normalizeBookmarkHref', () => {
  it('keeps app paths and absolute URLs as-is', () => {
    expect(normalizeBookmarkHref('/tasks')).toBe('/tasks');
    expect(normalizeBookmarkHref('https://example.com/a')).toBe('https://example.com/a');
    expect(normalizeBookmarkHref('http://example.com')).toBe('http://example.com');
  });

  it('adds https:// to a bare domain', () => {
    // Without a scheme the browser treats it as a relative path and the
    // link 404s inside the app.
    expect(normalizeBookmarkHref('example.com')).toBe('https://example.com');
    expect(normalizeBookmarkHref('docs.example.co.uk/guide')).toBe(
      'https://docs.example.co.uk/guide',
    );
  });

  it('rejects script-bearing schemes — these are rendered as anchors', () => {
    expect(normalizeBookmarkHref('javascript:alert(1)')).toBeNull();
    expect(normalizeBookmarkHref('JavaScript:alert(1)')).toBeNull();
    expect(normalizeBookmarkHref('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(normalizeBookmarkHref('vbscript:msgbox')).toBeNull();
  });

  it('rejects blank and unrecognisable input', () => {
    expect(normalizeBookmarkHref('')).toBeNull();
    expect(normalizeBookmarkHref('   ')).toBeNull();
    expect(normalizeBookmarkHref('not a url')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeBookmarkHref('  /tasks  ')).toBe('/tasks');
  });
});
