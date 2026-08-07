/**
 * AppState interface for application state management
 */

import type { Account, Transaction, Budget, Goal, Category, RecurringTransaction, Investment } from './index';
import type { TestDataProgress, TestDataSeedResult } from '../utils/testDataset';

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
  investments?: Investment[]; // Optional for backward compatibility

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
  /**
   * Create the sample dataset in whichever store this session is backed by,
   * through the ordinary service layer. Resolves with what was actually
   * written; rejects if a write failed, so the caller can say so rather than
   * closing on a silent no-op.
   */
  loadTestData: (
    onProgress?: (progress: TestDataProgress) => void
  ) => Promise<TestDataSeedResult>;
}