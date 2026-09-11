import { describe, it, expect, vi } from 'vitest';
import { pushDueReminders, BALANCE_REMINDER_NOTE, BANK_AUTO_SYNC_PREFS_KEY, type ReminderPushDeps } from '../../../api/_lib/reminder-push';
import { DEVICE_TIME_ZONE_KEY, PHONE_NOTIFICATION_PREFS_KEY } from '../../../src/services/push/prefs';
import { REMINDER_PREFS_KEY, REMINDER_STATE_KEY } from '../../../src/services/reminders/schedule';

/**
 * THE BALANCE REMINDER, PUSHED ONCE PER MOMENT — the server's memory of what
 * it already said, and the phone's zone deciding what "08:30" means.
 */

// 09:00 London on a Thursday in British Summer Time = 08:00 UTC.
const NOW = new Date('2026-09-10T08:00:00Z');

interface UserSetup {
  phone?: object;
  schedule?: object;
  state?: object;
  zone?: string;
  mark?: Date | null;
  /** Bank feed refresh mode; every user is 'cloud' unless a case says otherwise. */
  feedMode?: string;
}

function harness(users: Record<string, UserSetup>) {
  const pushed: string[] = [];
  const marks: Array<{ userId: string; for: string }> = [];
  const deps: ReminderPushDeps = {
    now: () => NOW,
    usersWithDevices: vi.fn(async () => Object.keys(users)),
    loadPreferences: vi.fn(async (ids: readonly string[]) => {
      const map = new Map<string, Record<string, string>>();
      for (const id of ids) {
        const u = users[id];
        const values: Record<string, string> = {};
        if (u.phone) values[PHONE_NOTIFICATION_PREFS_KEY] = JSON.stringify(u.phone);
        if (u.schedule) values[REMINDER_PREFS_KEY] = JSON.stringify(u.schedule);
        if (u.state) values[REMINDER_STATE_KEY] = JSON.stringify(u.state);
        if (u.zone) values[DEVICE_TIME_ZONE_KEY] = u.zone;
        values[BANK_AUTO_SYNC_PREFS_KEY] = JSON.stringify({ mode: u.feedMode ?? 'cloud', dailyTime: '08:00' });
        map.set(id, values);
      }
      return map;
    }),
    loadMarks: vi.fn(async (ids: readonly string[]) => new Map(ids.map((id) => [id, users[id].mark ?? null]))),
    notify: vi.fn(async (userId: string) => {
      pushed.push(userId);
      return { devices: 1, sent: 1, retired: 0, failed: 0 };
    }),
    mark: vi.fn(async (userId: string, scheduledFor: Date) => {
      marks.push({ userId, for: scheduledFor.toISOString() });
    }),
  };
  return { deps, pushed, marks };
}

const daily0830 = { schedule: 'daily', time: '08:30', weekday: 1, monthDay: 1 };
const acknowledgedYesterday = { lastAcknowledged: '2026-09-09T09:00:00Z' };

