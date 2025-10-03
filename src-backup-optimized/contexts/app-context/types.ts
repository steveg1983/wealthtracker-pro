import type { Account, Transaction, Budget, Goal, Investment } from '../../types';
import type { DecimalAccount, DecimalTransaction, DecimalBudget, DecimalGoal } from '../../types/decimal-types';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  startDate: Date;
  endDate?: Date;
  nextDate: Date;
  lastProcessed?: Date;
  isActive: boolean;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppContextType {
  // Core data
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  goals: Goal[];
  tags: Tag[];
  recurringTransactions: RecurringTransaction[];
  investments?: Investment[];
  
  // User data
  user?: { id: string; emailAddresses?: Array<{ emailAddress: string }> };
  
  // State flags
  hasTestData: boolean;
  isLoading: boolean;
  
  // Utility methods
  clearAllData: () => Promise<void>;
  exportData: () => string;
  loadTestData?: () => void;
  
  // Account methods
  addAccount: (account: Omit<Account, 'id' | 'lastUpdated'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  
  // Transaction methods
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  
  // Budget methods
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt' | 'spent'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  
  // Category methods
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
  getCategoryById: (id: string) => Category | undefined;
  getCategoryPath: (categoryId: string) => string;
  
  // Goal methods
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'currentAmount'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  
  // Tag methods
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  getTagUsageCount: (tagName: string) => number;
  getAllUsedTags: () => string[];
  
  // Recurring transaction methods
  addRecurringTransaction: (transaction: Omit<RecurringTransaction, 'id' | 'nextDate'>) => void;
  updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => void;
  deleteRecurringTransaction: (id: string) => void;
  processRecurringTransactions: () => void;
  
  // Decimal getters for precision calculations
  getDecimalTransactions: () => DecimalTransaction[];
  getDecimalAccounts: () => DecimalAccount[];
  getDecimalBudgets: () => DecimalBudget[];
  getDecimalGoals: () => DecimalGoal[];
  
  // Data sync operations
  refreshData?: () => Promise<void>;
  importData?: (data: string) => Promise<void>;
  contributeToGoal?: (id: string, amount: number) => Promise<Goal>;
  
  // Sync status
  isSyncing?: boolean;
  lastSyncTime?: Date | null;
  syncError?: string | null;
  isUsingSupabase?: boolean;
  
  // UI helpers
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  dispatch?: any;
}