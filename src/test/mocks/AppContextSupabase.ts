import React, { createContext, useContext, useMemo } from 'react';
import {
  getDefaultTestAccounts,
  getDefaultTestTransactions,
  getDefaultTestBudgets,
  getDefaultTestGoals,
} from '../../data/defaultTestData';
import { getDefaultCategories } from '../../data/defaultCategories';
import type { Category } from '../../types';

const accounts = getDefaultTestAccounts();
const transactions = getDefaultTestTransactions();
const budgets = getDefaultTestBudgets();
const goals = getDefaultTestGoals();
const categories = getDefaultCategories();

const noop = () => {};
const asyncNoop = async () => {};

const baseValue = {
  accounts,
  transactions,
  budgets,
  categories,
  goals,
  tags: [],
  hasTestData: true,
  isLoading: false,
  clearAllData: asyncNoop,
  exportData: () => JSON.stringify({ accounts, transactions, budgets, goals, categories }),
  loadTestData: noop,
  addAccount: noop,
  updateAccount: noop,
  deleteAccount: noop,
  addTransaction: noop,
  updateTransaction: noop,
  deleteTransaction: noop,
  setTransactionsCleared: asyncNoop,
  applyCategoryToUncategorized: async () => 0,
  transactionSplits: [],
  serverBalances: new Map<string, { balance: number; txnCount: number }>(),
  getTransactionSplits: async () => [],
  setTransactionSplits: async () => ({ isSplit: false, splitCount: 0, amount: 0 }),
  linkTransferPair: async () => { throw new Error('not available in mock'); },
  createTransferCounterpart: async () => { throw new Error('not available in mock'); },
  refreshAccountsAndTransactions: asyncNoop,
  refreshCategories: asyncNoop,
  addBudget: noop,
  updateBudget: noop,
  deleteBudget: noop,
  addCategory: noop,
  importCategoryTree: async () => ({ created: 0, skipped: 0, pruned: 0, keptForTransactions: 0 }),
  updateCategory: noop,
  deleteCategory: noop,
  addGoal: noop,
  updateGoal: noop,
  deleteGoal: noop,
  addTag: noop,
  updateTag: noop,
  deleteTag: noop,
  getTagUsageCount: () => 0,
  getSubCategories: (_parentId?: string): Category[] => [],
  getDetailCategories: (_parentId?: string): Category[] => [],
  getCategoryById: () => undefined,
  getCategoryPath: () => '',
  recurringTransactions: [],
  addRecurringTransaction: noop,
  updateRecurringTransaction: noop,
  deleteRecurringTransaction: noop,
  processRecurringTransactions: noop,
  getDecimalTransactions: () => [],
  getDecimalAccounts: () => [],
  getDecimalBudgets: () => [],
  getDecimalGoals: () => [],
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
