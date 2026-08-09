/**
 * The boot, as the app actually runs it.
 *
 * AppContextSupabase.test.tsx exercises the provider's MUTATIONS. This file
 * exercises the one effect that runs before any of them — the load — and it
 * pins the three things about that effect which are invisible in a screenshot
 * and expensive to get wrong:
 *
 *  1. A store that refuses to answer must NOT put a full-page error in front of
 *     somebody whose ledger is fine. The boot has exactly one outer catch, and
 *     everything it can reach has to resolve rather than reject.
 *  2. The account list is read ONCE per boot. It used to be read twice — once
 *     directly, once inside the retired loadAppData — and on a signed-in load
 *     the second read was a whole network round trip whose answer was discarded
 *     unread.
 *  3. The server balances round trip runs ALONGSIDE the transaction load. It
 *     exists to paint real money while ~52 pages of history are in flight, so
 *     the moment it is allowed to delay them it is worse than useless.
 *
 * The data layer is stubbed the way the sibling suite stubs it (in-memory
 * storage, no network) and the port is configured per test through
 * DataService.configure, which is what `dataPort` resolves to.
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { Account } from '../../types';
import type { ServerAccountBalance } from '../../utils/accountBalances';

// Restore the live module (setup.ts registers a global mock for it).
vi.unmock('../AppContextSupabase');

// A signed-in Clerk user, stable across renders: the boot effect depends on
// `user`, so a fresh object per render would re-fire it forever.
vi.mock('@clerk/clerk-react', () => {
  const user = {
    id: 'clerk-user-1',
    emailAddresses: [{ emailAddress: 'boot@example.com' }],
    firstName: 'Boot',
    lastName: 'Test',
  };
  const useUserValue = { user, isLoaded: true };
  return {
    useUser: () => useUserValue,
    useAuth: () => ({ signOut: vi.fn(), getToken: vi.fn() }),
    useSession: () => ({ session: null }),
  };
});

// SupabaseDataLoader only shows its loader and its error page to somebody who
// is signed in; the global setup reports signed OUT, which would make the
// assertions below vacuous.
vi.mock('@/contexts/AuthContext', () => {
  const value = {
    user: { id: 'clerk-user-1' },
    isLoading: false,
    isAuthenticated: true,
    securityScore: 0,
    securityRecommendations: [],
    signOut: vi.fn(),
    refreshSession: vi.fn(),
  };
  return {
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => value,
    useRequireAuth: () => ({ isAuthenticated: true, isLoading: false }),
    usePremiumFeatures: () => ({ hasPasskey: false, hasMFA: false, hasEnhancedSecurity: false }),
  };
});

// The module-level store. PlanningService reads this one directly (it is not
// storage-injectable), so it stays WORKING even in the broken-store test —
// which is what makes that test about the seam rather than about categories.
const memoryStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock('../../services/storageAdapter', () => {
  const adapter = {
    get: async <T,>(key: string): Promise<T | null> =>
      memoryStore.has(key) ? (memoryStore.get(key) as T) : null,
    set: async (key: string, value: unknown): Promise<void> => {
      memoryStore.set(key, value);
    },
    remove: async (key: string): Promise<void> => {
      memoryStore.delete(key);
    },
    clear: async (): Promise<void> => {
      memoryStore.clear();
    },
  };
  return {
    storageAdapter: adapter,
    default: adapter,
    STORAGE_KEYS: {
      ACCOUNTS: 'wealthtracker_accounts',
      TRANSACTIONS: 'wealthtracker_transactions',
      TRANSACTION_SPLITS: 'wealthtracker_transaction_splits',
      BUDGETS: 'wealthtracker_budgets',
      GOALS: 'wealthtracker_goals',
      TAGS: 'wealthtracker_tags',
      RECURRING: 'wealthtracker_recurring',
      CATEGORIES: 'wealthtracker_categories',
      SUGGESTION_DISMISSALS: 'wealthtracker_suggestion_dismissals',
      PREFERENCES: 'wealthtracker_preferences',
    },
  };
});

// The database id resolves (so the boot takes its signed-in branch) but the
// CURRENT id stays null, which keeps every service on its local path and off
// the network — the same trick the sibling suite uses.
vi.mock('../../services/userIdService', () => ({
  userIdService: {
    ensureUserExists: async (): Promise<string> => 'db-user-1',
    getCurrentDatabaseUserId: (): string | null => null,
    getCurrentClerkId: (): string | null => 'clerk-user-1',
    getCurrentUserIds: (): { clerkId: string | null; databaseId: string | null } => ({
      clerkId: 'clerk-user-1',
      databaseId: null,
    }),
    getDatabaseUserId: async (): Promise<string> => 'db-user-1',
    clearCache: (): void => {},
  },
}));

vi.mock('../../services/autoSyncService', () => ({
  default: { initialize: async (): Promise<void> => {} },
}));

// The boot's direct account read, before it was routed through the seam.
// Counted rather than merely stubbed: half of "read once" lives here.
const simpleAccountCalls = vi.hoisted(() => ({ getAccounts: 0 }));

vi.mock('../../services/api/simpleAccountService', () => ({
  getAccounts: async (): Promise<Account[]> => {
    simpleAccountCalls.getAccounts += 1;
    return [];
  },
  subscribeToAccountChanges: async (): Promise<() => void> => () => {},
}));

import { AppProvider, useApp } from '../AppContextSupabase';
import { SupabaseDataLoader } from '../../components/SupabaseDataLoader';
import { DataService } from '../../services/api/dataService';
import { STORAGE_KEYS } from '../../services/storageAdapter';

const localUserIds = {
  ensureUserExists: vi.fn(),
  getCurrentDatabaseUserId: () => null,
  getCurrentUserIds: () => ({ clerkId: 'clerk-user-1', databaseId: null }),
};

/** A store that answers, and counts what it was asked for. */
const countingStore = () => {
  const reads: string[] = [];
  return {
    reads,
    adapter: {
      get: async <T,>(key: string): Promise<T | null> => {
        reads.push(key);
        return memoryStore.has(key) ? (memoryStore.get(key) as T) : null;
      },
      set: async (key: string, value: unknown): Promise<void> => {
        memoryStore.set(key, value);
      },
    },
  };
};

