import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { IDBPDatabase } from 'idb';
import type { Transaction } from '../types';
import { OfflineService } from './offlineService';
import type { OfflineServiceOptions } from './offlineService';

const createEnv = (overrides: Partial<OfflineServiceOptions> = {}) => {
  const windowRef = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    SyncManager: true
  };

  const documentRef = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    hidden: false
  };

  const registerSpy = vi.fn().mockResolvedValue(undefined);
  const navigatorRef = {
    onLine: true,
    serviceWorker: {
      ready: Promise.resolve({
        sync: {
          register: registerSpy
        }
      })
    }
  };

  const service = new OfflineService({
    windowRef,
    documentRef,
    navigatorRef,
    ...overrides
  });

  return { service, windowRef, documentRef, navigatorRef, registerSpy };
};

const createInMemoryDb = () => {
  const stores: Record<string, Map<string, any>> = {
    transactions: new Map(),
    accounts: new Map(),
    budgets: new Map(),
    goals: new Map(),
    offlineQueue: new Map(),
    conflicts: new Map()
  };

  const getStore = (name: keyof typeof stores) => stores[name];

  const clone = (value: any) => JSON.parse(JSON.stringify(value));

  const db = {
    transaction(storeNames: (keyof typeof stores)[]) {
      return {
        objectStore: (name: keyof typeof stores) => ({
          async put(value: any) {
            const key = value.id;
            getStore(name).set(key, clone(value));
          },
          async get(key: string) {
            return clone(getStore(name).get(key) ?? null);
          },
          async delete(key: string) {
            getStore(name).delete(key);
          },
          async getAll() {
            return Array.from(getStore(name).values()).map(clone);
          },
          async count() {
            return getStore(name).size;
          },
          async clear() {
            getStore(name).clear();
          }
        }),
        done: Promise.resolve()
      };
    },
    async getAll(name: keyof typeof stores) {
      return Array.from(getStore(name).values()).map(clone);
    },
    async get(name: keyof typeof stores, key: string) {
      return clone(getStore(name).get(key) ?? null);
    },
    async put(name: keyof typeof stores, value: any) {
      getStore(name).set(value.id, clone(value));
    },
    async delete(name: keyof typeof stores, key: string) {
      getStore(name).delete(key);
    },
    async count(name: keyof typeof stores) {
      return getStore(name).size;
    },
    async clear(name: keyof typeof stores) {
      getStore(name).clear();
    },
    close() {
      Object.values(stores).forEach(store => store.clear());
    }
  } as any;

  return db as IDBPDatabase<any>;
};

const mockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1',
  accountId: 'acc-1',
  amount: 100,
  description: 'Test',
  date: new Date('2025-01-01'),
  type: 'expense',
  category: 'cat-1',
  tags: [],
  isRecurring: false,
  isTransfer: false,
  ...overrides
});

describe('OfflineService (injected env)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis.fetch as any) = vi.fn().mockResolvedValue({
      ok: true,
      statusText: 'OK',
      json: async () => ({})
    });
  });

  it('initializes, sets up listeners, and registers background sync', async () => {
    const env = createEnv({ dbFactory: async () => createInMemoryDb() });
    await env.service.init();

    expect(env.windowRef.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(env.documentRef.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    await env.navigatorRef.serviceWorker?.ready;
    expect(env.registerSpy).toHaveBeenCalledWith('sync-offline-data');
  });

  it('queues transaction when offline', async () => {
    const env = createEnv({ dbFactory: async () => createInMemoryDb() });
    await env.service.init();

    await env.service.saveTransaction(mockTransaction(), true);
    const db = (env.service as any).db;
    const queue = await db.getAll('offlineQueue');

    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('create');
  });

  it('syncs queued items when back online', async () => {
    const env = createEnv({ dbFactory: async () => createInMemoryDb() });
    await env.service.init();

    await env.service.saveTransaction(mockTransaction(), true);
    const db = (env.service as any).db;
    expect(await db.count('offlineQueue')).toBe(1);

    env.navigatorRef.onLine = true;
    await env.service.syncOfflineData();

    expect(globalThis.fetch).toHaveBeenCalled();
    expect(await db.count('offlineQueue')).toBe(0);
    expect(env.windowRef.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'offline-sync-complete'
    }));
  });
});
