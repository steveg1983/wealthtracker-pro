/**
 * Balance-update reminders: the preference, its storage, and the one decision
 * that matters — "is a reminder due right now?".
 *
 * The owner (29 Aug 2026), from an idea he liked in another app: optional
 * reminders to update account balances — and NOT buried in a notifications
 * bell. "Something needs to pop up on the screen, whatever page you are on."
 * The card that does that popping is BalanceReminderCard, mounted in Layout;
 * the schedule lives in Settings → App Settings, under the bank feed refresh,
 * whose shape (pure decision under test, prefs in the preferences document,
 * honest catch-up-on-open semantics) this deliberately mirrors — see
 * utils/bankAutoSync, the sibling this is modelled on.
 *
 * ── WHERE THE VALUES LIVE, AND WHY BOTH TRAVEL ──────────────────────────────
 * The PREFERENCE belongs to the user, so it goes in the preferences document.
 * So does the ACKNOWLEDGEMENT — and this is where reminders differ from the
 * bank sync, whose last-run is per-device because it records what THIS browser
 * did. A reminder acknowledged on the desktop is a job done for the ACCOUNT:
 * the phone offering the same nag an hour later would be the app forgetting
 * what its owner told it.
 *
 * ── THE HONEST LIMIT, SAME AS THE SYNC'S ────────────────────────────────────
 * A web page can only act while it is open. "Monthly on the 1st at 08:30"
 * honestly means "the first time the app is open on or after that moment" —
 * the decision below asks "has the most recent scheduled moment passed
 * unacknowledged?", so a closed app catches up the moment it opens.
 */

import { preferences } from '../services/preferencesService';

export type ReminderSchedule = 'off' | 'daily' | 'weekly' | 'monthly';

export interface BalanceReminderPrefs {
  schedule: ReminderSchedule;
  /** 24h "HH:mm". */
  time: string;
  /** 0 (Sunday) – 6 (Saturday); only meaningful in 'weekly'. */
  weekday: number;
  /**
   * 1–28, only meaningful in 'monthly'. Capped at 28 so the schedule means
   * the same thing in February as in July — a "31st" that silently fires on
   * the 3rd of March is a rule nobody set.
   */
  monthDay: number;
}

/** What has been answered, travelling with the user — see the header. */
export interface BalanceReminderState {
  /** When the user last said "done" (or set the schedule up). */
  lastAcknowledged: Date | null;
  /** "Remind me tomorrow": quiet until this moment. */
  snoozedUntil: Date | null;
}

export const DEFAULT_REMINDER_PREFS: BalanceReminderPrefs = {
  schedule: 'off',
  time: '08:30',
  weekday: 1,
  monthDay: 1,
};

const PREFS_KEY = 'balanceReminders.prefs.v1';
const STATE_KEY = 'balanceReminders.state.v1';

const isValidTime = (t: unknown): t is string =>
  typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' && Number.isInteger(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
};

export function loadReminderPrefs(): BalanceReminderPrefs {
  try {
    const raw = preferences.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_REMINDER_PREFS;
    const parsed = JSON.parse(raw) as Partial<BalanceReminderPrefs>;
    const schedule = parsed.schedule;
    return {
      schedule:
        schedule === 'daily' || schedule === 'weekly' || schedule === 'monthly'
          ? schedule
          : 'off',
      time: isValidTime(parsed.time) ? parsed.time : DEFAULT_REMINDER_PREFS.time,
      weekday: clampInt(parsed.weekday, 0, 6, DEFAULT_REMINDER_PREFS.weekday),
      monthDay: clampInt(parsed.monthDay, 1, 28, DEFAULT_REMINDER_PREFS.monthDay),
    };
  } catch {
    return DEFAULT_REMINDER_PREFS;
  }
}

/**
 * Saving a schedule also acknowledges "now": the first reminder is the NEXT
 * scheduled moment. Without this, turning reminders on at 9am with an 8:30
 * time would nag immediately — a reminder for a moment the user was present
 * and deciding at, which is not a reminder.
 */
