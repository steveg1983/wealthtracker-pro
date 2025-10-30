import type { 
  Account, 
  Transaction, 
  Category, 
  Budget, 
  Goal, 
  RecurringTransaction,
  Investment
} from '../types';
import type { DecimalAccount, DecimalGoal, DecimalTransaction } from '../types/decimal-types';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AppState = {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
  tags: Tag[];
  recurringTransactions: RecurringTransaction[];
  investments: Investment[];
};

export interface AppContextType extends AppState {
  // Account operations
  addAccount: (account: Omit<Account, 'id'> & { initialBalance?: number }) => Promise<Account>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<Account>;
  deleteAccount: (id: string) => Promise<void>;
  
  // Transaction operations
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<Transaction>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  
  // Budget operations
  addBudget: (budget: Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt'>) => Promise<Budget>;
  updateBudget: (id: string, updates: Partial<Budget>) => Promise<Budget>;
  deleteBudget: (id: string) => Promise<void>;
  
  // Goal operations
  addGoal: (goal: Omit<Goal, 'id' | 'progress' | 'createdAt' | 'updatedAt'>) => Promise<Goal>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
  contributeToGoal: (id: string, amount: number) => Promise<Goal>;
  
  // Category operations
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
  
  // Tag operations
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  getTagUsageCount: (tagName: string) => number;
  getAllUsedTags: () => string[];
  
  // Recurring transaction operations
  addRecurringTransaction: (transaction: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt' | 'nextDate'> & { nextDate?: Date }) => RecurringTransaction;
  updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => RecurringTransaction | undefined;
  deleteRecurringTransaction: (id: string) => void;
  
  // Other operations
  importData: (data: Partial<AppState>) => void;
  exportData: () => AppState;
  clearAllData: () => void;
  refreshData: () => Promise<void>;
  getDecimalTransactions: () => DecimalTransaction[];
  getDecimalAccounts: () => DecimalAccount[];
  getDecimalGoals: () => DecimalGoal[];
  
  // Sync status
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  isUsingSupabase: boolean;
}
