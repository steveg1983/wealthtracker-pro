import { describe, it, expect } from 'vitest';
import { buildPlWindow, bucketIndexOf, dayOf } from './plWindow';

/**
 * The P&L's windows, pinned on FIXED dates — the boundaries are the law:
 *
 *  - "last 12 months" holds no current part month (owner, 19 Aug);
 *  - the calendar year is the last FULL one;
 *  - the tax year runs 6 April to 5 April, in HMRC tax months (6th–5th),
 *    and is only offered once it is COMPLETE — on 5 April the year ends
 *    that very day and is not yet whole;
 *  - a custom range is whole calendar months, reversed inputs swapped.
 */

const AUG_19_2026 = new Date(2026, 7, 19);

describe('buildPlWindow', () => {
  it('last-12: the twelve complete months, the current part month left out', () => {
    const window = buildPlWindow('last-12', AUG_19_2026);
    expect(window.buckets).toHaveLength(12);
    expect(window.start).toBe('2025-08-01');
    expect(window.endExclusive).toBe('2026-08-01');
    expect(window.label).toBe('August 2025 to July 2026');
    // 19 Aug 2026 itself is outside — the part month would understate.
    expect(bucketIndexOf('2026-08-19', window.buckets)).toBe(-1);
    expect(bucketIndexOf('2026-07-31', window.buckets)).toBe(11);
  });

  it('calendar-year: the last full calendar year', () => {
    const window = buildPlWindow('calendar-year', AUG_19_2026);
    expect(window.start).toBe('2025-01-01');
    expect(window.endExclusive).toBe('2026-01-01');
    expect(window.label).toBe('January 2025 to December 2025');
    expect(window.buckets[0].label).toBe('Jan 25');
  });

  it('tax-year: 6 April to 5 April, in tax months that run 6th to 5th', () => {
    const window = buildPlWindow('tax-year', AUG_19_2026);
    expect(window.label).toBe('6 April 2025 to 5 April 2026');
    expect(window.buckets).toHaveLength(12);
    expect(window.buckets[0]).toMatchObject({ start: '2025-04-06', endExclusive: '2025-05-06', label: 'Apr 25' });
    expect(window.buckets[11]).toMatchObject({ start: '2026-03-06', endExclusive: '2026-04-06' });
    // The 5th belongs to the OLD tax month, the 6th to the new — both edges.
    expect(bucketIndexOf('2025-04-05', window.buckets)).toBe(-1);
    expect(bucketIndexOf('2025-04-06', window.buckets)).toBe(0);
    expect(bucketIndexOf('2025-05-05', window.buckets)).toBe(0);
    expect(bucketIndexOf('2025-05-06', window.buckets)).toBe(1);
    expect(bucketIndexOf('2026-04-05', window.buckets)).toBe(11);
    expect(bucketIndexOf('2026-04-06', window.buckets)).toBe(-1);
  });

  it('a tax year is only offered once it is complete', () => {
    // 5 April 2026: 2025/26 ends TODAY — not yet whole, so 2024/25 stands.
    expect(buildPlWindow('tax-year', new Date(2026, 3, 5)).start).toBe('2024-04-06');
    // 6 April 2026: 2025/26 completed yesterday.
    expect(buildPlWindow('tax-year', new Date(2026, 3, 6)).start).toBe('2025-04-06');
  });

  it('custom: whole calendar months, inclusive, reversed inputs swapped', () => {
    const window = buildPlWindow('custom', AUG_19_2026, { fromMonth: '2024-11', toMonth: '2025-02' });
    expect(window.buckets).toHaveLength(4);
    expect(window.start).toBe('2024-11-01');
    expect(window.endExclusive).toBe('2025-03-01');
    expect(window.label).toBe('November 2024 to February 2025');

    const swapped = buildPlWindow('custom', AUG_19_2026, { fromMonth: '2025-02', toMonth: '2024-11' });
    expect(swapped.start).toBe('2024-11-01');

    const single = buildPlWindow('custom', AUG_19_2026, { fromMonth: '2025-06', toMonth: '2025-06' });
    expect(single.buckets).toHaveLength(1);
    expect(single.label).toBe('June 2025');
  });

  it('custom without a stated range falls back to the last twelve months', () => {
    const window = buildPlWindow('custom', AUG_19_2026, { fromMonth: '', toMonth: '' });
    expect(window.start).toBe('2025-08-01');
    expect(window.buckets).toHaveLength(12);
  });

  it('the year wraps cleanly inside a window', () => {
    const window = buildPlWindow('last-12', new Date(2027, 1, 7));
    expect(window.start).toBe('2026-02-01');
    expect(bucketIndexOf('2026-12-31', window.buckets)).toBe(10);
    expect(bucketIndexOf('2027-01-01', window.buckets)).toBe(11);
  });
});

describe('dayOf', () => {
  it('slices a string and never parses it — the timezone cannot move the day', () => {
    expect(dayOf('2027-02-07')).toBe('2027-02-07');
    expect(dayOf('2027-02-07T23:30:00Z')).toBe('2027-02-07');
  });

  it('reads a Date object as its local day', () => {
    expect(dayOf(new Date(2027, 1, 7))).toBe('2027-02-07');
  });
});
