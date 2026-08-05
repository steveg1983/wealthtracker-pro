/**
 * The day maths behind every goal deadline.
 *
 * The bug these pin down: a goal due TODAY used to read "Overdue" from one
 * minute past midnight, because the old expression measured 24-hour blocks
 * from the current time rather than counting calendar days.
 */

import { describe, it, expect } from 'vitest';
import {
  daysUntil,
  formatDaysRemaining,
  isDeadlineUrgent,
  monthlyTargetToStayOnTrack,
  startOfLocalDay
} from './goalDates';
import { toDecimal } from './decimal';

const localDate = (year: number, month: number, day: number, hour = 0, minute = 0): Date =>
  new Date(year, month - 1, day, hour, minute);

describe('startOfLocalDay', () => {
  it('snaps to local midnight, keeping the calendar day', () => {
    const snapped = startOfLocalDay(localDate(2026, 8, 5, 23, 59));
    expect(snapped.getFullYear()).toBe(2026);
    expect(snapped.getMonth()).toBe(7);
    expect(snapped.getDate()).toBe(5);
    expect(snapped.getHours()).toBe(0);
    expect(snapped.getMinutes()).toBe(0);
  });
});

describe('daysUntil', () => {
  it('is 0 for a goal due today, whatever the time of day', () => {
    expect(daysUntil(localDate(2026, 8, 5), localDate(2026, 8, 5, 0, 1))).toBe(0);
    expect(daysUntil(localDate(2026, 8, 5), localDate(2026, 8, 5, 23, 59))).toBe(0);
    // The target carrying an end-of-day time must not read as tomorrow either.
    expect(daysUntil(localDate(2026, 8, 5, 23, 59), localDate(2026, 8, 5, 0, 1))).toBe(0);
  });

  it('counts calendar days forward, not 24-hour blocks', () => {
    // 23:59 today → tomorrow is one day away, even though it is 1 minute off.
    expect(daysUntil(localDate(2026, 8, 6), localDate(2026, 8, 5, 23, 59))).toBe(1);
    expect(daysUntil(localDate(2026, 12, 31), localDate(2026, 8, 5, 9, 30))).toBe(148);
  });

  it('goes negative once the date has passed', () => {
    expect(daysUntil(localDate(2026, 8, 4), localDate(2026, 8, 5, 0, 1))).toBe(-1);
    expect(daysUntil(localDate(2026, 7, 6), localDate(2026, 8, 5))).toBe(-30);
  });

  it('survives a DST boundary (British Summer Time ends 25 Oct 2026)', () => {
    // Three calendar days that contain a 25-hour day: the millisecond gap is
    // 3 days + 1 hour, which Math.ceil would report as 4.
    expect(daysUntil(localDate(2026, 10, 27), localDate(2026, 10, 24))).toBe(3);
  });

  it('returns NaN for an unreadable date rather than "due today"', () => {
    expect(daysUntil(new Date('not-a-date'), localDate(2026, 8, 5))).toBeNaN();
  });

  // Goals without a target date exist, and local-mode goals carry wire
  // strings — this crashed the Goals page rather than degrading.
  it('tolerates a missing target (NaN, never a throw)', () => {
    expect(daysUntil(undefined, localDate(2026, 8, 5))).toBeNaN();
    expect(daysUntil(null, localDate(2026, 8, 5))).toBeNaN();
  });

  it('accepts a wire-shaped string date', () => {
    expect(daysUntil('2026-08-08', localDate(2026, 8, 5))).toBe(3);
  });
});

describe('formatDaysRemaining', () => {
  it('says "Due today" on the day itself', () => {
    expect(formatDaysRemaining(0)).toBe('Due today');
  });

  it('singularises one day', () => {
    expect(formatDaysRemaining(1)).toBe('1 day left');
    expect(formatDaysRemaining(-1)).toBe('Overdue by 1 day');
  });

  it('pluralises everything else', () => {
    expect(formatDaysRemaining(12)).toBe('12 days left');
    expect(formatDaysRemaining(-12)).toBe('Overdue by 12 days');
  });

  it('does not invent a deadline for an unreadable date', () => {
    expect(formatDaysRemaining(Number.NaN)).toBe('No target date');
  });
});

