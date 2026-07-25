import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionCache, newestUpdatedAt, type TransactionCacheStore } from '../transactionCache';
import { indexedDBService } from '../indexedDBService';
import type { Transaction } from '../../types';

const COLUMNS = 'id,amount,updated_at';

/**
 * A row in the shape the boot path actually holds: PostgREST delivers date and
 * updated_at as ISO strings and nothing converts them back, so the JSON round
 * trip here reproduces production rather than the declared Date type.
 */
const row = (id: string, updatedAt?: string, date = '2026-01-01T00:00:00.000Z'): Transaction => {
  const base: Transaction = {
    id,
    date: new Date(date),
    amount: 1,
    description: id,
    category: 'cat',
    accountId: 'acct-1',
    type: 'expense',
    ...(updatedAt === undefined ? {} : { updatedAt: new Date(updatedAt) })
  };
  return JSON.parse(JSON.stringify(base));
};

/** In-memory stand-in for the IndexedDB store, so the rules are tested alone. */
const createStore = () => {
  const records = new Map<string, unknown>();
  const store: TransactionCacheStore = {
    get<T>(_storeName: string, key: IDBValidKey): Promise<T | undefined> {
      return Promise.resolve(records.get(String(key)) as T | undefined);
    },
    put<T extends Record<string, unknown>>(_storeName: string, data: T): Promise<void> {
      records.set(String(data.key), data);
      return Promise.resolve();
    },
    delete(_storeName: string, key: IDBValidKey): Promise<void> {
      records.delete(String(key));
      return Promise.resolve();
    }
  };
  return { store, records };
};

describe('newestUpdatedAt', () => {
  it('picks the latest timestamp and ignores rows without one', () => {
    expect(newestUpdatedAt([
      row('a', '2026-07-01T00:00:00.000Z'),
      row('b'),
      row('c', '2026-07-20T09:30:00.000Z'),
      row('d', '2026-02-01T00:00:00.000Z')
    ])).toBe('2026-07-20T09:30:00.000Z');
  });

  it('returns null when no row carries a usable timestamp', () => {
    // An unparseable timestamp serialises to null and must be ignored rather
    // than becoming a high-water mark no delta query could use.
    expect(newestUpdatedAt([row('a'), row('b', 'nonsense')])).toBeNull();
  });

  it('accepts a real Date as well as the string PostgREST returns', () => {
    const withDate: Transaction = { ...row('a'), updatedAt: new Date('2026-03-04T05:06:07.000Z') };
    expect(newestUpdatedAt([withDate])).toBe('2026-03-04T05:06:07.000Z');
  });
});

describe('TransactionCache', () => {
  const logger = { warn: vi.fn() };

  beforeEach(() => {
    logger.warn.mockReset();
  });

  it('round-trips a snapshot and derives the high-water mark from the rows', async () => {
    const { store } = createStore();
    const cache = new TransactionCache({ store, logger });
    const rows = [row('a', '2026-07-01T00:00:00.000Z'), row('b', '2026-07-22T10:00:00.000Z')];

    await cache.write('user-1', COLUMNS, rows);
    const snapshot = await cache.read('user-1', COLUMNS);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.rows).toHaveLength(2);
    expect(snapshot?.highWaterMark).toBe('2026-07-22T10:00:00.000Z');
  });

  it('refuses to store a set with no usable updated_at (there would be no delta to ask for)', async () => {
    const { store, records } = createStore();
    const cache = new TransactionCache({ store, logger });

    await cache.write('user-1', COLUMNS, [row('a')]);

    expect(records.size).toBe(0);
    expect(await cache.read('user-1', COLUMNS)).toBeNull();
  });

  it('never serves another user snapshot, and drops it', async () => {
    const { store, records } = createStore();
    const cache = new TransactionCache({ store, logger });
    await cache.write('user-1', COLUMNS, [row('a', '2026-07-01T00:00:00.000Z')]);

    expect(await cache.read('user-2', COLUMNS)).toBeNull();
    expect(records.size).toBe(0);
  });

  it('invalidates when the boot column list changes', async () => {
    // The exact d10f58fd event: the select list is trimmed, so every stored row
    // is a different shape and must not be hydrated.
    const { store, records } = createStore();
    const cache = new TransactionCache({ store, logger });
    await cache.write('user-1', COLUMNS, [row('a', '2026-07-01T00:00:00.000Z')]);

    expect(await cache.read('user-1', `${COLUMNS},notes`)).toBeNull();
    expect(records.size).toBe(0);
  });

  it('invalidates a record written by an older schema version', async () => {
    const { store, records } = createStore();
    await store.put('largeData', {
      key: 'wt-boot-transactions',
      schemaVersion: 0,
      userId: 'user-1',
      columns: COLUMNS,
      savedAt: '2026-07-01T00:00:00.000Z',
      highWaterMark: '2026-07-01T00:00:00.000Z',
      rows: [row('a', '2026-07-01T00:00:00.000Z')]
    });
    const cache = new TransactionCache({ store, logger });

    expect(await cache.read('user-1', COLUMNS)).toBeNull();
    expect(records.size).toBe(0);
  });

  it('clears on request', async () => {
    const { store, records } = createStore();
    const cache = new TransactionCache({ store, logger });
    await cache.write('user-1', COLUMNS, [row('a', '2026-07-01T00:00:00.000Z')]);

    await cache.clear();

    expect(records.size).toBe(0);
    expect(await cache.read('user-1', COLUMNS)).toBeNull();
  });

  it('treats an unreadable store as a miss rather than a failure', async () => {
    const failing: TransactionCacheStore = {
      get: () => Promise.reject(new Error('IndexedDB unavailable')),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve()
    };
    const cache = new TransactionCache({ store: failing, logger });

    await expect(cache.read('user-1', COLUMNS)).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('drops the record when the write fails, so a partial snapshot is never trusted', async () => {
    const { store } = createStore();
    const deleted: IDBValidKey[] = [];
    const overQuota: TransactionCacheStore = {
      get: store.get,
      put: () => Promise.reject(new Error('QuotaExceededError')),
      delete: (storeName, key) => { deleted.push(key); return store.delete(storeName, key); }
    };
    const cache = new TransactionCache({ store: overQuota, logger });

    await expect(
      cache.write('user-1', COLUMNS, [row('a', '2026-07-01T00:00:00.000Z')])
    ).resolves.toBeUndefined();
    expect(deleted).toEqual(['wt-boot-transactions']);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('round-trips through the real IndexedDB store the app ships with', async () => {
    // Proves the store name exists in indexedDBService's schema — a typo here
    // would silently disable the cache in production and nowhere else.
    const cache = new TransactionCache({ logger });
    await cache.clear();

    await cache.write('user-idb', COLUMNS, [
      row('a', '2026-07-01T00:00:00.000Z'),
      row('b', '2026-07-23T00:00:00.000Z')
    ]);
    const snapshot = await cache.read('user-idb', COLUMNS);

    expect(snapshot?.rows.map(r => r.id)).toEqual(['a', 'b']);
    expect(snapshot?.highWaterMark).toBe('2026-07-23T00:00:00.000Z');
    expect(logger.warn).not.toHaveBeenCalled();

    await cache.clear();
    expect(await cache.read('user-idb', COLUMNS)).toBeNull();
    indexedDBService.close();
  });
});
