/**
 * AppContextSupabase (LIVE provider) mutation tests
 *
 * THE SIGNED CONVENTION (the live model):
 * - Transactions store SIGNED amounts: expenses NEGATIVE (-150 for a £150
 *   expense), income POSITIVE, transfers signed by direction
 *   (see src/utils/transactionAmount.ts).
 * - Account balance = openingBalance + Σ(signed amounts) — a single signed
 *   sum, no per-type add/subtract branches.
 *
 * The global test setup (src/test/setup.ts) swaps this module for a static
 * mock so page-level suites render against canned data. These tests exercise
 * the REAL AppProvider/useApp, so the module is unmocked below and the data
 * layer is stubbed instead (in-memory storage + local-only service ids), the
 * same way TransactionContext.test.tsx / AccountContext.test.tsx stub theirs.
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Account, Transaction } from '../../types';
import { toDecimal } from '../../utils/decimal';
import { signTransactionAmount } from '../../utils/transactionAmount';

// Restore the live module (setup.ts registers a global mock for it).
vi.unmock('../AppContextSupabase');

// Signed-in Clerk user (overrides the signed-out stub from the global setup)
// so account mutations run their real authenticated code paths. The value is
// a stable singleton: AppProvider's init effect depends on `user`, so a fresh
// object per render would re-fire it forever.
vi.mock('@clerk/clerk-react', () => {
  const user = {
    id: 'clerk-user-1',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    firstName: 'Test',
    lastName: 'User',
  };
  const useUserValue = { user, isLoaded: true };
  return {
    useUser: () => useUserValue,
    useAuth: () => ({ signOut: vi.fn(), getToken: vi.fn() }),
    useSession: () => ({ session: null }),
  };
});

// In-memory store backing the DataService/PlanningService local fallback.
const memoryStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock('../../services/storageAdapter', () => {
  /**
   * A stored row stops being the caller's object, which is the one thing a
   * store must not get wrong here.
   *
   * The real adapter writes through IndexedDB, so what goes in is cloned and
   * what comes out is a fresh object every time. A double that keeps the
   * reference it was handed pretends that boundary is not there — and the
   * difference is not academic: the local balance update reads the account
   * list and adjusts the balance ON the row it was given (dataService's
   * updateAccountBalance), while the row a create returned is the same object
   * the provider has just put into React state. Sharing it lets one write land
   * twice — once in the store, once again when the provider adds its
   * optimistic adjustment on top of a figure that had already moved.
   *
   * Rows only, and by hand rather than through structuredClone: the suite runs
   * on vitest's mocked clock, whose Date is a subclass of the real one, and a
   * structured clone hands back native Dates that `instanceof Date` then
   * denies.
   */
  const storedCopy = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(row => (row && typeof row === 'object' && !Array.isArray(row) ? { ...row } : row))
      : value;

  const adapter = {
    get: async <T,>(key: string): Promise<T | null> =>
      memoryStore.has(key) ? (storedCopy(memoryStore.get(key)) as T) : null,
    set: async (key: string, value: unknown): Promise<void> => {
      memoryStore.set(key, storedCopy(value));
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
      BUDGETS: 'wealthtracker_budgets',
      GOALS: 'wealthtracker_goals',
      TAGS: 'wealthtracker_tags',
      RECURRING: 'wealthtracker_recurring',
      CATEGORIES: 'wealthtracker_categories',
      PREFERENCES: 'wealthtracker_preferences',
      THEME: 'money_management_theme',
      ACCENT_COLOR: 'money_management_accent_color',
      NOTIFICATIONS: 'money_management_notifications',
      BUDGET_ALERTS: 'money_management_budget_alerts_enabled',
      ALERT_THRESHOLD: 'money_management_alert_threshold',
      LARGE_TRANSACTION_ALERTS: 'money_management_large_transaction_alerts_enabled',
      LARGE_TRANSACTION_THRESHOLD: 'money_management_large_transaction_threshold',
    },
  };
});

// Keep the database user id null so DataService/PlanningService stay on the
// local (in-memory) fallback path — Supabase is never exercised in jsdom.
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
  default: {
    initialize: async (): Promise<void> => {},
  },
}));

