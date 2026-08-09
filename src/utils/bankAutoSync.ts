/**
 * Automatic bank-feed refresh: the preference, its per-user storage, and the
 * one decision that matters — "is a refresh due right now?".
 *
 * The decision is a pure function so the scheduling rules live under test,
 * not inside a hook.
 *
 * ── WHERE THE TWO VALUES LIVE, AND WHY THEY DIFFER ──────────────────────────
 *
 * The PREFERENCE ("refresh daily at 08:00") belongs to the user and travels
 * with the account, so it goes in the preferences document — which is already
 * per-user, so the user-id keying the old localStorage entry needed disappears
 * along with the shared-machine leak it existed to prevent.
 *
 * The LAST RUN belongs to the DEVICE and stays keyed by user in localStorage.
 * It records when THIS browser last called the bank; carried to a second
 * machine it would say "already synced today" on a machine that has never
 * synced at all, and the refresh the user asked for would silently not happen.
 */

import { preferences } from '../services/preferencesService';

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

/**
 * One key, not one per user: the preferences document is already the signed-in
 * user's own. The old `bankAutoSync:prefs:<userId>` entries are read once, on
 * the first boot after this ships, so nobody's schedule is forgotten.
 */
const PREFS_KEY = 'bankAutoSync.prefs.v1';
const legacyPrefsKey = (userId: string): string => `bankAutoSync:prefs:${userId}`;
const lastRunKey = (userId: string): string => `bankAutoSync:lastRun:${userId}`;

const isValidTime = (t: unknown): t is string =>
  typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function loadAutoSyncPrefs(userId: string): AutoSyncPrefs {
  try {
    const raw = preferences.getItem(PREFS_KEY) ?? localStorage.getItem(legacyPrefsKey(userId));
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
  preferences.setItem(PREFS_KEY, JSON.stringify(prefs));
  // The pre-move copy would otherwise be read back by an older tab still open
  // on the same machine, which would then write it back over this one.
  try { localStorage.removeItem(legacyPrefsKey(userId)); } catch { /* storage may be unavailable */ }
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
