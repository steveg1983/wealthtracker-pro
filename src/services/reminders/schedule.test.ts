import { describe, it, expect } from 'vitest';
import {
  instantOfWallClock,
  mostRecentScheduledMomentInZone,
  parseReminderSchedule,
  parseReminderState,
  reminderDueInZone,
  wallClockIn,
  hostTimeZone,
  type ReminderSchedulePrefs,
} from './schedule';

/**
 * The reminder's arithmetic in a named zone. utils/balanceReminders.test.ts
 * pins the same rules in the host's zone through the browser-side wrapper;
 * these pin the zone itself — the thing a server has and a page never needed.
 */

const daily = (time = '08:30'): ReminderSchedulePrefs => ({ schedule: 'daily', time, weekday: 1, monthDay: 1 });
const weekly = (weekday: number): ReminderSchedulePrefs => ({ schedule: 'weekly', time: '08:30', weekday, monthDay: 1 });
const monthly = (monthDay: number): ReminderSchedulePrefs => ({ schedule: 'monthly', time: '08:30', weekday: 1, monthDay });

describe('a wall clock in a zone', () => {
  it('reads London in summer an hour ahead of UTC, and New York five behind', () => {
    const instant = new Date('2026-09-10T08:00:00Z');
    expect(wallClockIn('Europe/London', instant)).toMatchObject({ year: 2026, month: 9, day: 10, weekday: 4, hour: 9, minute: 0 });
    expect(wallClockIn('America/New_York', instant)).toMatchObject({ day: 10, hour: 4, minute: 0 });
  });

  it('turns a wall-clock time back into the instant, both sides of a clock change', () => {
    // BST: 08:30 London = 07:30Z.
    expect(instantOfWallClock('Europe/London', { year: 2026, month: 9, day: 10, hour: 8, minute: 30 }).toISOString()).toBe('2026-09-10T07:30:00.000Z');
    // GMT: 08:30 London = 08:30Z.
    expect(instantOfWallClock('Europe/London', { year: 2026, month: 12, day: 10, hour: 8, minute: 30 }).toISOString()).toBe('2026-12-10T08:30:00.000Z');
    // Auckland, NZDT in December: 08:30 = 19:30Z the previous day.
    expect(instantOfWallClock('Pacific/Auckland', { year: 2026, month: 12, day: 10, hour: 8, minute: 30 }).toISOString()).toBe('2026-12-09T19:30:00.000Z');
  });

  it('a time the spring clock change skips lands an hour later, as an alarm clock does', () => {
    // 29 March 2026, 01:30 does not exist in London (01:00 → 02:00).
    const instant = instantOfWallClock('Europe/London', { year: 2026, month: 3, day: 29, hour: 1, minute: 30 });
    expect(wallClockIn('Europe/London', instant)).toMatchObject({ day: 29, hour: 2, minute: 30 });
  });
});

describe('mostRecentScheduledMomentInZone', () => {
  it("daily: today's moment once passed, yesterday's before it — in the zone", () => {
    const now = new Date('2026-09-10T08:00:00Z'); // 09:00 London, 04:00 New York
    expect(mostRecentScheduledMomentInZone(daily(), now, 'Europe/London')?.toISOString()).toBe('2026-09-10T07:30:00.000Z');
    expect(mostRecentScheduledMomentInZone(daily(), now, 'America/New_York')?.toISOString()).toBe('2026-09-09T12:30:00.000Z');
  });

  it("weekly: the chosen weekday's moment, reaching back across the week", () => {
    const thursday = new Date('2026-09-10T08:00:00Z');
    // Monday 7 Sep 08:30 London.
    expect(mostRecentScheduledMomentInZone(weekly(1), thursday, 'Europe/London')?.toISOString()).toBe('2026-09-07T07:30:00.000Z');
    // Thursday itself, once 08:30 has passed.
    expect(mostRecentScheduledMomentInZone(weekly(4), thursday, 'Europe/London')?.toISOString()).toBe('2026-09-10T07:30:00.000Z');
    // Friday: last week's.
    expect(mostRecentScheduledMomentInZone(weekly(5), thursday, 'Europe/London')?.toISOString()).toBe('2026-09-04T07:30:00.000Z');
  });

  it("monthly: this month's day once passed, last month's before it, across a year end", () => {
    const now = new Date('2026-01-05T12:00:00Z');
    expect(mostRecentScheduledMomentInZone(monthly(1), now, 'Europe/London')?.toISOString()).toBe('2026-01-01T08:30:00.000Z');
    expect(mostRecentScheduledMomentInZone(monthly(20), now, 'Europe/London')?.toISOString()).toBe('2025-12-20T08:30:00.000Z');
  });

  it('is null when off', () => {
    expect(mostRecentScheduledMomentInZone({ ...daily(), schedule: 'off' }, new Date(), 'Europe/London')).toBeNull();
  });
});

describe('reminderDueInZone', () => {
  const now = new Date('2026-09-10T08:00:00Z');
  it('answers with the due moment, or null', () => {
    expect(reminderDueInZone(daily(), { lastAcknowledged: new Date('2026-09-09T09:00:00Z'), snoozedUntil: null }, now, 'Europe/London')?.toISOString()).toBe('2026-09-10T07:30:00.000Z');
    expect(reminderDueInZone(daily(), { lastAcknowledged: new Date('2026-09-10T07:45:00Z'), snoozedUntil: null }, now, 'Europe/London')).toBeNull();
    expect(reminderDueInZone(daily(), { lastAcknowledged: null, snoozedUntil: new Date('2026-09-11T07:30:00Z') }, now, 'Europe/London')).toBeNull();
  });
});

describe('the stored halves, parsed without a browser', () => {
  it('schedule: the exact string the settings page writes', () => {
    expect(parseReminderSchedule('{"schedule":"weekly","time":"07:15","weekday":5,"monthDay":1}')).toEqual({ schedule: 'weekly', time: '07:15', weekday: 5, monthDay: 1 });
    expect(parseReminderSchedule('{"schedule":"monthly","monthDay":31}').monthDay).toBe(28);
    expect(parseReminderSchedule('{not json').schedule).toBe('off');
    expect(parseReminderSchedule(undefined).schedule).toBe('off');
  });

  it('state: two dates, or none', () => {
    expect(parseReminderState('{"lastAcknowledged":"2026-09-09T09:00:00.000Z"}')).toEqual({ lastAcknowledged: new Date('2026-09-09T09:00:00Z'), snoozedUntil: null });
    expect(parseReminderState('garbage')).toEqual({ lastAcknowledged: null, snoozedUntil: null });
  });

  it('the host zone is a real one', () => {
    expect(() => new Intl.DateTimeFormat('en-GB', { timeZone: hostTimeZone() })).not.toThrow();
  });
});