import { AppProvider, useApp } from '../AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import type { AccountBalanceSnapshot } from '../../services/port';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

const createAccountInput = (
  overrides: Partial<Omit<Account, 'id'>> = {}
): Omit<Account, 'id'> => ({
  name: 'Everyday Current',
  type: 'current',
  balance: 1000,
  currency: 'GBP',
  lastUpdated: new Date('2025-01-19T00:00:00Z'),
  openingBalance: 1000,
  ...overrides,
});

const createTransactionInput = (
  accountId: string,
  overrides: Partial<Omit<Transaction, 'id'>> = {}
): Omit<Transaction, 'id'> => ({
  date: new Date('2025-01-15T00:00:00Z'),
  description: 'Groceries',
  // SIGNED convention: expenses are stored negative.
  amount: signTransactionAmount(150, 'expense'),
  type: 'expense',
  category: 'groceries',
  accountId,
  ...overrides,
});

/**
 * The invariant under test, expressed as production code expresses it:
 * one Decimal sum of signed amounts on top of the opening balance —
 * NO switch on transaction type.
 */
const signedBalance = (
  openingBalance: number,
  transactions: ReadonlyArray<Pick<Transaction, 'amount'>>
): number =>
  transactions
    .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(openingBalance))
    .toNumber();

const renderApp = async () => {
  const utils = renderHook(() => useApp(), { wrapper });
  await waitFor(() => {
    expect(utils.result.current.isLoading).toBe(false);
  });
  return utils;
};

