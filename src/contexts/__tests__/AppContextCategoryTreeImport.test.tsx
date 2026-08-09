/**
 * The category tree import, through the seam — an ORDERING test.
 *
 * `importCategoryTree` is four writes and a read whose sequence is the whole of
 * its correctness, and every step of that sequence is there because of a bug:
 *
 *  1. the groups are created FIRST, because a detail cannot be written until
 *     its parent has an id;
 *  2. what came back is committed to state BEFORE the details are attempted,
 *     because a details insert that fails must leave a retry able to re-plan
 *     against the groups that DID land — otherwise the retry re-inserts them,
 *     hits the (user, name, parent) unique constraint, and every attempt fails
 *     until the page is reloaded;
 *  3. the details carry the ids the first write handed back, not ids this
 *     function invented;
 *  4. the prune runs last, and its answer is the STORE's count rather than the
 *     length of the plan;
 *  5. the category set is then RE-READ, and the re-read is what state ends up
 *     holding — because the store may have kept a category the plan wanted
 *     gone, and the optimistic union does not know that.
 *
 * None of it is visible in a diff. A refactor that moved the state commit below
 * the details insert, or that trusted the plan's length, would keep every unit
 * test green and break only in front of somebody importing 700 categories. So
 * the sequence is pinned here, against a stubbed seam that records what it was
 * asked and in what order.
 *
 * The seam is stubbed rather than mocked at the service level deliberately:
 * this file is a test of the CALLER, and it should keep passing unchanged when
 * the implementation behind `dataPort` becomes the local edition.
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type {
  Account,
  Budget,
  Category,
  Goal,
  SuggestionDismissal,
  Transaction,
  TransactionSplit
} from '../../types';
import type {
  AccountBalanceSnapshot,
  BootTransactionsResult,
  DataPort
} from '../../services/port/dataPort';
import type { CategoryTreeGroup } from '../../utils/categoryTreeImport';

// Restore the live module (setup.ts registers a global mock for it).
vi.unmock('../AppContextSupabase');

// A signed-in Clerk user, stable across renders: the boot effect depends on
// `user`, so a fresh object per render would re-fire it forever.
vi.mock('@clerk/clerk-react', () => {
  const user = {
    id: 'clerk-user-1',
    emailAddresses: [{ emailAddress: 'import@example.com' }],
    firstName: 'Import',
    lastName: 'Test',
  };
  const useUserValue = { user, isLoaded: true };
  return {
    useUser: () => useUserValue,
    useAuth: () => ({ signOut: vi.fn(), getToken: vi.fn() }),
    useSession: () => ({ session: null }),
  };
});

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

/**
 * The categories the account already has when the import starts.
 *
 * The two type anchors are not decoration: the planner refuses to run without
 * them (importing a tree with no Income/Expense to hang it from would misfile
 * every group). "Motoring → Fuel" is the overlap the import must SKIP rather
 * than duplicate, and "Old habits → Junk" is what a replace-style import
 * prunes.
 */
const seedCategories = (): Category[] => [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isActive: true },
  { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isActive: true },
  { id: 'sub-motoring', name: 'Motoring', type: 'expense', level: 'sub', parentId: 'type-expense', isActive: true },
  { id: 'detail-fuel', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'sub-motoring', isActive: true },
  { id: 'sub-old', name: 'Old habits', type: 'expense', level: 'sub', parentId: 'type-expense', isActive: true },
  { id: 'detail-junk', name: 'Junk', type: 'expense', level: 'detail', parentId: 'sub-old', isActive: true },
];

