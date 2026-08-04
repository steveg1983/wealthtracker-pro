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

describe('per-user storage', () => {
  beforeEach(() => localStorage.clear());

  it('prefs are keyed by user — one user\'s schedule never leaks onto another', () => {
    saveAutoSyncPrefs('user_a', { mode: 'daily', dailyTime: '07:30' });

    expect(loadAutoSyncPrefs('user_a')).toEqual({ mode: 'daily', dailyTime: '07:30' });
    expect(loadAutoSyncPrefs('user_b')).toEqual(DEFAULT_AUTO_SYNC_PREFS);
  });

  it('last-run stamps are keyed by user too', () => {
    recordAutoSyncRun('user_a', at('2026-07-30T08:00:00Z'));

    expect(loadLastAutoSyncRun('user_a')?.toISOString()).toBe('2026-07-30T08:00:00.000Z');
    expect(loadLastAutoSyncRun('user_b')).toBeNull();
  });

  it('garbage in storage degrades to the defaults', () => {
    localStorage.setItem('bankAutoSync:prefs:user_a', '{not json');
    localStorage.setItem('bankAutoSync:lastRun:user_a', 'yesterday-ish');

    expect(loadAutoSyncPrefs('user_a')).toEqual(DEFAULT_AUTO_SYNC_PREFS);
    expect(loadLastAutoSyncRun('user_a')).toBeNull();
  });
});