describe('AppContextSupabase live provider', () => {
  beforeEach(() => {
    memoryStore.clear();

    // The one hole in this suite's "no network" stubbing, and every boot below
    // fell through it.
    //
    // The mocks above keep the data layer local by holding the database user id
    // at null. The balances round trip does not consult that id: DataService
    // gates it on `isSupabaseConfigured()` alone, which is TRUE here because the
    // test environment supplies VITE_SUPABASE_URL/ANON_KEY, so a real PostgREST
    // client issued `rpc('account_balances')` on all fourteen boots. It only
    // ever returned empty because the global setup replaces `fetch` with a stub
    // that fails instantly — determinism borrowed from an ambient mock rather
    // than stated here, and `renderApp` awaits this call (the boot's last
    // await) before isLoading drops.
    //
    // An empty map is what the real call returns in local mode anyway: the app
    // then sums the rows itself, which is the source of truth. Balance seeding
    // is pinned where it belongs, in AppContextBoot.test.tsx.
    vi.spyOn(DataService, 'getAccountBalances').mockResolvedValue(
      new Map<string, AccountBalanceSnapshot>()
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialisation (local fallback in jsdom)', () => {
    it('mounts with empty data, and describes itself as the device it is', async () => {
      const { result } = await renderApp();

      expect(result.current.accounts).toEqual([]);
      expect(result.current.transactions).toEqual([]);
      // This suite arranges exactly the engine the descriptor should report:
      // no database id, no cloud session. Asserted as the WHOLE descriptor
      // rather than one field of it, because the boot surfaces it in one go and
      // a single field would let the other four rot — `maxConcurrentWrites`
      // above all, which the payee rename divides its work by. The retired
      // `isUsingSupabase: false` this replaced is the `edition`/`realtime` pair.
      expect(result.current.capabilities).toEqual({
        edition: 'device',
        session: 'anonymous',
        realtime: false,
        maxConcurrentWrites: 1,
        backupTarget: 'device',
      });
      // Default categories are seeded even with empty storage.
      expect(result.current.categories.length).toBeGreaterThan(0);
    });
  });

  describe('account mutations', () => {
    it('addAccount adds the account to state with its opening balance', async () => {
      const { result } = await renderApp();

      let created!: Account;
      await act(async () => {
        created = await result.current.addAccount(createAccountInput());
      });

      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0].id).toBe(created.id);
      expect(result.current.accounts[0].name).toBe('Everyday Current');
      expect(result.current.accounts[0].balance).toBe(1000);
    });

    it('closeAccount takes the account and its transactions out of the live lists', async () => {
      const { result } = await renderApp();

      let doomed!: Account;
      let kept!: Account;
      await act(async () => {
        doomed = await result.current.addAccount(createAccountInput({ name: 'Doomed' }));
        kept = await result.current.addAccount(createAccountInput({ name: 'Kept', balance: 500 }));
      });

      await act(async () => {
        await result.current.addTransaction(createTransactionInput(doomed.id));
        await result.current.addTransaction(
          createTransactionInput(kept.id, {
            description: 'Salary',
            amount: signTransactionAmount(200, 'income'),
            type: 'income',
            category: 'salary',
          })
        );
      });
      expect(result.current.transactions).toHaveLength(2);

      await act(async () => {
        await result.current.closeAccount(doomed.id);
      });

      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0].id).toBe(kept.id);
      // The closed account's transactions go out of view with it (they are
      // still in the store — a close is not a delete); others survive.
      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.transactions[0].accountId).toBe(kept.id);
    });
  });

  describe('the payee rename, and how many writes it puts in flight', () => {
    it('writes strictly one at a time on a store that says one at a time', async () => {
      // WHY THIS IS A TEST AND NOT AN OBSERVATION. The rename divides its work
      // by `capabilities().maxConcurrentWrites`, and this suite's engine is the
      // browser store — where a write re-reads and re-persists the WHOLE
      // collection. Two in flight there is a lost-update race: the second write
      // was built from a snapshot taken before the first landed, so it puts the
      // first one's row back the way it was and the rename silently un-happens
      // for that transaction.
      //
      // The number itself is pinned beside the engine (dataService.test.ts,
      // "what this engine says it can do"). What is pinned HERE is the wiring:
      // that the loop actually obeys the limit rather than merely being handed
      // it. Concurrency is measured rather than inferred — a spy that counts
      // how many calls are in flight at their peak.
      const { result } = await renderApp();

      let account!: Account;
      await act(async () => {
        account = await result.current.addAccount(createAccountInput());
      });

      await act(async () => {
        for (const description of ['TESCO 1234', 'TESCO 5678', 'TESCO 9012']) {
          await result.current.addTransaction(
            createTransactionInput(account.id, { description })
          );
        }
      });
      const ids = result.current.transactions.map(transaction => transaction.id);
      expect(ids).toHaveLength(3);

      let inFlight = 0;
      let peak = 0;
      const realUpdate = DataService.updateTransaction.bind(DataService);
      vi.spyOn(DataService, 'updateTransaction').mockImplementation(async (id, updates) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        // A real await between entry and exit, so two overlapping calls would
        // genuinely overlap rather than run to completion synchronously.
        await Promise.resolve();
        try {
          return await realUpdate(id, updates);
        } finally {
          inFlight -= 1;
        }
      });

      let renamed = 0;
      await act(async () => {
        renamed = await result.current.renameTransactionDescriptions(ids, 'Tesco');
      });

      expect(renamed).toBe(3);
      expect(peak).toBe(1);
      expect(result.current.transactions.map(t => t.description)).toEqual(['Tesco', 'Tesco', 'Tesco']);
    });
  });

  describe('transaction mutations (SIGNED amounts)', () => {
    it('addTransaction with a -150 expense DECREASES the balance by 150', async () => {
      const { result } = await renderApp();

      let account!: Account;
      await act(async () => {
        account = await result.current.addAccount(createAccountInput());
      });

      await act(async () => {
        await result.current.addTransaction(
          createTransactionInput(account.id, { amount: -150 })
        );
      });

      expect(result.current.transactions).toHaveLength(1);
      // Stored signed, exactly as given — never flipped to a magnitude.
      expect(result.current.transactions[0].amount).toBe(-150);
      expect(result.current.accounts[0].balance).toBe(850);
    });

    it('addTransaction with a +200 income INCREASES the balance by 200', async () => {
      const { result } = await renderApp();

      let account!: Account;
      await act(async () => {
        account = await result.current.addAccount(createAccountInput());
      });

      await act(async () => {
        await result.current.addTransaction(
          createTransactionInput(account.id, {
            description: 'Salary',
            amount: 200,
            type: 'income',
            category: 'salary',
          })
        );
      });

      expect(result.current.transactions[0].amount).toBe(200);
      expect(result.current.accounts[0].balance).toBe(1200);
    });

    it('deleteTransaction of a -150 expense RAISES the balance by 150', async () => {
      const { result } = await renderApp();

      let account!: Account;
      await act(async () => {
        account = await result.current.addAccount(createAccountInput());
      });

      await act(async () => {
        await result.current.addTransaction(
          createTransactionInput(account.id, { amount: -150 })
        );
      });
      expect(result.current.accounts[0].balance).toBe(850);

      const transactionId = result.current.transactions[0].id;
      await act(async () => {
        await result.current.deleteTransaction(transactionId);
      });

      expect(result.current.transactions).toHaveLength(0);
      expect(result.current.accounts[0].balance).toBe(1000);
    });

    /**
     * THE UNLOCK BUG, in the place it actually bit.
     *
     * The store had always done the right thing — the cloud through
     * transactions_linked_transfer_id_fkey (ON DELETE SET NULL), browser
     * storage once its own mirror was written — but the provider only FILTERED
     * the deleted row out of state and left the survivor's linkedTransferId
     * pointing at it. Every screen reads state, so until the next boot the
     * survivor still looked like half of a pair: the editor went on refusing to
     * move it ("delete the transfer and recreate it") and the register went on
     * offering to jump to a transaction that no longer existed. The only exit
     * anybody found was to delete the survivor as well, which is how an
     * imported row gets destroyed to fix a category.
     */
    it('deleting one leg of a transfer leaves the survivor UNLINKED in state', async () => {
      const { result } = await renderApp();

      let from!: Account;
      let to!: Account;
      await act(async () => {
        from = await result.current.addAccount(createAccountInput());
        to = await result.current.addAccount(createAccountInput({ name: 'Savings' }));
      });

      await act(async () => {
        await result.current.addTransaction(
          createTransactionInput(from.id, { amount: -500, description: 'Transfer out' })
        );
      });
      const sourceId = result.current.transactions[0].id;

      // The other side, created by the app and linked to it.
      await act(async () => {
        await result.current.createTransferCounterpart(sourceId, to.id);
      });
      const counterpartId = result.current.transactions.find(t => t.id !== sourceId)!.id;
      expect(
        result.current.transactions.find(t => t.id === sourceId)?.linkedTransferId
      ).toBe(counterpartId);

      await act(async () => {
        await result.current.deleteTransaction(counterpartId);
      });

      const survivor = result.current.transactions.find(t => t.id === sourceId)!;
      // THE FIX: no dangling pointer, so the row is re-pointable again.
      expect(survivor.linkedTransferId).toBeUndefined();
      // …and nothing else changed. It is an UNMATCHED leg, which is a real
      // state with a repair flow, not something to re-type on the user's behalf.
      expect(survivor.type).toBe('transfer');
      expect(survivor.transferAccountId).toBe(to.id);
      expect(survivor.amount).toBe(-500);
    });

    it('updateTransaction changing -100 → -150 LOWERS the balance by 50', async () => {
      const { result } = await renderApp();

      let account!: Account;
      await act(async () => {
        account = await result.current.addAccount(createAccountInput());
      });

      await act(async () => {
        await result.current.addTransaction(
          createTransactionInput(account.id, { amount: -100 })
        );
      });
      expect(result.current.accounts[0].balance).toBe(900);

      const transactionId = result.current.transactions[0].id;
      await act(async () => {
        await result.current.updateTransaction(transactionId, { amount: -150 });
      });

      expect(result.current.transactions[0].amount).toBe(-150);
      // Difference applied is -50 (from -100 to -150): 900 → 850.
      expect(result.current.accounts[0].balance).toBe(850);
    });

    it('updateTransaction without an amount change leaves the balance untouched', async () => {
      const { result } = await renderApp();

      let account!: Account;
      await act(async () => {
        account = await result.current.addAccount(createAccountInput());
      });

      await act(async () => {
        await result.current.addTransaction(
          createTransactionInput(account.id, { amount: -150 })
        );
      });

      const transactionId = result.current.transactions[0].id;
      await act(async () => {
        await result.current.updateTransaction(transactionId, {
          description: 'Groceries (Tesco)',
        });
      });

      expect(result.current.transactions[0].description).toBe('Groceries (Tesco)');
      expect(result.current.accounts[0].balance).toBe(850);
    });

    it('keeps balance = opening + Σ(signed amounts) across a mixed flow', async () => {
      const { result } = await renderApp();

      let account!: Account;
      await act(async () => {
        account = await result.current.addAccount(createAccountInput());
      });

      await act(async () => {
        await result.current.addTransaction(
          createTransactionInput(account.id, { amount: -150 })
        );
        await result.current.addTransaction(
          createTransactionInput(account.id, {
            description: 'Salary',
            amount: 200,
            type: 'income',
            category: 'salary',
          })
        );
        await result.current.addTransaction(
          createTransactionInput(account.id, {
            description: 'Coffee',
            amount: -50,
          })
        );
      });

      // 1000 - 150 + 200 - 50 — one signed sum, no per-type branching.
      expect(result.current.accounts[0].balance).toBe(1000);
      expect(result.current.accounts[0].balance).toBe(
        signedBalance(1000, result.current.transactions)
      );
    });
  });
});