/**
 * The seam's store, broken for every collection except the named ones.
 *
 * Some keys are kept answerable because the boot's reads differ in what they
 * promise. Only two of them promise to resolve whatever happens — the boot's
 * transactions and its split lines — and those are the subject here, so they
 * are the ones left broken. Everything else is answered, because a read that
 * never promised to survive an unopenable store would only be proving that it
 * does not, which is already known and is not what this file is about:
 *
 *  - ACCOUNTS: deliberately not in the never-rejects set. An empty account list
 *    is not a missing optimisation, it is a signed-in person shown a ledger
 *    with no accounts in it (see the test below).
 *  - CATEGORIES, BUDGETS, GOALS: PlanningService's reads, which now come
 *    through the seam as well. They make the same choice the account list does
 *    — a broken store is an error, not an empty budget page — and they used to
 *    sit outside this store only because they reached the module-level adapter
 *    directly, which was an accident of routing rather than a decision.
 */
const refusingEverythingBut = (answerable: readonly string[]) => ({
  isSupabaseConfigured: () => false,
  hasCloudSession: () => false,
  storageAdapter: {
    get: vi.fn(async <T,>(key: string): Promise<T | null> => {
      if (!answerable.includes(key)) {
        throw new Error('The store could not be opened');
      }
      return memoryStore.has(key) ? (memoryStore.get(key) as T) : null;
    }),
    set: vi.fn(async (): Promise<void> => {
      throw new Error('The store could not be opened');
    }),
  },
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  userIdService: localUserIds,
});

/** The seam's store, answering normally from the same in-memory map. */
const workingStore = () => ({
  get: async <T,>(key: string): Promise<T | null> =>
    memoryStore.has(key) ? (memoryStore.get(key) as T) : null,
  set: async (key: string, value: unknown): Promise<void> => {
    memoryStore.set(key, value);
  },
});

/**
 * Every boot read that does NOT promise to resolve when the store refuses.
 * What is left broken is exactly the pair that does.
 */
const READS_THAT_DO_NOT_PRETEND = [
  STORAGE_KEYS.ACCOUNTS,
  STORAGE_KEYS.CATEGORIES,
  STORAGE_KEYS.BUDGETS,
  STORAGE_KEYS.GOALS
] as const;

const wrapper = ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider>;

