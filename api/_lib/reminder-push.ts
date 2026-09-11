import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseReminderSchedule,
  parseReminderState,
  reminderDueInZone,
  REMINDER_PREFS_KEY,
  REMINDER_STATE_KEY
} from '../../src/services/reminders/schedule.js';
import {
  parseDeviceTimeZone,
  parsePhoneNotificationPrefs,
  DEVICE_TIME_ZONE_KEY,
  PHONE_NOTIFICATION_PREFS_KEY
} from '../../src/services/push/prefs.js';
import { loadPreferenceValues, notifyUser, pushDeps, usersWithEnabledDevices, type NotifyOutcome, type PushNote } from './push.js';

/**
 * The balance reminder, delivered to the lock screen.
 *
 * The in-app card (components/BalanceReminderCard) asks once a minute while
 * the app is open: "has the most recent scheduled moment passed without an
 * acknowledgement?" This asks the same question every quarter-hour on the
 * server, for every user with a phone listening, and pushes once per moment
 * — the server's memory of which moment it last announced
 * (push_notification_marks.balance_reminder_notified_for) is what "once"
 * means, since the cron runs many times between two moments.
 *
 * The answer to "due?" is the same function the card uses
 * (services/reminders/schedule.ts), given the phone's zone: a reminder set
 * for 08:30 is 08:30 where the person is, not in the data centre. A user
 * whose zone was never recorded is skipped and counted, never guessed.
 *
 * Tapping the push opens the app, where the card is waiting with its three
 * answers — the push is the nudge, the card is the acknowledgement, and the
 * two never disagree because they read one state.
 */

export interface ReminderPushDeps {
  now: () => Date;
  usersWithDevices: () => Promise<string[]>;
  loadPreferences: (userIds: readonly string[]) => Promise<Map<string, Record<string, string>>>;
  loadMarks: (userIds: readonly string[]) => Promise<Map<string, Date | null>>;
  notify: (userId: string, note: PushNote) => Promise<NotifyOutcome>;
  mark: (userId: string, scheduledFor: Date) => Promise<void>;
}

export interface ReminderPushSummary {
  users: number;
  /** Asked for the push, and a moment was due. */
  due: number;
  /** Due, and not yet announced for that moment. */
  pushed: number;
  /** Asked for the push, but the phone never said where it is. */
  noTimeZone: number;
  sent: number;
  retired: number;
  failed: number;
}

export const BALANCE_REMINDER_NOTE: PushNote = {
  title: 'Time to update your account balances',
  body: 'Your scheduled reminder — bring any balances the app cannot see up to date.',
  url: '/accounts',
  collapseId: 'balance-reminder',
  threadId: 'balance-reminder'
};

export const pushDueReminders = async (deps: ReminderPushDeps): Promise<ReminderPushSummary> => {
  const now = deps.now();
  const users = await deps.usersWithDevices();
  const summary: ReminderPushSummary = { users: users.length, due: 0, pushed: 0, noTimeZone: 0, sent: 0, retired: 0, failed: 0 };
  if (users.length === 0) return summary;

  const [preferences, marks] = await Promise.all([deps.loadPreferences(users), deps.loadMarks(users)]);

  for (const userId of users) {
    const values = preferences.get(userId);
    if (!values) continue;
    if (!parsePhoneNotificationPrefs(values[PHONE_NOTIFICATION_PREFS_KEY]).balanceReminders) continue;

    const schedule = parseReminderSchedule(values[REMINDER_PREFS_KEY]);
    if (schedule.schedule === 'off') continue;

    const timeZone = parseDeviceTimeZone(values[DEVICE_TIME_ZONE_KEY]);
    if (timeZone === null) {
      summary.noTimeZone += 1;
      continue;
    }

    const scheduled = reminderDueInZone(schedule, parseReminderState(values[REMINDER_STATE_KEY]), now, timeZone);
    if (scheduled === null) continue;
    summary.due += 1;

    const announced = marks.get(userId) ?? null;
    if (announced !== null && announced >= scheduled) continue;

    // Mark BEFORE sending, so a run that dies mid-push cannot re-announce the
    // same moment on its next pass. A push that fails is the next moment's
    // to say again; the cron's log has the failure.
    await deps.mark(userId, scheduled);
    const outcome = await deps.notify(userId, BALANCE_REMINDER_NOTE);
    summary.pushed += 1;
    summary.sent += outcome.sent;
    summary.retired += outcome.retired;
    summary.failed += outcome.failed;
  }

  return summary;
};

/** The verbs bound to Supabase and Apple, or null when APNs is not configured. */
export const reminderPushDeps = (supabase: SupabaseClient): ReminderPushDeps | null => {
  const push = pushDeps(supabase);
  if (!push) return null;
  return {
    now: () => new Date(),
    usersWithDevices: () => usersWithEnabledDevices(supabase),
    loadPreferences: (userIds) => loadPreferenceValues(supabase, userIds),
    loadMarks: async (userIds) => {
      const marks = new Map<string, Date | null>();
      if (userIds.length === 0) return marks;
      const { data, error } = await supabase
        .from('push_notification_marks')
        .select('user_id, balance_reminder_notified_for')
        .in('user_id', [...userIds]);
      if (error) throw new Error(`Failed to load push marks: ${error.message}`);
      for (const row of (data ?? []) as Array<{ user_id: string; balance_reminder_notified_for: string | null }>) {
        marks.set(row.user_id, row.balance_reminder_notified_for ? new Date(row.balance_reminder_notified_for) : null);
      }
      return marks;
    },
    notify: (userId, note) => notifyUser(push, userId, note),
    mark: async (userId, scheduledFor) => {
      const { error } = await supabase
        .from('push_notification_marks')
        .upsert(
          { user_id: userId, balance_reminder_notified_for: scheduledFor.toISOString() },
          { onConflict: 'user_id' }
        );
      if (error) throw new Error(`Failed to record the reminder push: ${error.message}`);
    }
  };
};