describe('isDeadlineUrgent', () => {
  it('flags anything inside a month, including today and overdue', () => {
    expect(isDeadlineUrgent(29)).toBe(true);
    expect(isDeadlineUrgent(0)).toBe(true);
    expect(isDeadlineUrgent(-3)).toBe(true);
  });

  it('leaves distant and unreadable deadlines alone', () => {
    expect(isDeadlineUrgent(30)).toBe(false);
    expect(isDeadlineUrgent(Number.NaN)).toBe(false);
  });
});

describe('monthlyTargetToStayOnTrack', () => {
  const goal = (target: number, current: number, targetDate: Date) => ({
    targetAmount: toDecimal(target),
    currentAmount: toDecimal(current),
    targetDate
  });

  it('spreads what is left over the months that are actually left', () => {
    // 5 Aug 2026 → 31 Dec 2026 is 148 days = 4.8626… months, so the £7,500
    // still to find costs £1,542.41 a month.
    const monthly = monthlyTargetToStayOnTrack(
      goal(10000, 2500, localDate(2026, 12, 31)),
      localDate(2026, 8, 5)
    );
    expect(monthly).not.toBeNull();
    expect(monthly!.toDecimalPlaces(2).toNumber()).toBe(1542.41);
  });

  it('does not treat "the 1st of next month" as a whole month away', () => {
    // The calendar-month subtraction in calculateGoalMonthlyTarget calls both
    // of these "1 month"; only the day count can tell them apart.
    const oneDay = monthlyTargetToStayOnTrack(
      goal(1000, 0, localDate(2026, 2, 1)),
      localDate(2026, 1, 31)
    );
    const twoMonths = monthlyTargetToStayOnTrack(
      goal(1000, 0, localDate(2026, 3, 31)),
      localDate(2026, 1, 31)
    );

    expect(oneDay!.toNumber()).toBe(1000);
    expect(twoMonths!.toDecimalPlaces(2).toNumber()).toBeLessThan(600);
  });

  it('asks for the whole remainder when under a month is left', () => {
    const monthly = monthlyTargetToStayOnTrack(
      goal(1000, 400, localDate(2026, 8, 20)),
      localDate(2026, 8, 5)
    );
    expect(monthly!.toNumber()).toBe(600);
  });

  it('asks for the whole remainder when the date has passed', () => {
    const monthly = monthlyTargetToStayOnTrack(
      goal(1000, 400, localDate(2026, 7, 1)),
      localDate(2026, 8, 5)
    );
    expect(monthly!.toNumber()).toBe(600);
  });

  it('returns null once the goal is met or beaten (no "£0/month" advice)', () => {
    expect(monthlyTargetToStayOnTrack(goal(1000, 1000, localDate(2026, 12, 31)), localDate(2026, 8, 5))).toBeNull();
    expect(monthlyTargetToStayOnTrack(goal(1000, 1500, localDate(2026, 12, 31)), localDate(2026, 8, 5))).toBeNull();
  });

  it('returns null when the target date cannot be read', () => {
    expect(monthlyTargetToStayOnTrack(goal(1000, 0, new Date('nope')), localDate(2026, 8, 5))).toBeNull();
  });

  it('keeps the arithmetic exact (no floating-point drift)', () => {
    // 0.1 + 0.2 territory: 100.10 - 0.30 must be 99.80 to the penny.
    const monthly = monthlyTargetToStayOnTrack(
      goal(100.1, 0.3, localDate(2026, 8, 20)),
      localDate(2026, 8, 5)
    );
    expect(monthly!.toString()).toBe('99.8');
  });
});
