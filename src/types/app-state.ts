/**
 * AppState interface for application state management
 */

import type { Account, Transaction, Budget, Goal, Category, RecurringTransaction } from './index';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppState {
  // Core data
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
  tags: Tag[];
  recurringTransactions: RecurringTransaction[];

  // State flags
  isLoading: boolean;
  isSyncing: boolean;
  isUsingSupabase: boolean;
  hasTestData: boolean;

  // Sync metadata
  lastSyncTime: Date | null;
  syncError: string | null;

  // Utility methods
  clearAllData: () => Promise<void>;
  exportData: () => string;
  loadTestData: () => void;
}