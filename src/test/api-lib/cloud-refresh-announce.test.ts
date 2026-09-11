import { describe, it, expect, vi } from 'vitest';
import {
  announceCloudRefresh,
  composeFeedActivity,
  composeFeedAttention,
  RECONNECT_URL,
  REVIEW_URL,
  type AnnounceDeps,
} from '../../../api/_lib/cloud-refresh-announce';
import type { ConnectionResult } from '../../../api/_lib/cloud-refresh';
import { PHONE_NOTIFICATION_PREFS_KEY } from '../../../src/services/push/prefs';

/**
 * WHAT THE CLOUD REFRESH TELLS A PHONE — the words and the grouping, without
 * Apple. Names and ids invented (public repo).
 */

const result = (n: number, userId: string, outcome: ConnectionResult['outcome']): ConnectionResult => ({
  connection_id: `conn-${n}`,
  user_id: userId,
  institution_name: `Bank ${n}`,
  last_sync: null,
  outcome,
});

function harness(prefsByUser: Record<string, object>) {
  const notes: Array<{ userId: string; title: string; collapseId?: string }> = [];
  const deps: AnnounceDeps = {
    loadPreferences: vi.fn(async (ids: readonly string[]) => {
      const map = new Map<string, Record<string, string>>();
      for (const id of ids) {
        if (prefsByUser[id]) map.set(id, { [PHONE_NOTIFICATION_PREFS_KEY]: JSON.stringify(prefsByUser[id]) });
      }
      return map;
    }),
    notify: vi.fn(async (userId: string, note: { title: string; collapseId?: string }) => {
      notes.push({ userId, title: note.title, collapseId: note.collapseId });
      return { devices: 1, sent: 1, retired: 0, failed: 0 };
    }),
  };
  return { deps, notes };
}

describe('the words', () => {
  it('new transactions: counts per institution, in prose, never an amount', () => {
    const note = composeFeedActivity([
      { institution_name: 'Sample Bank', imported: 3 },
      { institution_name: 'Sample Card', imported: 11 },
      { institution_name: 'Sample Building Society', imported: 1 },
    ]);
    expect(note.title).toBe('15 new transactions');
    expect(note.body).toBe('3 from Sample Bank, 11 from Sample Card and 1 from Sample Building Society are waiting for you to review.');
    expect(note.url).toBe(REVIEW_URL);
    expect(note.collapseId).toBe('feed-activity');
  });

  it('one transaction reads as one', () => {
    const note = composeFeedActivity([{ institution_name: 'Sample Bank', imported: 1 }]);
    expect(note.title).toBe('1 new transaction');
    expect(note.body).toBe('1 from Sample Bank is waiting for you to review.');
  });

  it('a stopped feed names the bank, the consequence and the remedy', () => {
    const note = composeFeedAttention('Sample Bank', 'conn-9');
    expect(note.title).toBe('Sample Bank needs reconnecting');
    expect(note.body).toMatch(/nothing new will arrive from it until you reconnect/);
    expect(note.url).toBe(RECONNECT_URL);
    expect(note.collapseId).toBe('feed-attention:conn-9');
  });
});

describe('the grouping', () => {
  it('one activity push per user per run, however many feeds delivered', async () => {
    const h = harness({ 'user-a': { feedActivity: true } });
    const summary = await announceCloudRefresh(h.deps, [
      result(1, 'user-a', { kind: 'synced', imported: 3 }),
      result(2, 'user-a', { kind: 'synced', imported: 2 }),
      result(3, 'user-a', { kind: 'synced', imported: 0 }),
    ]);
    expect(h.notes).toEqual([{ userId: 'user-a', title: '5 new transactions', collapseId: 'feed-activity' }]);
    expect(summary).toMatchObject({ users: 1, activityPushes: 1, attentionPushes: 0, sent: 1 });
  });

  it('a run that imported nothing says nothing', async () => {
    const h = harness({ 'user-a': { feedActivity: true } });
    await announceCloudRefresh(h.deps, [result(1, 'user-a', { kind: 'synced', imported: 0 })]);
    expect(h.notes).toEqual([]);
  });

  it('a user who did not ask hears nothing — absent preferences are "asked for nothing"', async () => {
    const h = harness({});
    const summary = await announceCloudRefresh(h.deps, [
      result(1, 'user-a', { kind: 'synced', imported: 9 }),
      result(2, 'user-a', { kind: 'reauth_required' }),
    ]);
    expect(h.notes).toEqual([]);
    expect(summary.users).toBe(1);
  });

  it('a feed that stopped in this run is announced once per connection, behind its own switch', async () => {
    const h = harness({ 'user-a': { feedAttention: true }, 'user-b': { feedActivity: true } });
    const summary = await announceCloudRefresh(h.deps, [
      result(1, 'user-a', { kind: 'reauth_required' }),
      result(2, 'user-a', { kind: 'reauth_required' }),
      result(3, 'user-b', { kind: 'reauth_required' }),
    ]);
    expect(h.notes.map((n) => `${n.userId}:${n.collapseId}`)).toEqual([
      'user-a:feed-attention:conn-1',
      'user-a:feed-attention:conn-2',
    ]);
    expect(summary.attentionPushes).toBe(2);
  });

  it('failures and refusals are not news for the phone', async () => {
    const h = harness({ 'user-a': { feedActivity: true, feedAttention: true } });
    await announceCloudRefresh(h.deps, [
      result(1, 'user-a', { kind: 'failed' }),
      result(2, 'user-a', { kind: 'refused', code: 'schema_mismatch' }),
      result(3, 'user-a', { kind: 'skipped' }),
    ]);
    expect(h.notes).toEqual([]);
  });

  it('an empty run touches nothing — not even the preferences table', async () => {
    const h = harness({});
    await announceCloudRefresh(h.deps, []);
    expect(h.deps.loadPreferences).not.toHaveBeenCalled();
  });
});
