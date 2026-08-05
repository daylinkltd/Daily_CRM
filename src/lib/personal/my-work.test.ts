import { describe, expect, it } from 'vitest';

import {
  dueBucket,
  toLocalDateString,
  partitionSections,
  countOutstanding,
  type WorkSection,
} from './my-work';

const section = (key: string, itemCount: number): WorkSection => ({
  key,
  label: key,
  module: 'Projects',
  total: itemCount,
  items: Array.from({ length: itemCount }, (_, i) => ({
    id: `${key}-${i}`,
    title: `Item ${i}`,
    href: '/',
  })),
  emptyHint: 'nothing',
});

describe('toLocalDateString', () => {
  it('uses the local calendar date, not the UTC one', () => {
    // 23:30 local on the 6th. toISOString() would report the 7th for any
    // timezone east of UTC, silently shifting every due date by a day.
    const late = new Date(2026, 7, 6, 23, 30, 0);
    expect(toLocalDateString(late)).toBe('2026-08-06');
  });

  it('zero-pads month and day', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('dueBucket', () => {
  // Mid-morning so the test does not depend on the runner's timezone.
  const today = new Date(2026, 7, 6, 10, 0, 0);

  it('returns none when there is no due date', () => {
    expect(dueBucket(null, today)).toBe('none');
    expect(dueBucket(undefined, today)).toBe('none');
    expect(dueBucket('', today)).toBe('none');
  });

  it('treats work due today as today, not overdue', () => {
    // The bug this guards: comparing a bare date string as an instant makes
    // "due today" sort as overdue for most of the day east of UTC.
    expect(dueBucket('2026-08-06', today)).toBe('today');
  });

  it('detects overdue', () => {
    expect(dueBucket('2026-08-05', today)).toBe('overdue');
    expect(dueBucket('2025-01-01', today)).toBe('overdue');
  });

  it('buckets the next seven days as soon, and beyond as later', () => {
    expect(dueBucket('2026-08-07', today)).toBe('soon');
    expect(dueBucket('2026-08-13', today)).toBe('soon');
    expect(dueBucket('2026-08-14', today)).toBe('later');
  });

  it('accepts a full timestamp and reads only the date part', () => {
    expect(dueBucket('2026-08-06T18:45:00.000Z', today)).toBe('today');
  });

  it('handles a month boundary', () => {
    const endOfMonth = new Date(2026, 7, 31, 9, 0, 0);
    expect(dueBucket('2026-09-01', endOfMonth)).toBe('soon');
    expect(dueBucket('2026-08-30', endOfMonth)).toBe('overdue');
  });
});

describe('partitionSections', () => {
  it('splits sections that have items from those that do not', () => {
    const sections = [section('a', 2), section('b', 0), section('c', 1)];
    const { active, empty } = partitionSections(sections);
    expect(active.map((s) => s.key)).toEqual(['a', 'c']);
    expect(empty.map((s) => s.key)).toEqual(['b']);
  });

  it('copes with no sections at all', () => {
    expect(partitionSections([])).toEqual({ active: [], empty: [] });
  });
});

describe('countOutstanding', () => {
  it('sums the items actually shown, not the reported totals', () => {
    // `total` can exceed items.length because each section is capped; the
    // header count must match what the user can see.
    const capped: WorkSection = { ...section('a', 3), total: 99 };
    expect(countOutstanding([capped, section('b', 2)])).toBe(5);
  });

  it('is zero for an empty board', () => {
    expect(countOutstanding([])).toBe(0);
    expect(countOutstanding([section('a', 0)])).toBe(0);
  });
});
