import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldAutoSync,
  loadAutoSyncPrefs,
  saveAutoSyncPrefs,
  loadLastAutoSyncRun,
  recordAutoSyncRun,
  DEFAULT_AUTO_SYNC_PREFS,
  type AutoSyncPrefs,
} from '../bankAutoSync';
import { preferences } from '../../services/preferencesService';

const at = (iso: string): Date => new Date(iso);

describe('shouldAutoSync', () => {
  const signin: AutoSyncPrefs = { mode: 'signin', dailyTime: '08:00' };
  const daily: AutoSyncPrefs = { mode: 'daily', dailyTime: '08:00' };

  it('never fires when off', () => {
    expect(shouldAutoSync({ mode: 'off', dailyTime: '08:00' }, null, at('2026-07-30T09:00:00'))).toBe(false);
  });

  it('signin: fires on a first-ever open', () => {
    expect(shouldAutoSync(signin, null, at('2026-07-30T09:00:00'))).toBe(true);
  });

  it('signin: a reload twenty minutes later is the same session, not a new sign-in', () => {
    expect(shouldAutoSync(signin, at('2026-07-30T09:00:00'), at('2026-07-30T09:20:00'))).toBe(false);
  });

  it('signin: fires again once an hour has passed', () => {
    expect(shouldAutoSync(signin, at('2026-07-30T09:00:00'), at('2026-07-30T10:00:00'))).toBe(true);
  });

  it('daily: not before the scheduled time', () => {
    expect(shouldAutoSync(daily, null, at('2026-07-30T07:59:00'))).toBe(false);
  });

  it('daily: fires as the scheduled minute arrives while the app is open', () => {
    expect(shouldAutoSync(daily, at('2026-07-29T08:00:30'), at('2026-07-30T08:00:00'))).toBe(true);
  });

  it('daily: an app opened after the scheduled time catches up immediately', () => {
    expect(shouldAutoSync(daily, at('2026-07-29T08:01:00'), at('2026-07-30T14:30:00'))).toBe(true);
  });

  it('daily: at most once per day — a run after this morning\'s moment holds until tomorrow', () => {
    expect(shouldAutoSync(daily, at('2026-07-30T08:00:10'), at('2026-07-30T23:59:00'))).toBe(false);
  });

  it('daily: yesterday-evening run does not satisfy this morning', () => {
    expect(shouldAutoSync(daily, at('2026-07-29T22:00:00'), at('2026-07-30T08:05:00'))).toBe(true);
  });

  it('daily: an invalid stored time falls back to the default rather than never firing', () => {
    expect(shouldAutoSync({ mode: 'daily', dailyTime: '99:99' }, null, at('2026-07-30T08:30:00'))).toBe(true);
  });
});

/**
 * The two values are stored differently ON PURPOSE. The SCHEDULE is a
 * preference and travels with the account, so it lives in the preferences
 * document — already per-user, which is why the user-id keying it used to need
 * has gone. The LAST RUN says when THIS browser last called the bank and stays
 * keyed by user in localStorage, because carrying it to a second machine would
 * make that machine believe it had already synced.
 */
describe('storage', () => {
  beforeEach(() => {
    preferences.detach();
    localStorage.clear();
  });

  it('the schedule is remembered, and belongs to whoever is signed in', () => {
    saveAutoSyncPrefs('user_a', { mode: 'daily', dailyTime: '07:30' });

    expect(loadAutoSyncPrefs('user_a')).toEqual({ mode: 'daily', dailyTime: '07:30' });
    // The preferences document IS the signed-in user's, so the same document
    // answers for any id passed here; the isolation lives one layer up, in the
    // row RLS scopes to the login.
    expect(preferences.getItem('bankAutoSync.prefs.v1')).toBe('{"mode":"daily","dailyTime":"07:30"}');
  });

  it('a schedule set before it travelled is still honoured, and then moved', () => {
    // The one-time carry-over: nobody who had already chosen a schedule should
    // find it silently back to Off on the first boot after this shipped.
    localStorage.setItem('bankAutoSync:prefs:user_a', '{"mode":"daily","dailyTime":"06:15"}');

    expect(loadAutoSyncPrefs('user_a')).toEqual({ mode: 'daily', dailyTime: '06:15' });

    saveAutoSyncPrefs('user_a', { mode: 'daily', dailyTime: '06:15' });
    // …and the pre-move copy is cleared, so an older tab on the same machine
    // cannot write it back over the one that now travels.
    expect(localStorage.getItem('bankAutoSync:prefs:user_a')).toBeNull();
  });

  it('last-run stamps are keyed by user, and stay on the device', () => {
    recordAutoSyncRun('user_a', at('2026-07-30T08:00:00Z'));

    expect(loadLastAutoSyncRun('user_a')?.toISOString()).toBe('2026-07-30T08:00:00.000Z');
    expect(loadLastAutoSyncRun('user_b')).toBeNull();
    expect(localStorage.getItem('bankAutoSync:lastRun:user_a')).toBe('2026-07-30T08:00:00.000Z');
  });

  it('garbage in storage degrades to the defaults', () => {
    preferences.setItem('bankAutoSync.prefs.v1', '{not json');
    localStorage.setItem('bankAutoSync:lastRun:user_a', 'yesterday-ish');

    expect(loadAutoSyncPrefs('user_a')).toEqual(DEFAULT_AUTO_SYNC_PREFS);
    expect(loadLastAutoSyncRun('user_a')).toBeNull();
  });
});
