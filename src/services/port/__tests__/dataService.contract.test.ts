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
import type { DataPort } from '../dataPort';
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
    [STORAGE_KEYS.GOALS, [...(fixture.goals ?? [])]],
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
      goals: collection(STORAGE_KEYS.GOALS),
      dismissals: collection(STORAGE_KEYS.SUGGESTION_DISMISSALS)
    })
  };
};

/**
 * PlanningService, refusing to answer.
 *
 * Budgets, goals and categories are the one part of the seam whose CLOUD half
 * lives in another service — and that service is not storage-injectable: it
 * reads the module-level adapter directly, which is a store this harness does
 * not own and cannot reset between tests. So it is stubbed out entirely, and
 * stubbed to REFUSE rather than to answer.
 *
 * That is the whole point of it. The harness declares `engine:
 * 'browser-storage'`, and this is what makes the declaration checkable: if a
 * routing change ever sent one of these operations down the cloud branch, the
 * contract suite would stop describing the engine it claims to describe. A
 * double that quietly answered would let that happen in silence; this one
 * fails, by name, on the call that strayed.
 *
 * The WRITES matter here more than the reads: a budget write that took the
 * cloud branch under a harness with no cloud would not merely answer wrongly,
 * it would leave the store this suite then asserts against untouched — a
 * failure that reads like a broken assertion rather than a broken route. This
 * makes it say which call went the wrong way.
 */
const refusingPlanningService = () => {
  const refuse = async (): Promise<never> => {
    throw new Error(
      'The browser-storage engine must not reach PlanningService — this call took the cloud branch'
    );
  };
  return {
    mergeCategories: vi.fn(refuse),
    createBudget: vi.fn(refuse),
    updateBudget: vi.fn(refuse),
    deleteBudget: vi.fn(refuse),
    createGoal: vi.fn(refuse),
    updateGoal: vi.fn(refuse),
    deleteGoal: vi.fn(refuse),
    createCategory: vi.fn(refuse),
    createCategories: vi.fn(refuse),
    updateCategory: vi.fn(refuse),
    deleteCategory: vi.fn(refuse),
    deleteUnusedCategories: vi.fn(refuse),
    getBudgets: vi.fn(refuse),
    getGoals: vi.fn(refuse),
    ensureCategories: vi.fn(refuse)
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
    planningService: refusingPlanningService(),
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

/**
 * The same engine with its floor removed: every read of the store refuses.
 *
 * This is what a browser whose IndexedDB will not open actually looks like from
 * here, and it is the only way to ask the boot reads whether they really do
 * resolve instead of rejecting.
 */
const createUnreadableBrowserStoragePort = async (): Promise<DataPort> => {
  const refuse = async (): Promise<never> => {
    throw new Error('The store could not be opened');
  };

  return createDataService({
    isSupabaseConfigured: () => false,
    hasCloudSession: () => false,
    storageAdapter: { get: vi.fn(refuse), set: vi.fn(refuse) },
    planningService: refusingPlanningService(),
    logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    now: () => new Date('2025-06-01T09:00:00.000Z'),
    uuid: () => 'generated-1',
    userIdService: {
      ensureUserExists: vi.fn(),
      getCurrentDatabaseUserId: () => null,
      getCurrentUserIds: () => ({ clerkId: null, databaseId: null })
    }
  });
};

runDataPortContract('DataPort contract — browser storage', {
  engine: 'browser-storage',
  create: createBrowserStoragePort,
  createUnreadable: createUnreadableBrowserStoragePort
});
