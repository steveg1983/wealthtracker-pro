/**
 * The boot with the seam stubbed out entirely — the one-door proof.
 *
 * AppContextBoot.test.tsx drives the boot through the REAL DataService with a
 * fake store underneath it, which is the right shape for asking whether that
 * implementation behaves. This file asks a different question, and it is the
 * question the whole seam exists for:
 *
 *   Is every piece of financial state the app boots with actually coming
 *   through `dataPort`, or is some of it still arriving by a side door?
 *
 * So there is no store here at all. `../../services/port` is replaced with a
 * stub whose answers are unmistakable — 'acct-from-the-seam',
 * 'txn-from-the-seam' — and the assertion is that all of them turn up in app
 * state. Anything that did NOT come through the door would arrive as an empty
 * array instead, because nothing else is wired to anything.
 *
 * This is deliberately the test Phase 3's local implementation boots against:
 * swap the stub for LocalDataPort, keep every assertion, and a green run says
 * the app came up on the local edition.
 *
 * The stub is typed `DataPort`, and that annotation is NOT what keeps it
 * complete: `tsc -b` never compiles this file (tsconfig.app.json excludes
 * tests), so an operation could join the seam and leave the stub silently short
 * of it. What keeps it complete is the last test in this file, which holds the
 * stub's key set against `DATA_PORT_OPERATIONS` — the seam's own list, kept
 * beside the contract suite.
 *
 * NOT through the door yet, and deliberately named so the silence is not read
 * as a claim: the real-time subscriptions, and the suggestion dismissals, which
 * are not a boot read at all (they load on demand). `isUsingSupabase` used to
 * be on this list; it is gone from the app entirely, and the stub answers the
 * capability descriptor that replaced it.
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type {
  Account,
  Budget,
  Category,
  Goal,
  Transaction,
  TransactionSplit
} from '../../types';
import type { AccountBalanceSnapshot, DataPort } from '../../services/port/dataPort';
import { DATA_PORT_OPERATIONS } from '../../services/port/__tests__/contract';

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
 * Everything the stubbed seam answers with, plus the log of what it was asked.
 *
 * `hold` is how the ORDER is proved rather than merely observed: a boot read
 * that is left hanging tells us exactly which other reads were willing to start
 * without it.
 */
const seam = vi.hoisted(() => {
  const AT = (day: string): Date => new Date(`${day}T12:00:00.000Z`);

  return {
    calls: [] as string[],
    /** Set by a test to keep `prepareCategories` from resolving. */
    hold: null as Promise<void> | null,
    accounts: [
      {
        id: 'acct-from-the-seam',
        name: 'Everyday',
        type: 'checking',
        balance: -70.1,
        currency: 'GBP',
        isActive: true,
        lastUpdated: AT('2025-01-01'),
      },
    ] as Account[],
    transactions: [
      {
        id: 'txn-from-the-seam',
        accountId: 'acct-from-the-seam',
        amount: -12.5,
        date: AT('2025-03-04'),
        description: 'Something bought',
        category: 'cat-from-the-seam',
        type: 'expense',
      },
    ] as Transaction[],
    splits: [
      {
        id: 'line-from-the-seam',
        transactionId: 'txn-from-the-seam',
        category: 'cat-from-the-seam',
        amount: -12.5,
        sortOrder: 1,
      },
    ] as TransactionSplit[],
    categories: [
      {
        id: 'cat-from-the-seam',
        name: 'Everyday spending',
        type: 'expense',
        level: 'detail',
        isActive: true,
      },
    ] as Category[],
    budgets: [
      {
        id: 'budget-from-the-seam',
        categoryId: 'cat-from-the-seam',
        amount: 200,
        period: 'monthly',
        isActive: true,
        spent: 0,
        createdAt: AT('2025-01-01'),
        updatedAt: AT('2025-01-01'),
      },
    ] as Budget[],
    goals: [
      {
        id: 'goal-from-the-seam',
        name: 'New boiler',
        type: 'savings',
        targetAmount: 1500,
        currentAmount: 0,
        targetDate: AT('2026-01-01'),
        isActive: true,
        createdAt: AT('2025-01-01'),
        updatedAt: AT('2025-01-01'),
        progress: 0,
      },
    ] as Goal[],
    balances: new Map<string, AccountBalanceSnapshot>([
      ['acct-from-the-seam', { balance: -70.1, txnCount: 1 }],
    ]),
  };
});