describe('signed balance invariant (pure)', () => {
  it('signs amounts by type: expense negative, income positive, transfer by direction', () => {
    expect(signTransactionAmount(150, 'expense')).toBe(-150);
    expect(signTransactionAmount(200, 'income')).toBe(200);
    expect(signTransactionAmount(75, 'transfer', true)).toBe(-75);
    expect(signTransactionAmount(25, 'transfer', false)).toBe(25);
    // Sign is applied to the magnitude even if the input arrives negative.
    expect(signTransactionAmount(-150, 'expense')).toBe(-150);
    expect(signTransactionAmount(-200, 'income')).toBe(200);
  });

  it('balance = opening + Σ signed amounts with mixed types', () => {
    const transactions = [
      { amount: signTransactionAmount(150, 'expense') }, // -150
      { amount: signTransactionAmount(200, 'income') }, // +200
      { amount: signTransactionAmount(49.99, 'expense') }, // -49.99
      { amount: signTransactionAmount(75, 'transfer', true) }, // -75 out
      { amount: signTransactionAmount(25, 'transfer', false) }, // +25 in
    ];

    // 1000 - 150 + 200 - 49.99 - 75 + 25 = 950.01
    expect(signedBalance(1000, transactions)).toBe(950.01);
  });

  it('credit account with a NEGATIVE opening balance stays a plain signed sum', () => {
    const transactions = [
      { amount: signTransactionAmount(150, 'expense') }, // -150 purchase
      { amount: signTransactionAmount(300, 'income') }, // +300 repayment
    ];

    // -500 - 150 + 300 = -350: the liability stays negative.
    expect(signedBalance(-500, transactions)).toBe(-350);
  });

  it('sums with Decimal precision (no IEEE-754 drift)', () => {
    // 0.1 + 0.2 !== 0.3 in raw float arithmetic; Decimal must land exactly.
    expect(signedBalance(0, [{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
    expect(signedBalance(1000.1, [{ amount: -0.3 }])).toBe(999.8);
  });

  it('aggregates display positive magnitudes from signed rows', () => {
    const rows = [
      { amount: -150, type: 'expense' as const },
      { amount: -49.99, type: 'expense' as const },
      { amount: 200, type: 'income' as const },
    ];

    const totalExpenses = rows
      .filter(r => r.type === 'expense')
      .reduce((sum, r) => sum.plus(toDecimal(Math.abs(r.amount))), toDecimal(0))
      .toNumber();
    const totalIncome = rows
      .filter(r => r.type === 'income')
      .reduce((sum, r) => sum.plus(toDecimal(r.amount)), toDecimal(0))
      .toNumber();
    const netIncome = toDecimal(totalIncome).minus(toDecimal(totalExpenses)).toNumber();

    expect(totalExpenses).toBe(199.99);
    expect(totalIncome).toBe(200);
    expect(netIncome).toBe(0.01);
  });
});