describe('pushDueReminders', () => {
  it('pushes a due reminder and marks the MOMENT it was for, in the phone\'s zone', async () => {
    const h = harness({ 'user-a': { phone: { balanceReminders: true }, schedule: daily0830, state: acknowledgedYesterday, zone: 'Europe/London' } });
    const summary = await pushDueReminders(h.deps);
    expect(h.pushed).toEqual(['user-a']);
    // 08:30 London in BST is 07:30 UTC.
    expect(h.marks).toEqual([{ userId: 'user-a', for: '2026-09-10T07:30:00.000Z' }]);
    expect(h.deps.notify).toHaveBeenCalledWith('user-a', BALANCE_REMINDER_NOTE);
    expect(summary).toMatchObject({ users: 1, due: 1, pushed: 1, sent: 1 });
  });

  it('the same moment is never announced twice, however often the cron runs', async () => {
    const h = harness({ 'user-a': { phone: { balanceReminders: true }, schedule: daily0830, state: acknowledgedYesterday, zone: 'Europe/London', mark: new Date('2026-09-10T07:30:00Z') } });
    const summary = await pushDueReminders(h.deps);
    expect(h.pushed).toEqual([]);
    expect(summary).toMatchObject({ due: 1, pushed: 0 });
  });

  it('the zone decides: 08:30 in New York has not happened yet at 08:00 UTC', async () => {
    const h = harness({ 'user-a': { phone: { balanceReminders: true }, schedule: daily0830, state: acknowledgedYesterday, zone: 'America/New_York' } });
    const summary = await pushDueReminders(h.deps);
    // Yesterday's 08:30 New York was acknowledged at 09:00Z? No — 08:30 EDT
    // is 12:30Z, after the acknowledgement, so yesterday's moment IS due.
    expect(h.marks).toEqual([{ userId: 'user-a', for: '2026-09-09T12:30:00.000Z' }]);
    expect(summary.pushed).toBe(1);
  });

  it('a phone that never said where it is gets no guess', async () => {
    const h = harness({ 'user-a': { phone: { balanceReminders: true }, schedule: daily0830, state: acknowledgedYesterday } });
    const summary = await pushDueReminders(h.deps);
    expect(h.pushed).toEqual([]);
    expect(summary.noTimeZone).toBe(1);
  });

  it('acknowledged in the app after the moment: nothing to push', async () => {
    const h = harness({ 'user-a': { phone: { balanceReminders: true }, schedule: daily0830, state: { lastAcknowledged: '2026-09-10T07:45:00Z' }, zone: 'Europe/London' } });
    const summary = await pushDueReminders(h.deps);
    expect(h.pushed).toEqual([]);
    expect(summary.due).toBe(0);
  });

  it('snoozed until tomorrow: quiet today', async () => {
    const h = harness({ 'user-a': { phone: { balanceReminders: true }, schedule: daily0830, state: { lastAcknowledged: '2026-09-08T09:00:00Z', snoozedUntil: '2026-09-11T07:30:00Z' }, zone: 'Europe/London' } });
    expect((await pushDueReminders(h.deps)).pushed).toBe(0);
  });

  it('the phone switch off, or no schedule, means no push even with a phone registered', async () => {
    const h = harness({
      'user-a': { phone: { balanceReminders: false }, schedule: daily0830, state: acknowledgedYesterday, zone: 'Europe/London' },
      'user-b': { phone: { balanceReminders: true }, schedule: { ...daily0830, schedule: 'off' }, state: acknowledgedYesterday, zone: 'Europe/London' },
      'user-c': { phone: { balanceReminders: true }, zone: 'Europe/London' },
    });
    const summary = await pushDueReminders(h.deps);
    expect(h.pushed).toEqual([]);
    expect(summary.users).toBe(3);
  });

  it('a switch left on by someone who is no longer in cloud mode goes quiet — the owner\'s ruling, kept server-side', async () => {
    const h = harness({
      'user-a': { phone: { balanceReminders: true }, schedule: daily0830, state: acknowledgedYesterday, zone: 'Europe/London', feedMode: 'signin' },
      'user-b': { phone: { balanceReminders: true }, schedule: daily0830, state: acknowledgedYesterday, zone: 'Europe/London', feedMode: 'cloud' },
    });
    const summary = await pushDueReminders(h.deps);
    expect(h.pushed).toEqual(['user-b']);
    expect(summary.notCloud).toBe(1);
  });

  it('marks BEFORE notifying, so a run that dies mid-push cannot repeat itself', async () => {
    const order: string[] = [];
    const h = harness({ 'user-a': { phone: { balanceReminders: true }, schedule: daily0830, state: acknowledgedYesterday, zone: 'Europe/London' } });
    h.deps.mark = vi.fn(async () => { order.push('mark'); });
    h.deps.notify = vi.fn(async () => { order.push('notify'); return { devices: 1, sent: 1, retired: 0, failed: 0 }; });
    await pushDueReminders(h.deps);
    expect(order).toEqual(['mark', 'notify']);
  });
});
