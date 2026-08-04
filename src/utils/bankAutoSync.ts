/**
 * Automatic bank-feed refresh: the preference, its per-user storage, and the
 * one decision that matters — "is a refresh due right now?".
 *
 * The decision is a pure function so the scheduling rules live under test,
 * not inside a hook. Storage is localStorage keyed BY USER ID: this device
 * setting controls actions on the signed-in user's data, and an unkeyed entry
 * would leak one user's schedule onto another's session on a shared machine —
 * the exact mistake the notification feed made.
 */

export type AutoSyncMode = 'off' | 'signin' | 'daily';

export interface AutoSyncPrefs {
  mode: AutoSyncMode;
  /** 24h "HH:mm"; only meaningful in 'daily' mode. */
  dailyTime: string;
}

export const DEFAULT_AUTO_SYNC_PREFS: AutoSyncPrefs = { mode: 'off', dailyTime: '08:00' };

/**
 * 'signin' mode throttle: "refresh when I open the app", not "hammer the bank
 * on every reload". A re-open within this window is one session, not a new
 * sign-in.
 */
export const SIGNIN_MODE_MIN_GAP_MS = 60 * 60 * 1000;

const prefsKey = (userId: string): string => `bankAutoSync:prefs:${userId}`;
const lastRunKey = (userId: string): string => `bankAutoSync:lastRun:${userId}`;

const isValidTime = (t: unknown): t is string =>
  typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function loadAutoSyncPrefs(userId: string): AutoSyncPrefs {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return DEFAULT_AUTO_SYNC_PREFS;
    const parsed: unknown = JSON.parse(raw);
    const mode = (parsed as AutoSyncPrefs).mode;
    const dailyTime = (parsed as AutoSyncPrefs).dailyTime;
    return {
      mode: mode === 'signin' || mode === 'daily' ? mode : 'off',
      dailyTime: isValidTime(dailyTime) ? dailyTime : DEFAULT_AUTO_SYNC_PREFS.dailyTime,
    };
  } catch {
    return DEFAULT_AUTO_SYNC_PREFS;
  }
}

export function saveAutoSyncPrefs(userId: string, prefs: AutoSyncPrefs): void {
  localStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
}

export function loadLastAutoSyncRun(userId: string): Date | null {
  const raw = localStorage.getItem(lastRunKey(userId));
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function recordAutoSyncRun(userId: string, at: Date): void {
  localStorage.setItem(lastRunKey(userId), at.toISOString());
}

/**
 * Is an automatic refresh due at `now`?
 *
 * 'signin': due when the last run is absent or over an hour old — fires on
 * app open, throttled so reloads within a session do not re-sync.
 *
 * 'daily': due once the day's scheduled moment has passed and no run has
 * happened since that moment. An app opened AFTER the scheduled time catches
 * up immediately; an app open ACROSS it fires as the minute arrives; a run
 * already done after today's moment means nothing more until tomorrow. The
 * app can only act while it is open — this is a web page, not a daemon — so
 * "every day at 08:00" honestly means "the first opportunity on or after
 * 08:00 each day".
 */
export function shouldAutoSync(prefs: AutoSyncPrefs, lastRun: Date | null, now: Date): boolean {
  if (prefs.mode === 'off') return false;

  if (prefs.mode === 'signin') {
    return lastRun === null || now.getTime() - lastRun.getTime() >= SIGNIN_MODE_MIN_GAP_MS;
  }

  const time = isValidTime(prefs.dailyTime) ? prefs.dailyTime : DEFAULT_AUTO_SYNC_PREFS.dailyTime;
  const [hh, mm] = time.split(':').map(Number);
  const scheduledToday = new Date(now);
  scheduledToday.setHours(hh, mm, 0, 0);

  if (now < scheduledToday) return false;
  return lastRun === null || lastRun < scheduledToday;
}
