/**
 * The reminder arithmetic, pinned — every rule the card and the settings rely
 * on, asked of the pure functions rather than through a render. Storage-facing
 * helpers are exercised against the real preferences mirror the app uses.
 *
 * Every date below is invented; this repo is public.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_REMINDER_PREFS,
  loadReminderPrefs,
  loadReminderState,
  mostRecentScheduledMoment,
  reminderDue,
  saveReminderPrefs,
  snoozeReminderUntilTomorrow,
  type BalanceReminderPrefs,
} from './balanceReminders';
import { preferences } from '../services/preferencesService';

const prefs = (over: Partial<BalanceReminderPrefs> = {}): BalanceReminderPrefs => ({
  ...DEFAULT_REMINDER_PREFS,
  schedule: 'daily',
  time: '08:30',
  ...over,
});

// A Wednesday. Time components written explicitly so the arithmetic is
// legible next to the assertions.
const at = (day: number, hh: number, mm: number, month = 5): Date =>
  new Date(2026, month, day, hh, mm);

describe('mostRecentScheduledMoment', () => {
  it('is null when the schedule is off — no timers, no moments, no card', () => {
    expect(mostRecentScheduledMoment(prefs({ schedule: 'off' }), at(10, 9, 0))).toBeNull();
  });

  it("daily: today's moment once passed, yesterday's before it", () => {
    expect(mostRecentScheduledMoment(prefs(), at(10, 9, 0))).toEqual(at(10, 8, 30));
    expect(mostRecentScheduledMoment(prefs(), at(10, 8, 0))).toEqual(at(9, 8, 30));
  });

  it("weekly: the chosen weekday's moment, reaching back across the week", () => {
    const monday = prefs({ schedule: 'weekly', weekday: 1 });
    // Wednesday 10 June 2026 → the Monday just gone is the 8th.
    expect(mostRecentScheduledMoment(monday, at(10, 9, 0))).toEqual(at(8, 8, 30));
    // On the Monday itself, before the time: the Monday BEFORE.
    expect(mostRecentScheduledMoment(monday, at(8, 8, 0))).toEqual(at(1, 8, 30));
  });

  it("monthly: this month's day once passed, last month's before it", () => {
    const first = prefs({ schedule: 'monthly', monthDay: 1 });
    expect(mostRecentScheduledMoment(first, at(10, 9, 0))).toEqual(at(1, 8, 30));
    expect(mostRecentScheduledMoment(first, at(1, 8, 0))).toEqual(at(1, 8, 30, 4));
  });

  it('monthly clamps to the 28th, so February means what July means', () => {
    const clamped = prefs({ schedule: 'monthly', monthDay: 31 as number });
    // March, after the 28th: the moment is the 28th of March, not a phantom
    // 31st that slid into April.
    expect(mostRecentScheduledMoment(clamped, new Date(2026, 2, 30, 9, 0)))
      .toEqual(new Date(2026, 2, 28, 8, 30));
  });
});

describe('reminderDue', () => {
  it('due once the moment passes unacknowledged — a closed app catches up on open', () => {
    const state = { lastAcknowledged: at(9, 9, 0), snoozedUntil: null };
    expect(reminderDue(prefs(), state, at(10, 8, 29))).toBe(false);
    expect(reminderDue(prefs(), state, at(10, 8, 31))).toBe(true);
    // Hours later, still unacknowledged, still due: catching up IS the point.
    expect(reminderDue(prefs(), state, at(10, 23, 0))).toBe(true);
  });

  it('acknowledging settles it until the next moment', () => {
    const done = { lastAcknowledged: at(10, 9, 0), snoozedUntil: null };
    expect(reminderDue(prefs(), done, at(10, 23, 0))).toBe(false);
    expect(reminderDue(prefs(), done, at(11, 8, 31))).toBe(true);
  });

  it('a snooze is quiet until it expires, and the job is still owed after', () => {
    const snoozed = { lastAcknowledged: at(9, 9, 0), snoozedUntil: at(11, 8, 30) };
    expect(reminderDue(prefs(), snoozed, at(10, 12, 0))).toBe(false);
    expect(reminderDue(prefs(), snoozed, at(11, 8, 31))).toBe(true);
  });

  it('never-acknowledged is due from the first moment — the save-time stamp is what prevents "immediately"', () => {
    const fresh = { lastAcknowledged: null, snoozedUntil: null };
    expect(reminderDue(prefs(), fresh, at(10, 9, 0))).toBe(true);
  });
});

describe('the stored halves', () => {
  beforeEach(() => {
    preferences.removeItem('balanceReminders.prefs.v1');
    preferences.removeItem('balanceReminders.state.v1');
  });

  it('round-trips the schedule, and saving acknowledges NOW so the first reminder is the next moment', () => {
    const saved = prefs({ schedule: 'weekly', weekday: 5, time: '18:00' });
    saveReminderPrefs(saved, at(10, 9, 0));

    expect(loadReminderPrefs()).toEqual(saved);
    const state = loadReminderState();
    expect(state.lastAcknowledged).toEqual(at(10, 9, 0));
    expect(state.snoozedUntil).toBeNull();
    // Turning reminders on must not nag about a moment the user was present
    // and deciding at.
    expect(reminderDue(saved, state, at(10, 9, 1))).toBe(false);
  });

  it('snoozing means literally tomorrow at the scheduled time, whatever the schedule', () => {
    const weekly = prefs({ schedule: 'weekly', weekday: 1, time: '08:30' });
    saveReminderPrefs(weekly, at(1, 9, 0));
    snoozeReminderUntilTomorrow(weekly, at(10, 12, 0));

    expect(loadReminderState().snoozedUntil).toEqual(at(11, 8, 30));
  });

  it('unreadable storage falls back to defaults rather than a broken schedule', () => {
    preferences.setItem('balanceReminders.prefs.v1', 'not json');
    expect(loadReminderPrefs()).toEqual(DEFAULT_REMINDER_PREFS);
    preferences.setItem('balanceReminders.state.v1', '{"lastAcknowledged":"garbage"}');
    expect(loadReminderState()).toEqual({ lastAcknowledged: null, snoozedUntil: null });
  });
});
