import React, { createContext, useContext, useMemo } from 'react';
import {
  getDefaultTestAccounts,
  getDefaultTestTransactions,
  getDefaultTestBudgets,
  getDefaultTestGoals,
} from '../../data/defaultTestData';
import { getDefaultCategories } from '../../data/defaultCategories';

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
  addBudget: noop,
  updateBudget: noop,
  deleteBudget: noop,
  addCategory: noop,
  updateCategory: noop,
  deleteCategory: noop,
  addGoal: noop,
  updateGoal: noop,
  deleteGoal: noop,
  addTag: noop,
  updateTag: noop,
  deleteTag: noop,
  getTagUsageCount: () => 0,
  getSubCategories: () => [],
  getDetailCategories: () => [],
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const contextValue = useMemo(() => baseValue, []);
  return React.createElement(AppContext.Provider, { value: contextValue }, children);
}

export function useApp() {
  return useContext(AppContext);
}