export function saveReminderPrefs(prefs: BalanceReminderPrefs, now: Date): void {
  preferences.setItem(PREFS_KEY, JSON.stringify(prefs));
  saveReminderState({ lastAcknowledged: now, snoozedUntil: null });
}

export function loadReminderState(): BalanceReminderState {
  try {
    const raw = preferences.getItem(STATE_KEY);
    if (!raw) return { lastAcknowledged: null, snoozedUntil: null };
    const parsed = JSON.parse(raw) as { lastAcknowledged?: string; snoozedUntil?: string };
    const date = (value: string | undefined): Date | null => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    return {
      lastAcknowledged: date(parsed.lastAcknowledged),
      snoozedUntil: date(parsed.snoozedUntil),
    };
  } catch {
    return { lastAcknowledged: null, snoozedUntil: null };
  }
}

export function saveReminderState(state: BalanceReminderState): void {
  preferences.setItem(
    STATE_KEY,
    JSON.stringify({
      lastAcknowledged: state.lastAcknowledged?.toISOString(),
      snoozedUntil: state.snoozedUntil?.toISOString(),
    })
  );
}

/** "Done" — the job is done for everyone, on every device. */
export function acknowledgeReminder(now: Date): void {
  saveReminderState({ lastAcknowledged: now, snoozedUntil: null });
}

/**
 * "Remind me tomorrow" — literally tomorrow at the scheduled time, whatever
 * the schedule. Snoozing a WEEKLY reminder to next week would not be a snooze,
 * it would be skipping the job.
 */
export function snoozeReminderUntilTomorrow(prefs: BalanceReminderPrefs, now: Date): void {
  const time = isValidTime(prefs.time) ? prefs.time : DEFAULT_REMINDER_PREFS.time;
  const [hh, mm] = time.split(':').map(Number);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hh, mm, 0, 0);
  const state = loadReminderState();
  saveReminderState({ ...state, snoozedUntil: tomorrow });
}

/**
 * The most recent scheduled moment at or before `now`, or null when the
 * schedule is off. Pure, and the whole of the arithmetic — everything else is
 * a comparison against what this returns.
 */
export function mostRecentScheduledMoment(
  prefs: BalanceReminderPrefs,
  now: Date
): Date | null {
  if (prefs.schedule === 'off') return null;
  const time = isValidTime(prefs.time) ? prefs.time : DEFAULT_REMINDER_PREFS.time;
  const [hh, mm] = time.split(':').map(Number);

  const at = (base: Date): Date => {
    const d = new Date(base);
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  if (prefs.schedule === 'daily') {
    const today = at(now);
    if (today <= now) return today;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return at(yesterday);
  }

  if (prefs.schedule === 'weekly') {
    const weekday = clampInt(prefs.weekday, 0, 6, DEFAULT_REMINDER_PREFS.weekday);
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() - ((candidate.getDay() - weekday + 7) % 7));
    if (at(candidate) <= now) return at(candidate);
    candidate.setDate(candidate.getDate() - 7);
    return at(candidate);
  }

  const monthDay = clampInt(prefs.monthDay, 1, 28, DEFAULT_REMINDER_PREFS.monthDay);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), monthDay);
  if (at(thisMonth) <= now) return at(thisMonth);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, monthDay);
  return at(lastMonth);
}

/**
 * Is a reminder due at `now`?
 *
 * Due when the most recent scheduled moment has passed without an
 * acknowledgement since — which is what makes a closed app catch up on open —
 * unless a snooze is still quiet. A never-acknowledged schedule (state lost,
 * or written by an older build) is due from its first scheduled moment: the
 * save-time acknowledgement in saveReminderPrefs is what keeps that from
 * meaning "immediately".
 */
export function reminderDue(
  prefs: BalanceReminderPrefs,
  state: BalanceReminderState,
  now: Date
): boolean {
  const scheduled = mostRecentScheduledMoment(prefs, now);
  if (scheduled === null) return false;
  if (state.snoozedUntil !== null && now < state.snoozedUntil) return false;
  return state.lastAcknowledged === null || state.lastAcknowledged < scheduled;
}