const seam = vi.hoisted(() => ({
  /** Every seam call, in the order it was made. */
  calls: [] as string[],
  /** What each `createCategories` call was handed, in order. */
  createCategoriesArgs: [] as Array<Array<Omit<Category, 'id'>>>,
  /** What the prune was handed. */
  pruneArgs: [] as string[][],
  /** Ids minted for created rows, so the caller's use of them is observable. */
  created: [] as Category[],
  /** Set by a test: makes the SECOND bulk create reject. */
  failDetails: false,
  /** What the boot's `prepareCategories` answers with. */
  bootCategories: [] as Category[],
  /** The ledger the boot loads — history is what keeps a category off the plan. */
  transactions: [] as Transaction[],
  /** What the prune's authoritative re-read answers with. */
  authoritativeCategories: [] as Category[],
  /** How many rows the store says it actually removed. */
  prunedCount: 0,
  /**
   * How many times `prepareCategories` has been asked — kept apart from `calls`
   * because that log is cleared once the boot is out of the way, and the boot's
   * ask is precisely what tells the stub which answer it owes.
   */
  prepareCalls: 0,
}));

vi.mock('../../services/port', () => {
  const refuse = (name: string) => async (): Promise<never> => {
    throw new Error(`${name} has no business in a category tree import`);
  };

  let minted = 0;

  const dataPort: DataPort = {
    // Boot reads. Empty on purpose: this test is about the categories.
    getAccounts: async (): Promise<Account[]> => [],
    getClosedAccounts: async (): Promise<Account[]> => [],
    getTransactions: async (): Promise<Transaction[]> => seam.transactions,
    loadBootTransactions: async (): Promise<BootTransactionsResult> => ({
      transactions: seam.transactions,
      stats: {
        cached: 0,
        fetched: seam.transactions.length,
        total: seam.transactions.length,
        fullFetchReason: 'stubbed seam',
      },
    }),
    getAccountBalances: async (): Promise<ReadonlyMap<string, AccountBalanceSnapshot>> => new Map(),
    getAllTransactionSplits: async (): Promise<TransactionSplit[]> => [],
    getTransactionSplits: async (): Promise<TransactionSplit[]> => [],
    getBudgets: async (): Promise<Budget[]> => [],
    getGoals: async (): Promise<Goal[]> => [],
    getCategories: async (): Promise<Category[]> => seam.bootCategories,
    getSuggestionDismissals: async (): Promise<SuggestionDismissal[]> => [],

    // The lifecycle read the import finishes on — and the one the boot starts
    // on. Which answer it gives depends on which it is, and that is exactly the
    // distinction the test asserts.
    prepareCategories: async (): Promise<Category[]> => {
      seam.calls.push('prepareCategories');
      seam.prepareCalls += 1;
      return seam.prepareCalls === 1 ? seam.bootCategories : seam.authoritativeCategories;
    },
    initialize: async (): Promise<void> => {},
    subscribeToUpdates: (): (() => void) => () => {},

    // The operations under test.
    createCategories: async (categories: Array<Omit<Category, 'id'>>): Promise<Category[]> => {
      seam.calls.push('createCategories');
      seam.createCategoriesArgs.push(categories);
      if (seam.failDetails && seam.createCategoriesArgs.length === 2) {
        throw new Error('the details insert failed');
      }
      const rows = categories.map((category): Category => ({
        ...category,
        id: `minted-${++minted}`,
      }));
      seam.created.push(...rows);
      return rows;
    },
    deleteUnusedCategories: async (ids: string[]): Promise<number> => {
      seam.calls.push('deleteUnusedCategories');
      seam.pruneArgs.push(ids);
      return seam.prunedCount;
    },

    // Everything else, refusing by name: an import that reached for one of
    // these would be doing something nobody asked it to.
    createAccount: refuse('createAccount'),
    updateAccount: refuse('updateAccount'),
    deleteAccount: refuse('deleteAccount'),
    createTransaction: refuse('createTransaction'),
    updateTransaction: refuse('updateTransaction'),
    deleteTransaction: refuse('deleteTransaction'),
    setTransactionsCleared: refuse('setTransactionsCleared'),
    applyCategoryToUncategorized: refuse('applyCategoryToUncategorized'),
    confirmTransactionCategories: refuse('confirmTransactionCategories'),
    setTransactionArchived: refuse('setTransactionArchived'),
    archiveTransactionsBefore: refuse('archiveTransactionsBefore'),
    unarchiveAccount: refuse('unarchiveAccount'),
    linkTransferPair: refuse('linkTransferPair'),
    linkSplitLineTransfer: refuse('linkSplitLineTransfer'),
    unlinkTransfers: refuse('unlinkTransfers'),
    repairClaimedTransfer: refuse('repairClaimedTransfer'),
    createTransferCounterpart: refuse('createTransferCounterpart'),
    setTransactionSplits: refuse('setTransactionSplits'),
    createBudget: refuse('createBudget'),
    updateBudget: refuse('updateBudget'),
    deleteBudget: refuse('deleteBudget'),
    createGoal: refuse('createGoal'),
    updateGoal: refuse('updateGoal'),
    deleteGoal: refuse('deleteGoal'),
    createCategory: refuse('createCategory'),
    updateCategory: refuse('updateCategory'),
    deleteCategory: refuse('deleteCategory'),
    mergeCategories: refuse('mergeCategories'),
    dismissSuggestion: refuse('dismissSuggestion'),
    restoreSuggestion: refuse('restoreSuggestion'),
  };

  return { dataPort };
});

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