vi.mock('../../services/port', () => {
  const refuse = (name: string) => async (): Promise<never> => {
    throw new Error(`${name} is not a boot read — the boot must not call it`);
  };
  const answer = function answer<T>(name: string, value: T): () => Promise<T> {
    return async () => {
      seam.calls.push(name);
      return value;
    };
  };

  // Typed as the interface for the reader's sake; held to it by the key-set
  // test at the bottom of this file, which is the part that actually bites. An
  // operation added to the seam and not answered here turns that test red, and
  // that is how the local edition finds out what it owes.
  const dataPort: DataPort = {
    listAccounts: answer('listAccounts', seam.accounts),
    listClosedAccounts: answer('listClosedAccounts', [] as Account[]),
    listTransactions: answer('listTransactions', seam.transactions),
    loadBootTransactions: async () => {
      seam.calls.push('loadBootTransactions');
      return {
        transactions: seam.transactions,
        stats: {
          cached: 0,
          fetched: seam.transactions.length,
          total: seam.transactions.length,
          fullFetchReason: 'stubbed seam',
        },
      };
    },
    getAccountBalances: answer('getAccountBalances', seam.balances),
    listTransactionSplits: answer('listTransactionSplits', seam.splits),
    listTransactionSplitsFor: async () => seam.splits,
    listBudgets: answer('listBudgets', seam.budgets),
    listGoals: answer('listGoals', seam.goals),
    listCategories: answer('listCategories', seam.categories),
    listSuggestionDismissals: answer('listSuggestionDismissals', []),
    prepareCategories: async () => {
      seam.calls.push('prepareCategories');
      if (seam.hold) {
        await seam.hold;
      }
      seam.calls.push('prepareCategories:resolved');
      return seam.categories;
    },
    initialize: async () => {},
    subscribeToUpdates: () => () => {},
    // A device, with nobody signed in — which is what the rest of this file
    // arranges (the id service below hands back a null CURRENT id, so every
    // service that is not the seam stays off the network). Realtime false keeps
    // the boot's subscription block shut, which is this stub's whole interest in
    // the descriptor: the block is proved in AppContextRealtimeCleanup.test.
    capabilities: () => ({
      edition: 'device' as const,
      session: 'anonymous' as const,
      realtime: false,
      maxConcurrentWrites: 1,
      backupTarget: 'device' as const,
    }),
    // Writes: none of them belong to a boot, so each one says so rather than
    // quietly succeeding. A boot that wrote anything would fail by name here.
    createAccount: refuse('createAccount'),
    updateAccount: refuse('updateAccount'),
    closeAccount: refuse('closeAccount'),
    createTransaction: refuse('createTransaction'),
    updateTransaction: refuse('updateTransaction'),
    deleteTransaction: refuse('deleteTransaction'),
    setTransactionsCleared: refuse('setTransactionsCleared'),
    applyCategoryToUncategorized: refuse('applyCategoryToUncategorized'),
    confirmTransactionCategories: refuse('confirmTransactionCategories'),
    setTransactionArchived: refuse('setTransactionArchived'),
    archiveTransactionsBefore: refuse('archiveTransactionsBefore'),
    unarchiveAccount: refuse('unarchiveAccount'),
    importTransactions: refuse('importTransactions'),
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
    createCategories: refuse('createCategories'),
    updateCategory: refuse('updateCategory'),
    deleteCategory: refuse('deleteCategory'),
    deleteUnusedCategories: refuse('deleteUnusedCategories'),
    mergeCategories: refuse('mergeCategories'),
    dismissSuggestion: refuse('dismissSuggestion'),
    restoreSuggestion: refuse('restoreSuggestion'),
    // Backup and restore are not a boot either — the export page and the
    // restore dialog reach them, and a boot that read somebody's whole ledger
    // out to build a file would be a very loud bug worth failing by name for.
    financialDataIsEmpty: refuse('financialDataIsEmpty'),
    collectBackup: refuse('collectBackup'),
    restoreBackup: refuse('restoreBackup'),
    // Nor is erasing the ledger, nor replacing it with somebody's .mny file.
    // A boot that reached either of these would be the loudest bug in the app,
    // so each refuses by name rather than resolving quietly.
    wipeAllFinancialData: refuse('wipeAllFinancialData'),
    importMsMoney: refuse('importMsMoney'),
  };

  return { dataPort };
});

// The database id resolves (so the boot takes its signed-in branch) but the
// CURRENT id stays null, which keeps every service that is NOT the seam on its
// local path and off the network.
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

