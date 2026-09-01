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
import { sweepTransferPairs } from '../../utils/transferSweep';
import { readFxRecord } from '../../utils/fx';

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
        // Seven names, because this is the BROWSER's store rather than a file
        // — a device edition answers `[]` here and the difference is what the
        // restore dialog's warning is built from.
        cannotKeep: expect.arrayContaining([
          expect.objectContaining({ entity: 'investments' }),
        ]),
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

    /**
     * The other direction, and the reason it is a method of its own rather
     * than a rename run backwards: a rename collapses many payees into ONE
     * name, so putting it back means giving every row its own wording again.
     * "Rename these ids to X" cannot express that at any batch size.
     *
     * What is pinned here is what reaches the ledger: each row's own text, and
     * a payload that is the description AND NOTHING ELSE. The sweep's undo
     * must never carry a stray field into a financial row on its way past.
     */
    it('puts each row back to its own payee, writing the description and nothing else', async () => {
      const { result } = await renderApp();

      let account!: Account;
      await act(async () => {
        account = await result.current.addAccount(createAccountInput());
      });

      // Three DIFFERENT references for one shop — a fixture where they matched
      // would pass whether the undo respected the rows or not.
      const originals = ['TESCO 1234', 'TESCO STORES 5678', 'TESCO EXPRESS 9012'];
      await act(async () => {
        for (const description of originals) {
          await result.current.addTransaction(
            createTransactionInput(account.id, { description })
          );
        }
      });
      const before = result.current.transactions.map(transaction => ({
        id: transaction.id,
        description: transaction.description,
      }));
      expect(before.map(row => row.description).sort()).toEqual([...originals].sort());

      await act(async () => {
        await result.current.renameTransactionDescriptions(
          before.map(row => row.id),
          'Tesco'
        );
      });
      expect(result.current.transactions.map(t => t.description)).toEqual(['Tesco', 'Tesco', 'Tesco']);

      const writes: Array<{ id: string; updates: unknown }> = [];
      const realUpdate = DataService.updateTransaction.bind(DataService);
      vi.spyOn(DataService, 'updateTransaction').mockImplementation(async (id, updates) => {
        writes.push({ id, updates });
        return await realUpdate(id, updates);
      });

      let restored = 0;
      await act(async () => {
        restored = await result.current.restoreTransactionDescriptions(before);
      });

      expect(restored).toBe(3);
      // One write per row, each carrying that row's own text and no other
      // field: `{ description }`, exactly.
      expect(writes).toEqual(
        before.map(row => ({ id: row.id, updates: { description: row.description } }))
      );
      // And the register agrees — three payees, not one name three times.
      expect(new Map(
        result.current.transactions.map(t => [t.id, t.description])
      )).toEqual(new Map(before.map(row => [row.id, row.description])));
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
     * THE UNLOCK BUG, in the place it actually bit — and the law that followed.
     *
     * The store had always unlinked the survivor — the cloud through
     * transactions_linked_transfer_id_fkey (ON DELETE SET NULL), browser
     * storage once its own mirror was written — but the provider only FILTERED
     * the deleted row out of state and left the survivor's linkedTransferId
     * pointing at it. Every screen reads state, so until the next boot the
     * survivor still looked like half of a pair.
     *
     * Unlinking alone was never the whole answer, though, and this is where the
     * rest of it is proved: a transfer must have another side or it is not a
     * transfer. The survivor is RELEASED — typed by the direction of its own
     * money, its To/From category cleared, marked for review — so it stops
     * being a row that moves a balance while counting as neither income nor
     * spending in any report and never reaching the review band either.
     *
     * This is the ONE place the release is applied, so it is the one place it
     * is proved end to end, against a real store.
     */
    const buildLinkedPair = async (
      result: { current: ReturnType<typeof useApp> },
      sourceAmount: number
    ): Promise<{ sourceId: string; counterpartId: string; to: Account }> => {
      let from!: Account;
      let to!: Account;
      await act(async () => {
        from = await result.current.addAccount(createAccountInput());
        to = await result.current.addAccount(createAccountInput({ name: 'Savings' }));
      });

      await act(async () => {
        await result.current.addTransaction(
          createTransactionInput(from.id, { amount: sourceAmount, description: 'Transfer out' })
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

      return { sourceId, counterpartId, to };
    };

    it('deleting one leg RELEASES the survivor: unlinked, re-typed, uncategorised', async () => {
      const { result } = await renderApp();
      const { sourceId, counterpartId } = await buildLinkedPair(result, -500);

      await act(async () => {
        await result.current.deleteTransaction(counterpartId);
      });

      const survivor = result.current.transactions.find(t => t.id === sourceId)!;
      // No dangling pointer, so the row is re-pointable again.
      expect(survivor.linkedTransferId).toBeUndefined();
      // Money out becomes a plain expense…
      expect(survivor.type).toBe('expense');
      // …with nothing left claiming it is half of a movement.
      expect(survivor.category).toBe('');
      expect(survivor.transferAccountId).toBeFalsy();
      // Marked for review, because the work is in an account the user may not
      // be looking at, and the blank is a decision rather than a guess.
      expect(survivor.needsReview).toBe(true);
      expect(survivor.categoryConfirmed).toBe(true);
      // Nothing about the money itself moved.
      expect(survivor.amount).toBe(-500);
      expect(result.current.accounts[0].balance).toBe(500);
    });

    it('releases a money-IN survivor as income — the direction decides', async () => {
      const { result } = await renderApp();
      // The source is the money-IN leg this time, so the counterpart is money
      // out; deleting the counterpart leaves the +500 row behind.
      const { sourceId, counterpartId } = await buildLinkedPair(result, 500);

      await act(async () => {
        await result.current.deleteTransaction(counterpartId);
      });

      const survivor = result.current.transactions.find(t => t.id === sourceId)!;
      expect(survivor.type).toBe('income');
      expect(survivor.category).toBe('');
      expect(survivor.linkedTransferId).toBeUndefined();
    });

    it('reports the released survivor to its caller, so a pair delete can be honest', async () => {
      const { result } = await renderApp();
      const { sourceId, counterpartId } = await buildLinkedPair(result, -500);

      let outcome!: Awaited<ReturnType<typeof result.current.deleteTransaction>>;
      await act(async () => {
        outcome = await result.current.deleteTransaction(counterpartId);
      });

      expect(outcome.survivors).toEqual([
        { transactionId: sourceId, accountId: result.current.accounts[0].id, released: true },
      ]);
    });

    it('reports no survivors for an ordinary row', async () => {
      const { result } = await renderApp();

      let account!: Account;
      await act(async () => {
        account = await result.current.addAccount(createAccountInput());
      });
      await act(async () => {
        await result.current.addTransaction(createTransactionInput(account.id, { amount: -12.5 }));
      });
      const id = result.current.transactions[0].id;

      let outcome!: Awaited<ReturnType<typeof result.current.deleteTransaction>>;
      await act(async () => {
        outcome = await result.current.deleteTransaction(id);
      });

      expect(outcome.survivors).toEqual([]);
    });

    it('deleting BOTH legs leaves nothing behind and puts both balances back', async () => {
      const { result } = await renderApp();
      const { sourceId, counterpartId } = await buildLinkedPair(result, -500);
      const openingFrom = 1000;

      // What the dialog's "Delete both sides" does: the same audited delete,
      // twice, the leg the user was looking at first.
      await act(async () => {
        await result.current.deleteTransaction(sourceId);
        await result.current.deleteTransaction(counterpartId);
      });

      expect(result.current.transactions).toHaveLength(0);
      expect(result.current.accounts[0].balance).toBe(openingFrom);
      expect(result.current.accounts[1].balance).toBe(openingFrom);
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

  /**
   * ── THE WHOLE CHAIN, FROM MATCHER TO RECEIPT ──────────────────────────────
   *
   * The cross-currency matcher's output is only worth anything if ACCEPTING it
   * records the rate. That is not a property of the matcher and not a property
   * of the UI: every link in the product goes through this provider's
   * `linkTransferPair`, which derives the rate from the two amounts and stamps
   * `metadata.fx` on both legs.
   *
   * So this test runs the real matcher over the real provider's state, feeds
   * its suggestion straight back into the real `linkTransferPair`, and reads
   * the stamp out of the resulting state. Nothing between the sweep and the
   * receipt is stubbed, which is the only way to know the two ends are actually
   * joined — reading the code and finding a call to the right function proves
   * that the code says so, not that it happens.
   */
  describe('accepting a cross-currency suggestion', () => {
    it('links the pair the sweep offers and records the rate it implies', async () => {
      const { result } = await renderApp();

      let sterling!: Account;
      let dollars!: Account;
      await act(async () => {
        sterling = await result.current.addAccount(createAccountInput({
          name: 'Everyday Current', currency: 'GBP',
        }));
        dollars = await result.current.addAccount(createAccountInput({
          name: 'Dollar Savings', currency: 'USD',
        }));
      });

      // The two sides of one conversion: opposite in sign, magnitudes that no
      // amount bucket could ever have matched, a day apart.
      let out!: Transaction;
      let into!: Transaction;
      await act(async () => {
        out = await result.current.addTransaction(createTransactionInput(sterling.id, {
          description: 'Transfer to dollar savings',
          amount: -100,
          category: '',
          date: new Date('2025-02-10T00:00:00Z'),
        }));
        into = await result.current.addTransaction(createTransactionInput(dollars.id, {
          description: 'Incoming transfer',
          amount: 136.25,
          type: 'income',
          category: '',
          date: new Date('2025-02-11T00:00:00Z'),
        }));
      });

      // The matcher, on the state the app actually holds.
      const { suggestions } = sweepTransferPairs(result.current.transactions, {
        accounts: result.current.accounts,
      });
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].crossCurrency).toEqual({ from: 'GBP', to: 'USD' });
      expect(suggestions[0].outgoing.id).toBe(out.id);
      expect(suggestions[0].incoming.id).toBe(into.id);

      // Accepted exactly as the sweep's Apply accepts one.
      await act(async () => {
        await result.current.linkTransferPair(
          suggestions[0].outgoing.id,
          suggestions[0].incoming.id
        );
      });

      const linkedOut = result.current.transactions.find(t => t.id === out.id);
      const linkedIn = result.current.transactions.find(t => t.id === into.id);
      expect(linkedOut?.linkedTransferId).toBe(into.id);
      expect(linkedIn?.linkedTransferId).toBe(out.id);

      const fxOut = readFxRecord(linkedOut?.metadata);
      const fxIn = readFxRecord(linkedIn?.metadata);

      // 'derived', never 'api' or 'manual': nobody was asked and nobody had to
      // be. Both amounts were already real, so their ratio is the rate the
      // money actually got, spread and fees included.
      expect(fxOut?.source).toBe('derived');
      // 136.25 / 100 — destination units per one source unit, exact.
      expect(fxOut?.rate).toBe('1.3625');
      // The rate is a property of the CONVERSION, not of either row, so two
      // legs disagreeing about it would have no correct reading.
      expect(fxIn).toEqual(fxOut);
    });

    it('records nothing when the two accounts share a currency', async () => {
      const { result } = await renderApp();

      let one!: Account;
      let two!: Account;
      await act(async () => {
        one = await result.current.addAccount(createAccountInput({ name: 'A', currency: 'GBP' }));
        two = await result.current.addAccount(createAccountInput({ name: 'B', currency: 'GBP' }));
      });

      let out!: Transaction;
      let into!: Transaction;
      await act(async () => {
        out = await result.current.addTransaction(createTransactionInput(one.id, {
          amount: -100, category: '', date: new Date('2025-02-10T00:00:00Z'),
        }));
        into = await result.current.addTransaction(createTransactionInput(two.id, {
          amount: 100, type: 'income', category: '', date: new Date('2025-02-10T00:00:00Z'),
        }));
      });

      await act(async () => {
        await result.current.linkTransferPair(out.id, into.id);
      });

      // Nothing was converted, so a rate of 1 would be a fact about arithmetic
      // rather than about money.
      expect(readFxRecord(result.current.transactions.find(t => t.id === out.id)?.metadata)).toBeNull();
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
