import { createContext } from 'react';
import type { Account, Transaction, Budget, Goal, Investment, Category, RecurringTransaction, Tag } from '../types';

export type { Category, RecurringTransaction, Tag };

export interface AppContextType {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  goals: Goal[];
  tags: Tag[];
  hasTestData: boolean;
  isLoading: boolean;
  clearAllData: () => Promise<void>;
  exportData: () => string;
  loadTestData: () => void;
  addAccount: (account: Omit<Account, 'id' | 'lastUpdated'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt' | 'spent'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'currentAmount'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  getTagUsageCount: (tagName: string) => number;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
  getCategoryById: (id: string) => Category | undefined;
  getCategoryPath: (categoryId: string) => string;
  recurringTransactions: RecurringTransaction[];
  addRecurringTransaction: (transaction: Omit<RecurringTransaction, 'id' | 'nextDate'>) => void;
  updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => void;
  deleteRecurringTransaction: (id: string) => void;
  processRecurringTransactions: () => void;
  getDecimalTransactions: () => Transaction[];
  getDecimalAccounts: () => Account[];
  getDecimalBudgets: () => Budget[];
  getDecimalGoals: () => Goal[];
  investments?: Investment[];
  getAllUsedTags: () => string[];
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
