import React, { createContext, useContext, useMemo } from 'react';
import {
  getDefaultTestAccounts,
  getDefaultTestTransactions,
  getDefaultTestBudgets,
  getDefaultTestGoals,
} from '../../data/defaultTestData';
import { getDefaultCategories } from '../../data/defaultCategories';
import type { Category, DismissalKind, SuggestionDismissal, Transaction } from '../../types';
import type { DataPortCapabilities } from '../../services/port';
import type { TestDataSeedResult } from '../../utils/testDataset';
import { NO_SURVIVORS, type DeleteTransactionOutcome } from '../../utils/transferSurvivorRelease';
import type {
  DecimalAccount,
  DecimalBudget,
  DecimalGoal,
  DecimalTransaction
} from '../../types/decimal-types';

const accounts = getDefaultTestAccounts();
const transactions = getDefaultTestTransactions();
const budgets = getDefaultTestBudgets();
const goals = getDefaultTestGoals();
const categories = getDefaultCategories();

const noop = () => {};
const asyncNoop = async () => {};

/**
 * Distinct ids for rows the double "creates".
 *
 * The real addTransaction returns the row it wrote, because a caller may need
 * the new id immediately — creating the other half of a transfer is exactly
 * that. A double that returned nothing would let a test pass over code the app
 * cannot run, so this hands back a whole row with an id of its own.
 */
let createdTransactionSeq = 0;

/**
 * The seam's capability descriptor, as a device answers it.
 *
 * Device rather than cloud on purpose: this stands in for the value the real
 * context surfaces, and every suite that renders against this mock without
 * saying otherwise used to read a boot flag that was plainly false. Keeping the
 * default falsy-equivalent means a page's copy reads the same here as it did
 * before the descriptor existed, and the two suites that care about the other
 * edition say so explicitly (`__setAppContextValue({ capabilities: … })`).
 *
 * Present at all because of what happens when it is not: every consumer reads
 * `capabilities.session` / `.backupTarget` on its FIRST render, and an
 * undefined descriptor is not a wrong answer on screen — it is a TypeError
 * thrown out of a component that has nothing to do with capabilities.
 */
const deviceCapabilities: DataPortCapabilities = {
  edition: 'device',
  session: 'anonymous',
  realtime: false,
  maxConcurrentWrites: 1,
  backupTarget: 'device',
};

