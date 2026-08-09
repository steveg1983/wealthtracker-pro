/**
 * The contract suite, run against the implementation that exists today.
 *
 * DataService in its browser-storage mode — the engine that serves demo mode,
 * offline mode and every signed-out session. It is the one implementation the
 * suite can drive without a network, which makes it the natural first subject;
 * the cloud engine keeps the same rules inside its RPCs and gets a harness of
 * its own when there is a test database to point it at.
 *
 * The value here is not this file: it is that `contract.ts` says nothing about
 * DataService, storage keys or Supabase, so the local edition can add twenty
 * lines like the ones below and inherit every rule.
 */

import { vi } from 'vitest';
import { createDataService } from '../../api/dataService';
import { STORAGE_KEYS } from '../../storageAdapter';
import {
  runDataPortContract,
  type DataPortUnderTest,
  type PortFixture,
  type PortStoreState
} from './contract';

/**
 * A store that behaves like the browser's, minus the encryption and the
 * asynchrony that would make an assertion racy. `get` hands back what was put
 * in, so the boundary where an untyped store becomes app-shaped values is the
 * one place a cast belongs — exactly as it is in a real adapter.
 */
const createStore = (fixture: PortFixture) => {
  const data = new Map<string, unknown>([
    [STORAGE_KEYS.ACCOUNTS, [...(fixture.accounts ?? [])]],
    [STORAGE_KEYS.TRANSACTIONS, [...(fixture.transactions ?? [])]],
    [STORAGE_KEYS.TRANSACTION_SPLITS, [...(fixture.splits ?? [])]],
    [STORAGE_KEYS.CATEGORIES, [...(fixture.categories ?? [])]],
    [STORAGE_KEYS.BUDGETS, [...(fixture.budgets ?? [])]],
    [STORAGE_KEYS.SUGGESTION_DISMISSALS, [...(fixture.dismissals ?? [])]]
  ]);

  const collection = <T>(key: string): T[] => {
    const stored = data.get(key);
    return Array.isArray(stored) ? (stored as T[]) : [];
  };

  return {
    adapter: {
      get: vi.fn(async (key: string) => data.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => {
        data.set(key, Array.isArray(value) ? [...value] : value);
      })
    },
    read: async (): Promise<PortStoreState> => ({
      accounts: collection(STORAGE_KEYS.ACCOUNTS),
      transactions: collection(STORAGE_KEYS.TRANSACTIONS),
      splits: collection(STORAGE_KEYS.TRANSACTION_SPLITS),
      categories: collection(STORAGE_KEYS.CATEGORIES),
      budgets: collection(STORAGE_KEYS.BUDGETS),
      dismissals: collection(STORAGE_KEYS.SUGGESTION_DISMISSALS)
    })
  };
};

const createBrowserStoragePort = async (fixture: PortFixture): Promise<DataPortUnderTest> => {
  const store = createStore(fixture);
  let sequence = 0;

  const port = createDataService({
    // No cloud: this is the engine that serves demo, offline and signed-out.
    isSupabaseConfigured: () => false,
    hasCloudSession: () => false,
    storageAdapter: store.adapter,
    logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    now: () => new Date('2025-06-01T09:00:00.000Z'),
    uuid: () => `generated-${++sequence}`,
    userIdService: {
      ensureUserExists: vi.fn(),
      getCurrentDatabaseUserId: () => null,
      getCurrentUserIds: () => ({ clerkId: null, databaseId: null })
    }
  });

  return { port, read: store.read };
};

runDataPortContract('DataPort contract — browser storage', {
  engine: 'browser-storage',
  create: createBrowserStoragePort
});
