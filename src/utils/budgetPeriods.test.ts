import { describe, it, expect } from 'vitest';
import {
  getBudgetPeriodLabel,
  getBudgetPeriodWindow,
  normaliseBudgetPeriod
} from './budgetPeriods';

/** Local date, written the way the windows are built. */
const at = (year: number, month: number, day: number, hour = 12): Date =>
  new Date(year, month, day, hour, 0, 0, 0);

/** "2026-08-01 00:00:00.000" — readable enough to assert a boundary on. */
const stamp = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ` +
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:` +
  `${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;

describe('normaliseBudgetPeriod', () => {
  it('reads every period the app writes', () => {
    expect(normaliseBudgetPeriod('weekly')).toBe('weekly');
    expect(normaliseBudgetPeriod('quarterly')).toBe('quarterly');
    expect(normaliseBudgetPeriod('yearly')).toBe('yearly');
    expect(normaliseBudgetPeriod('custom')).toBe('custom');
  });

  it('accepts the spellings other parts of the app use for a fortnight', () => {
    expect(normaliseBudgetPeriod('biweekly')).toBe('biweekly');
    expect(normaliseBudgetPeriod('bi-weekly')).toBe('biweekly');
    expect(normaliseBudgetPeriod('Fortnightly')).toBe('biweekly');
  });

  // The old fallback was YEARLY, which is exactly how a week's allowance came
  // to be compared against a year of spending.
  it('falls back to monthly, never to yearly', () => {
    expect(normaliseBudgetPeriod(undefined)).toBe('monthly');
    expect(normaliseBudgetPeriod('')).toBe('monthly');
    expect(normaliseBudgetPeriod('per sennight')).toBe('monthly');
  });
});

describe('getBudgetPeriodLabel', () => {
  it('captions each period as itself', () => {
    expect(getBudgetPeriodLabel('monthly')).toBe('Monthly');
    expect(getBudgetPeriodLabel('weekly')).toBe('Weekly');
    expect(getBudgetPeriodLabel('biweekly')).toBe('Fortnightly');
    expect(getBudgetPeriodLabel('quarterly')).toBe('Quarterly');
    expect(getBudgetPeriodLabel('yearly')).toBe('Yearly');
    expect(getBudgetPeriodLabel('custom')).toBe('Custom');
  });
});

describe('getBudgetPeriodWindow', () => {
  it('measures a monthly budget over the calendar month, to the last millisecond', () => {
    const window = getBudgetPeriodWindow({ period: 'monthly' }, at(2026, 7, 15));

    expect(stamp(window.start)).toBe('2026-08-01 00:00:00.000');
    // The old end was local midnight of the 31st, which dropped the whole of
    // the last day for any row timestamped after it.
    expect(stamp(window.end)).toBe('2026-08-31 23:59:59.999');
    expect(window.label).toBe('Monthly');
  });

  it('measures a weekly budget over the current week', () => {
    // Wednesday 12 August 2026.
    const window = getBudgetPeriodWindow({ period: 'weekly' }, at(2026, 7, 12));

    expect(stamp(window.start)).toBe('2026-08-09 00:00:00.000');
    expect(stamp(window.end)).toBe('2026-08-15 23:59:59.999');
    expect(window.label).toBe('Weekly');
  });

  it('measures a quarterly budget over the calendar quarter', () => {
    const window = getBudgetPeriodWindow({ period: 'quarterly' }, at(2026, 7, 15));

    expect(stamp(window.start)).toBe('2026-07-01 00:00:00.000');
    expect(stamp(window.end)).toBe('2026-09-30 23:59:59.999');
    expect(window.label).toBe('Quarterly');
  });

  it('measures a yearly budget over the calendar year', () => {
    const window = getBudgetPeriodWindow({ period: 'yearly' }, at(2026, 7, 15));

    expect(stamp(window.start)).toBe('2026-01-01 00:00:00.000');
    expect(stamp(window.end)).toBe('2026-12-31 23:59:59.999');
  });

  describe('fortnightly', () => {
    it('counts fortnights from the budget’s own start date', () => {
      // 15 August is 28 days (two whole fortnights) after 18 July.
      const window = getBudgetPeriodWindow(
        { period: 'biweekly', startDate: '2026-07-18' },
        at(2026, 7, 15)
      );

      expect(stamp(window.start)).toBe('2026-08-15 00:00:00.000');
      expect(stamp(window.end)).toBe('2026-08-28 23:59:59.999');
      expect(window.label).toBe('Fortnightly');
    });

    it('falls back to the day the budget was created', () => {
      const window = getBudgetPeriodWindow(
        { period: 'biweekly', createdAt: new Date(2026, 6, 18) },
        at(2026, 7, 14)
      );

      expect(stamp(window.start)).toBe('2026-08-01 00:00:00.000');
      expect(stamp(window.end)).toBe('2026-08-14 23:59:59.999');
    });

    it('gives a budget that has not started yet its FIRST fortnight', () => {
      const window = getBudgetPeriodWindow(
        { period: 'biweekly', startDate: '2026-09-01' },
        at(2026, 7, 15)
      );

      expect(stamp(window.start)).toBe('2026-09-01 00:00:00.000');
      expect(stamp(window.end)).toBe('2026-09-14 23:59:59.999');
    });
  });

  describe('custom', () => {
    it('uses the stored start and end dates', () => {
      const window = getBudgetPeriodWindow(
        { period: 'custom', startDate: '2026-04-06', endDate: '2027-04-05' },
        at(2026, 7, 15)
      );

      expect(stamp(window.start)).toBe('2026-04-06 00:00:00.000');
      expect(stamp(window.end)).toBe('2027-04-05 23:59:59.999');
      expect(window.label).toBe('Custom');
    });

    it('runs an open-ended custom period up to now', () => {
      const window = getBudgetPeriodWindow(
        { period: 'custom', startDate: '2026-04-06' },
        at(2026, 7, 15)
      );

      expect(stamp(window.start)).toBe('2026-04-06 00:00:00.000');
      expect(stamp(window.end)).toBe('2026-08-15 23:59:59.999');
    });

    it('falls back to the current month when the dates are missing, still captioned Custom', () => {
      const window = getBudgetPeriodWindow({ period: 'custom' }, at(2026, 7, 15));

      expect(stamp(window.start)).toBe('2026-08-01 00:00:00.000');
      expect(stamp(window.end)).toBe('2026-08-31 23:59:59.999');
      expect(window.label).toBe('Custom');
    });

    it('ignores an unreadable stored date rather than filing the budget in 1970', () => {
      const window = getBudgetPeriodWindow(
        { period: 'custom', startDate: 'not a date' },
        at(2026, 7, 15)
      );

      expect(stamp(window.start)).toBe('2026-08-01 00:00:00.000');
    });
  });
});