const baseValue = {
  accounts,
  transactions,
  budgets,
  categories,
  goals,
  /**
   * Reports somebody built, and an empty list is a real answer.
   *
   * Present at all for the reason `capabilities` above is: the dashboard's
   * report picker maps over this DURING RENDER (it is built inline in a modal
   * body, so the JSX is evaluated whether or not the modal is open), and an
   * undefined list is not a missing card — it is a TypeError thrown out of a
   * component that has nothing to do with reports.
   */
  customReports: [],
  tags: [],
  isLoading: false,
  capabilities: deviceCapabilities,
  resetLoadedData: asyncNoop,
  exportData: () => JSON.stringify({ accounts, transactions, budgets, goals, categories }),
  // Async and counting, like the real thing: callers await it and read the
  // result to report what was created.
  loadTestData: async (): Promise<TestDataSeedResult> => ({
    categoriesCreated: 0,
    accounts: 0,
    transactions: 0,
    budgets: 0,
    goals: 0
  }),
  saveCustomReport: async () => { throw new Error('not available in mock'); },
  deleteCustomReport: asyncNoop,
  addAccount: noop,
  updateAccount: noop,
  closeAccount: noop,
  addTransaction: async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => ({
    ...transaction,
    id: `created-transaction-${++createdTransactionSeq}`,
  }),
  updateTransaction: noop,
  /**
   * Reports what became of the other side, as the real one does.
   *
   * Not `noop`: a caller deleting BOTH halves of a transfer reads this to know
   * whether the survivor was released before it tried to delete it, and a
   * double that answered nothing would let a suite pass over a branch the app
   * cannot run. The typed parameter is load-bearing too — it is what lets a
   * suite hand `__setAppContextValue` a spy of the real shape.
   */
  deleteTransaction: async (_id: string): Promise<DeleteTransactionOutcome> => NO_SURVIVORS,
  setTransactionsCleared: asyncNoop,
  finalizeReconciliation: async () => 0,
  applyCategoryToUncategorized: async () => 0,
  confirmTransactionCategories: async () => 0,
  transactionSplits: [],
  serverBalances: new Map<string, { balance: number; txnCount: number }>(),
  getTransactionSplits: async () => [],
  setTransactionSplits: async () => ({ isSplit: false, splitCount: 0, amount: 0 }),
  linkTransferPair: async () => { throw new Error('not available in mock'); },
  linkSplitLineTransfer: async () => { throw new Error('not available in mock'); },
  unlinkTransfers: async () => 0,
  setTransactionArchived: asyncNoop,
  repairClaimedTransfer: asyncNoop,
  createTransferCounterpart: async () => { throw new Error('not available in mock'); },
  repointTransfer: async () => { throw new Error('not available in mock'); },
  // Typed so a test can override with real dismissals; 'ready' by default
  // because the surfaces hold their lists back until the filter has run, and a
  // test that says nothing about dismissals means "nothing is dismissed".
  suggestionDismissals: [] as SuggestionDismissal[],
  suggestionDismissalsStatus: 'ready' as 'idle' | 'loading' | 'ready' | 'error',
  refreshSuggestionDismissals: asyncNoop,
  dismissSuggestion: async (_kind: DismissalKind, _subjectKey: string, _subjectIds: string[]) => {},
  restoreSuggestion: async (_kind: DismissalKind, _subjectKey: string) => {},
  refreshAccountsAndTransactions: asyncNoop,
  refreshCategories: asyncNoop,
  addBudget: noop,
  updateBudget: noop,
  deleteBudget: noop,
  addCategory: noop,
  importCategoryTree: async () => ({ created: 0, skipped: 0, pruned: 0, keptForTransactions: 0 }),
  updateCategory: noop,
  deleteCategory: noop,
  mergeCategories: async (sourceId: string, targetId: string) => ({
    sourceId,
    targetId,
    transactions: 0,
    splitLines: 0,
    splitTransactions: 0,
    budgets: 0,
    recurring: 0,
  }),
  // Async, like the real context: callers chain .catch() on these, and a
  // double that hands back `undefined` crashes the very code it is meant to
  // stand in for.
  addGoal: asyncNoop,
  updateGoal: asyncNoop,
  deleteGoal: asyncNoop,
  addTag: noop,
  updateTag: noop,
  deleteTag: noop,
  getTagUsageCount: () => 0,
  getSubCategories: (_parentId?: string): Category[] => [],
  getDetailCategories: (_parentId?: string): Category[] => [],
  getCategoryById: () => undefined,
  recurringTransactions: [],
  addRecurringTransaction: noop,
  updateRecurringTransaction: noop,
  deleteRecurringTransaction: noop,
  processRecurringTransactions: noop,
  // Typed returns, so a test can override them with real decimal data
  // (`() => []` alone infers never[], which nothing can be assigned to).
  getDecimalTransactions: (): DecimalTransaction[] => [],
  getDecimalAccounts: (): DecimalAccount[] => [],
  getDecimalBudgets: (): DecimalBudget[] => [],
  getDecimalGoals: (): DecimalGoal[] => [],
  investments: [],
  getAllUsedTags: () => [],
};

const AppContext = createContext(baseValue);

const defaultContextValue = { ...baseValue };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const contextValue = useMemo(() => baseValue, []);
  return React.createElement(AppContext.Provider, { value: contextValue }, children);
}

export function useApp() {
  return useContext(AppContext);
}

export function __setAppContextValue(overrides: Partial<typeof baseValue>) {
  Object.assign(baseValue, overrides);
}

export function __resetAppContextValue() {
  Object.assign(baseValue, defaultContextValue);
}