vi.mock('../../services/api/simpleAccountService', () => ({
  getAccounts: async (): Promise<Account[]> => [],
  subscribeToAccountChanges: async (): Promise<() => void> => () => {},
}));

import { AppProvider, useApp } from '../AppContextSupabase';

const wrapper = ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider>;

/** Two groups: one the account already has, one it does not. */
const tree = (): CategoryTreeGroup[] => [
  { name: 'Motoring', type: 'expense', children: ['Fuel', 'Parking'] },
  { name: 'Household', type: 'expense', children: ['Cleaning'] },
];

const bootedProvider = async () => {
  const { result } = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await waitFor(() => expect(result.current.categories).toHaveLength(seedCategories().length));
  // The boot's own traffic is not what this file is about.
  seam.calls.length = 0;
  return result;
};

describe('importing a category tree, through the seam', () => {
  beforeEach(() => {
    seam.calls.length = 0;
    seam.createCategoriesArgs.length = 0;
    seam.pruneArgs.length = 0;
    seam.created.length = 0;
    seam.failDetails = false;
    seam.bootCategories = seedCategories();
    seam.authoritativeCategories = seedCategories();
    seam.transactions = [];
    seam.prunedCount = 0;
    seam.prepareCalls = 0;
  });

  it('creates the groups, then the details under the ids it was just given', async () => {
    const result = await bootedProvider();

    let imported: Awaited<ReturnType<typeof result.current.importCategoryTree>> | undefined;
    await act(async () => {
      imported = await result.current.importCategoryTree(tree());
    });

    // Two writes, groups before details. Nothing else was touched.
    expect(seam.calls).toEqual(['createCategories', 'createCategories']);

    // The account already had Motoring, so only Household is new.
    expect(seam.createCategoriesArgs[0].map(category => category.name)).toEqual(['Household']);

    // THE POINT OF THE ORDER: each detail hangs off a real id — the existing
    // group's for Parking, and for Cleaning the id the FIRST call handed back a
    // moment ago. A function that wrote the details first, or that invented its
    // own ids, would fail here rather than in a register full of orphans.
    const householdId = seam.created.find(category => category.name === 'Household')?.id;
    expect(householdId).toBeTruthy();
    expect(seam.createCategoriesArgs[1].map(category => [category.name, category.parentId]))
      .toEqual([['Parking', 'sub-motoring'], ['Cleaning', householdId]]);

    // And the count it reports is the group plus the two details it really
    // created, with the overlap skipped rather than duplicated: Motoring and
    // its Fuel were already there, so they are the two it counted as skipped.
    expect(imported).toMatchObject({ created: 3, skipped: 2, pruned: 0, keptForTransactions: 0 });
  });

  it('keeps the groups that landed when the details fail, so a retry re-plans instead of colliding', async () => {
    // The reason the state commit sits BETWEEN the two writes. Without it a
    // retry re-plans against a category list that is missing the groups that
    // really do exist in the store, re-inserts them, and hits the unique
    // constraint — for ever, until the page is reloaded.
    seam.failDetails = true;
    const result = await bootedProvider();

    await act(async () => {
      await expect(result.current.importCategoryTree(tree())).rejects.toThrow('the details insert failed');
    });

    // The group that landed is in state, even though the import as a whole failed.
    expect(result.current.categories.map(category => category.name)).toContain('Household');

    // So the retry asks for no groups at all — the overlap is now complete.
    seam.failDetails = false;
    await act(async () => {
      await result.current.importCategoryTree(tree());
    });

    expect(seam.createCategoriesArgs[2]).toEqual([]);
    expect(seam.createCategoriesArgs[3].map(category => category.name)).toEqual(['Parking', 'Cleaning']);
  });

  it('prunes last, reports the store’s own count, and ends on the re-read rather than its own prediction', async () => {
    // The store kept "Old habits" — something was filed against it after the
    // plan was computed — and removed only its detail. The optimistic union
    // this function could have assembled says otherwise, and the re-read is
    // what wins.
    seam.prunedCount = 1;
    seam.authoritativeCategories = [
      ...seedCategories().filter(category => category.id !== 'detail-junk'),
      { id: 'minted-1', name: 'Household', type: 'expense', level: 'sub', parentId: 'type-expense', isActive: true },
      { id: 'minted-2', name: 'Parking', type: 'expense', level: 'detail', parentId: 'sub-motoring', isActive: true },
      { id: 'minted-3', name: 'Cleaning', type: 'expense', level: 'detail', parentId: 'minted-1', isActive: true },
    ];
    const result = await bootedProvider();

    let imported: Awaited<ReturnType<typeof result.current.importCategoryTree>> | undefined;
    await act(async () => {
      imported = await result.current.importCategoryTree(tree(), { pruneOthers: true });
    });

    // Both creates, then the prune, then the authoritative re-read. The re-read
    // is last because it is the only one whose answer is allowed to be state.
    expect(seam.calls).toEqual([
      'createCategories',
      'createCategories',
      'deleteUnusedCategories',
      'prepareCategories',
    ]);

    // Everything outside the tree was offered up — details before their groups,
    // so a store that judges them in order never sees an orphan.
    expect(seam.pruneArgs).toEqual([['detail-junk', 'sub-old']]);

    // Two ids asked for, one row actually removed: the figure the user is shown
    // is the store's, not the plan's length.
    expect(imported).toMatchObject({ pruned: 1 });

    // And the category the store kept is in state, which only the re-read knew.
    expect(result.current.categories.map(category => category.id)).toContain('sub-old');
    expect(result.current.categories.map(category => category.id)).not.toContain('detail-junk');
  });

  it('never asks the store to remove a category the ledger still points at', async () => {
    // The half the store is never even asked about. A category with history is
    // excluded from the plan up front and counted, so the import can say "kept
    // 1 still in use" — and the store, which re-verifies the rest (B-6), is not
    // handed an id it would have to refuse. An engine with no second opinion to
    // consult, which is what browser storage is, would have done as it was told.
    //
    // And with nothing left to remove, the prune is not called at all: no
    // delete, and therefore no re-read either.
    seam.transactions = [{
      id: 'txn-1',
      accountId: 'acct-1',
      amount: -12.5,
      date: new Date('2025-03-04T12:00:00.000Z'),
      description: 'Something bought',
      category: 'detail-junk',
      type: 'expense',
    }];
    const result = await bootedProvider();

    let imported: Awaited<ReturnType<typeof result.current.importCategoryTree>> | undefined;
    await act(async () => {
      imported = await result.current.importCategoryTree(tree(), { pruneOthers: true });
    });

    expect(imported).toMatchObject({ pruned: 0, keptForTransactions: 1 });
    expect(seam.pruneArgs).toEqual([]);
    expect(seam.calls).toEqual(['createCategories', 'createCategories']);
  });
});
