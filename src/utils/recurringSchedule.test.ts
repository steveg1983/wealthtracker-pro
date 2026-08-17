import { describe, it, expect } from 'vitest';
import { toDecimal } from './decimal';
import { projectRecurringSchedule } from './recurringSchedule';
import type { RecurringDetection } from './recurringDetection';

/**
 * The forward schedule's honesty rules: it steps each pattern's OWN rhythm,
 * projects nothing from a stopped pattern, and folds a late payment onto the
 * window's first day exactly once. Every figure invented — the repo is public.
 */

const D = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);

const detection = (over: Partial<RecurringDetection>): RecurringDetection => ({
  key: 'acc-1::out::synthetic',
  description: 'SYNTHETIC CLUB',
  payeeKey: 'synthetic club',
  accountId: 'acc-1',
  direction: 'out',
  cadence: 'monthly',
  cadenceLabel: 'monthly',
  amount: toDecimal(9.99),
  annualEquivalent: toDecimal(119.88),
  count: 6,
  firstDate: D(2026, 3, 1),
  lastDate: D(2026, 8, 1),
  nextExpected: D(2026, 9, 1),
  stopped: false,
  priceChange: null,
  medianIntervalDays: 30,
  ...over,
});

describe('projectRecurringSchedule', () => {
  it('steps each pattern by its own observed rhythm, inside the window only', () => {
    const weekly = detection({
      key: 'w', cadence: 'weekly', cadenceLabel: 'weekly',
      medianIntervalDays: 7, nextExpected: D(2026, 9, 2),
    });
    const due = projectRecurringSchedule([weekly], D(2026, 9, 1), D(2026, 9, 30));

    expect(due.map(o => o.date.getDate())).toEqual([2, 9, 16, 23, 30]);
    expect(due.every(o => o.amount.toNumber() === 9.99)).toBe(true);
  });

  it('a stopped pattern has nothing due', () => {
    const stopped = detection({ stopped: true, nextExpected: null });
    expect(projectRecurringSchedule([stopped], D(2026, 9, 1), D(2026, 9, 30))).toHaveLength(0);
  });

  it('a late payment lands on the window start once, then the rhythm resumes', () => {
    // Expected 25 Aug, window opens 1 Sep: overdue, not yet stopped.
    const late = detection({ nextExpected: D(2026, 8, 25), medianIntervalDays: 30 });
    const due = projectRecurringSchedule([late], D(2026, 9, 1), D(2026, 10, 31));

    // Once on the first day (the overdue), then 24 Sep and 24 Oct — never a
    // phantom occurrence per missed rhythm.
    expect(due.map(o => `${o.date.getDate()}/${o.date.getMonth() + 1}`))
      .toEqual(['1/9', '24/9', '24/10']);
  });

  it('orders a mixed schedule by date', () => {
    const monthly = detection({ key: 'm', nextExpected: D(2026, 9, 15) });
    const weekly = detection({
      key: 'w', cadence: 'weekly', cadenceLabel: 'weekly',
      medianIntervalDays: 7, nextExpected: D(2026, 9, 4), amount: toDecimal(5),
    });
    const due = projectRecurringSchedule([weekly, monthly], D(2026, 9, 1), D(2026, 9, 20));

    expect(due.map(o => o.date.getDate())).toEqual([4, 11, 15, 18]);
  });

  it('an empty or inverted window projects nothing', () => {
    expect(projectRecurringSchedule([detection({})], D(2026, 9, 30), D(2026, 9, 1))).toHaveLength(0);
  });
});