describe('the boot, through the seam and nothing else', () => {
  beforeEach(() => {
    seam.calls.length = 0;
    seam.hold = null;
  });

  it('takes every piece of its financial state from the port', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Each of these is empty unless the seam supplied it: there is no store
    // behind this test, only the stub.
    expect(result.current.accounts.map(account => account.id)).toEqual(['acct-from-the-seam']);
    expect(result.current.transactions.map(transaction => transaction.id))
      .toEqual(['txn-from-the-seam']);
    expect(result.current.transactionSplits.map(split => split.id))
      .toEqual(['line-from-the-seam']);
    expect(result.current.categories.map(category => category.id)).toEqual(['cat-from-the-seam']);
    expect(result.current.budgets.map(budget => budget.id)).toEqual(['budget-from-the-seam']);
    expect(result.current.goals.map(goal => goal.id)).toEqual(['goal-from-the-seam']);
    expect(result.current.serverBalances.get('acct-from-the-seam')?.balance).toBe(-70.1);

    // A Date crosses as a Date (rule 3): these rows go straight into the
    // balance maths, and a string here would be a NaN there.
    expect(result.current.transactions[0].date).toBeInstanceOf(Date);

    // And the door was actually the door — every boot read went through it.
    expect(new Set(seam.calls)).toEqual(new Set([
      'listAccounts',
      'getAccountBalances',
      'prepareCategories',
      'prepareCategories:resolved',
      'loadBootTransactions',
      'listTransactionSplits',
      'listBudgets',
      'listGoals',
    ]));
  });

  it('does not read a transaction until the categories are prepared', async () => {
    // The ordering the seam calls load-bearing, proved at the call site rather
    // than assumed from the source order.
    //
    // On a first signed-in load `prepareCategories` runs the one-time id
    // migration: every category gets a per-user uuid AND every transaction and
    // budget that referenced the old ids is remapped, in one database
    // transaction. A transaction read that started before that finished would
    // hand the app rows pointing at categories about to stop existing — a
    // register whose category column is blank, with nothing thrown anywhere to
    // say why.
    //
    // Holding the categories is what makes this a proof: reordering the two
    // reads, or gathering them into a Promise.all, both start the transaction
    // read while this one is still outstanding, and both fail below.
    let landCategories!: () => void;
    seam.hold = new Promise<void>(resolve => {
      landCategories = resolve;
    });

    const { result } = renderHook(() => useApp(), { wrapper });

    await waitFor(() => expect(seam.calls).toContain('prepareCategories'));
    expect(seam.calls).not.toContain('loadBootTransactions');

    landCategories();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(seam.calls.indexOf('prepareCategories:resolved'))
      .toBeLessThan(seam.calls.indexOf('loadBootTransactions'));
    expect(result.current.transactions.map(transaction => transaction.id))
      .toEqual(['txn-from-the-seam']);
  });

  it('asks for the budgets and the goals together, not one after the other', async () => {
    // They are independent reads. Serialising them would add a whole round trip
    // to every signed-in boot in exchange for nothing, and it is the kind of
    // change that looks tidier in a diff than it is on a slow connection.
    const started: string[] = [];
    let landBudgets!: () => void;
    const budgetsInFlight = new Promise<void>(resolve => {
      landBudgets = resolve;
    });

    const { dataPort } = await import('../../services/port');
    vi.spyOn(dataPort, 'listBudgets').mockImplementation(async () => {
      started.push('listBudgets');
      await budgetsInFlight;
      return seam.budgets;
    });
    vi.spyOn(dataPort, 'listGoals').mockImplementation(async () => {
      started.push('listGoals');
      return seam.goals;
    });

    const { result } = renderHook(() => useApp(), { wrapper });

    // Goals started while budgets were still outstanding: that is what "one
    // Promise.all" means, and two sequential awaits could not produce it.
    await waitFor(() => expect(started).toEqual(['listBudgets', 'listGoals']));

    landBudgets();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.budgets.map(budget => budget.id)).toEqual(['budget-from-the-seam']);
    expect(result.current.goals.map(goal => goal.id)).toEqual(['goal-from-the-seam']);

    vi.restoreAllMocks();
  });

  it('stubs the whole seam — exactly the operations it names, no more and no fewer', async () => {
    // What makes every assertion above mean what it says.
    //
    // This file's claim is "the app booted on nothing but the port". That claim
    // is only as good as the stub: if an operation joined the seam and the stub
    // never grew a door for it, the boot would reach a real implementation (or
    // an `undefined`) and this file would go on passing while quietly testing
    // something else. The type annotation cannot stop that — tests are not
    // compiled — so the list is held against the keys instead.
    //
    // Both directions matter. FEWER than the list is the case above. MORE than
    // the list is a stub that has drifted into answering a door the interface
    // does not have, which is the same lie told the other way round.
    const { dataPort } = await import('../../services/port');

    expect(Object.keys(dataPort).sort()).toEqual([...DATA_PORT_OPERATIONS].sort());
  });
});