describe('the boot', () => {
  beforeEach(() => {
    memoryStore.clear();
    simpleAccountCalls.getAccounts = 0;
  });

  afterEach(() => {
    // Hand the singleton back its real dependencies; it outlives a test.
    DataService.configure({});
    vi.restoreAllMocks();
  });

  it('renders the app, not the error page, when the ledger reads refuse to answer', async () => {
    // THE rule this slice is about. The effect's single outer catch sets
    // syncError, and syncError is a full-page "Data Loading Error" with a Retry
    // button — shown to somebody whose data is intact and whose next reload
    // would have worked. The two reads the seam promises will never reject
    // (the boot's transactions, and the split lines) have to keep that promise
    // in composition, not just in the contract suite.
    //
    // The ACCOUNT read is deliberately not in that set, and is answered here.
    // An account list is not an optimisation: a signed-in person shown an empty
    // Accounts page would read it as "my accounts are gone", which is a worse
    // lie than an honest error. It behaves exactly as the direct call it
    // replaced did — see the equivalence pinned in dataService.test.ts.
    //
    // Only the SEAM's store is broken here, and only for the two reads whose
    // promise is the subject. Everything else the boot asks for is answered, so
    // a failure in this test is those two reads' and nobody else's.
    DataService.configure(refusingEverythingBut(READS_THAT_DO_NOT_PRETEND));

    render(
      <AppProvider>
        <SupabaseDataLoader>
          <div>the register</div>
        </SupabaseDataLoader>
      </AppProvider>
    );

    expect(await screen.findByText('the register')).toBeInTheDocument();
    expect(screen.queryByText('Data Loading Error')).not.toBeInTheDocument();
  });

  it('leaves no sync error behind when the ledger reads refuse to answer', async () => {
    DataService.configure(refusingEverythingBut(READS_THAT_DO_NOT_PRETEND));

    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.syncError).toBeNull();
    // An unreadable store means no rows — not a broken app.
    expect(result.current.transactions).toEqual([]);
    expect(result.current.transactionSplits).toEqual([]);
  });

  it('does not let a slow balances round trip hold up the transactions', async () => {
    // The balances call exists to paint real money while ~52 pages of history
    // are still downloading. It is started and deliberately NOT awaited, and
    // the moment anything makes the transaction load wait on it, it has stopped
    // helping and started costing — the exact regression an innocent-looking
    // `await` in front of it would introduce.
    memoryStore.set(STORAGE_KEYS.TRANSACTIONS, [
      {
        id: 'txn-1',
        accountId: 'acct-1',
        amount: -12.5,
        date: '2025-03-04T00:00:00.000Z',
        description: 'Something bought',
        category: 'cat-everyday',
        type: 'expense',
      },
    ]);
    DataService.configure({
      isSupabaseConfigured: () => false,
      hasCloudSession: () => false,
      storageAdapter: workingStore(),
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      userIdService: localUserIds,
    });

    let landBalances!: (balances: ReadonlyMap<string, ServerAccountBalance>) => void;
    const balancesInFlight = new Promise<ReadonlyMap<string, ServerAccountBalance>>(resolve => {
      landBalances = resolve;
    });
    vi.spyOn(DataService, 'getAccountBalances').mockReturnValue(balancesInFlight);

    const { result } = renderHook(() => useApp(), { wrapper });

    // The rows are in state while the balances call is still outstanding.
    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.serverBalances.size).toBe(0);

    await act(async () => {
      landBalances(new Map([['acct-1', { balance: 12.34, txnCount: 1 }]]));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.serverBalances.get('acct-1')?.balance).toBe(12.34);
  });

  it('reads the account list exactly once for a signed-in boot', async () => {
    // Two readers used to answer the same question on every load: the direct
    // account fetch, and the account read buried inside loadAppData. On a
    // signed-in boot the second one was a network round trip that nothing read.
    const store = countingStore();
    memoryStore.set(STORAGE_KEYS.ACCOUNTS, []);
    DataService.configure({
      isSupabaseConfigured: () => false,
      hasCloudSession: () => false,
      storageAdapter: store.adapter,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      userIdService: localUserIds,
    });

    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const accountReads =
      simpleAccountCalls.getAccounts +
      store.reads.filter(key => key === STORAGE_KEYS.ACCOUNTS).length;
    expect(accountReads).toBe(1);
  });
});
