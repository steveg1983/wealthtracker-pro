/**
 * The local/demo half of the dismissals — the mirror that has to behave exactly
 * like the cloud, because demo mode is where the feature gets shown off and
 * offline mode is where it gets used on a train.
 *
 * The last block is the mirror of the trg_prune_suggestion_dismissals trigger:
 * deleting a transaction takes the dismissals that named it with it, so a
 * refusal about rows that no longer exist cannot accumulate forever.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataService } from '../api/dataService';
import { STORAGE_KEYS } from '../storageAdapter';
import type { Account, SuggestionDismissal, Transaction } from '../../types';

const createStorage = (initial: Record<string, unknown> = {}) => {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, Array.isArray(value) ? [...value] : value);
    }),
    snapshot: (key: string) => store.get(key)
  };
};

const account: Account = {
  id: 'acct-1',
  name: 'Current account',
  type: 'checking',
  balance: 100,
  currency: 'GBP',
  institution: 'Test Bank',
  isActive: true,
  lastUpdated: new Date('2026-01-01T00:00:00.000Z')
};

const transaction = (overrides: Partial<Transaction> & { id: string }): Transaction => ({
  accountId: 'acct-1',
  amount: -49.99,
  date: new Date('2026-05-01T00:00:00.000Z'),
  description: 'TESCO STORES 3421',
  category: 'cat-food',
  type: 'expense',
  ...overrides
});

const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
const userId = {
  ensureUserExists: vi.fn(),
  getCurrentDatabaseUserId: vi.fn(() => null),
  getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
};

const localService = (storage: ReturnType<typeof createStorage>, uuid = () => 'dismissal-1') =>
  createDataService({
    isSupabaseConfigured: () => false,
    storageAdapter: storage,
    logger,
    uuid,
    now: () => new Date('2026-06-01T00:00:00.000Z'),
    userIdService: userId
  });

beforeEach(() => {
  Object.values(logger).forEach(fn => fn.mockReset());
  userId.getCurrentDatabaseUserId.mockImplementation(() => null);
});

describe('DataService suggestion dismissals (local/demo)', () => {
  it('remembers a refusal across a reload', async () => {
    const storage = createStorage();
    const service = localService(storage);

    await service.dismissSuggestion('duplicate', 'feed|import', ['feed', 'import']);

    // A second service instance reading the same storage is what "close the
    // sweep and come back later" actually looks like.
    const reloaded = await localService(storage).getSuggestionDismissals();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]).toMatchObject({
      kind: 'duplicate',
      subjectKey: 'feed|import',
      subjectIds: ['feed', 'import']
    });
    // Revived from JSON, so callers can format it without checking the type.
    expect(reloaded[0].dismissedAt).toBeInstanceOf(Date);
  });

  it('is idempotent: refusing the same thing twice stores one record', async () => {
    const storage = createStorage();
    const service = localService(storage);

    const first = await service.dismissSuggestion('transfer-pair', 'a|b', ['a', 'b']);
    const again = await service.dismissSuggestion('transfer-pair', 'a|b', ['a', 'b']);

    expect(again.id).toBe(first.id);
    expect(await service.getSuggestionDismissals()).toHaveLength(1);
  });

  it('keeps the four kinds apart, even for the same rows', async () => {
    const storage = createStorage();
    let next = 0;
    const service = localService(storage, () => `dismissal-${++next}`);

    await service.dismissSuggestion('transfer-pair', 'a|b', ['a', 'b']);
    await service.dismissSuggestion('duplicate', 'a|b', ['a', 'b']);

    const stored = await service.getSuggestionDismissals();
    expect(stored.map(d => d.kind).sort()).toEqual(['duplicate', 'transfer-pair']);
  });

  it('restores exactly the one asked for', async () => {
    const storage = createStorage();
    let next = 0;
    const service = localService(storage, () => `dismissal-${++next}`);

    await service.dismissSuggestion('duplicate', 'a|b', ['a', 'b']);
    await service.dismissSuggestion('duplicate', 'c|d', ['c', 'd']);
    await service.restoreSuggestion('duplicate', 'a|b');

    const stored = await service.getSuggestionDismissals();
    expect(stored.map(d => d.subjectKey)).toEqual(['c|d']);
  });

  it('mirrors the prune trigger: deleting a row clears the dismissals that named it', async () => {
    const stored: SuggestionDismissal[] = [
      { id: 'd1', kind: 'duplicate', subjectKey: 'feed|import', subjectIds: ['feed', 'import'], dismissedAt: new Date('2026-06-01') },
      { id: 'd2', kind: 'duplicate', subjectKey: 'other|rows', subjectIds: ['other', 'rows'], dismissedAt: new Date('2026-06-01') }
    ];
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [account],
      [STORAGE_KEYS.TRANSACTIONS]: [transaction({ id: 'feed' }), transaction({ id: 'import' })],
      [STORAGE_KEYS.SUGGESTION_DISMISSALS]: stored
    });
    const service = localService(storage);

    await service.deleteTransaction('import');

    const survivors = await service.getSuggestionDismissals();
    expect(survivors.map(d => d.id)).toEqual(['d2']);
    // And the delete still did its own job: the balance is reversed.
    expect(storage.snapshot(STORAGE_KEYS.ACCOUNTS)).toEqual([
      expect.objectContaining({ balance: 149.99 })
    ]);
  });
});
