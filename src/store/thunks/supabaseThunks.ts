/**
 * Supabase Redux Thunks - Async operations for Supabase data layer
 * 
 * This file contains Redux thunks for all Supabase operations:
 * - Accounts CRUD operations
 * - Transactions CRUD operations  
 * - Budgets CRUD operations
 * - Goals CRUD operations
 * 
 * Features:
 * - Authentication-aware (requires valid user)
 * - Offline fallback to localStorage
 * - Optimistic updates for better UX
 * - Proper error handling and loading states
 * - Type-safe with full TypeScript support
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import { SupabaseService } from '../../services/supabaseService';
import { storageAdapter } from '../../services/storageAdapter';
import type { Account, Transaction, Budget, Goal } from '../../types';

// Helper to get user ID from Clerk auth
function getCurrentUserId(): string | null {
  // In the browser environment, we can access the global Clerk instance
  if (typeof window !== 'undefined' && window.Clerk) {
    const user = window.Clerk.user;
    return user?.id || null;
  }
  
  // Fallback for SSR or when Clerk is not available
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('current_user_id') || null;
  }
  
  return null;
}

// =============================================================================
// ACCOUNTS THUNKS
// =============================================================================

export const fetchAccountsFromSupabase = createAsyncThunk(
  'accounts/fetchFromSupabase',
  async (_, { rejectWithValue }) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const accounts = await SupabaseService.getAccounts(userId);
      
      // Cache to localStorage for offline access
      await storageAdapter.set('accounts', accounts);
      
      return accounts;
    } catch (error) {
      console.error('Failed to fetch accounts from Supabase:', error);
      
      // Fallback to localStorage
      try {
        const cachedAccounts = await storageAdapter.get<Account[]>('accounts') || [];
        return cachedAccounts;
      } catch (cacheError) {
        return rejectWithValue('Failed to fetch accounts and no cached data available');
      }
    }
  }
);

export const createAccountInSupabase = createAsyncThunk(
  'accounts/createInSupabase',
  async (accountData: Omit<Account, 'id' | 'lastUpdated'>, { rejectWithValue, dispatch }) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const newAccount = await SupabaseService.createAccount(userId, accountData);
      
      if (!newAccount) {
        throw new Error('Failed to create account in Supabase');
      }

      // Update local cache
      const cachedAccounts = await storageAdapter.get<Account[]>('accounts') || [];
      await storageAdapter.set('accounts', [...cachedAccounts, newAccount]);
      
      return newAccount;
    } catch (error) {
      console.error('Failed to create account in Supabase:', error);
      
      // Offline fallback - create locally with temp ID
      const tempAccount: Account = {
        ...accountData,
        id: `temp-${crypto.randomUUID()}`,
        lastUpdated: new Date(),
        updatedAt: new Date(),
      };
      
      // Store in localStorage with sync flag
      const cachedAccounts = await storageAdapter.get<Account[]>('accounts') || [];
      const offlineAccounts = await storageAdapter.get<Account[]>('offline_accounts') || [];
      await storageAdapter.set('accounts', [...cachedAccounts, tempAccount]);
      await storageAdapter.set('offline_accounts', [...offlineAccounts, tempAccount]);
      
      return tempAccount;
    }
  }
);

export const updateAccountInSupabase = createAsyncThunk(
  'accounts/updateInSupabase',
  async ({ id, updates }: { id: string; updates: Partial<Account> }, { rejectWithValue }) => {
    try {
      const updatedAccount = await SupabaseService.updateAccount(id, updates);
      
      if (!updatedAccount) {
        throw new Error('Failed to update account in Supabase');
      }

      // Update local cache
      const cachedAccounts = await storageAdapter.get<Account[]>('accounts') || [];
      const updatedCache = cachedAccounts.map(acc => 
        acc.id === id ? updatedAccount : acc
      );
      await storageAdapter.set('accounts', updatedCache);
      
      return updatedAccount;
    } catch (error) {
      console.error('Failed to update account in Supabase:', error);
      
      // Offline fallback - update locally
      const cachedAccounts = await storageAdapter.get<Account[]>('accounts') || [];
      const accountIndex = cachedAccounts.findIndex(acc => acc.id === id);
      
      if (accountIndex !== -1) {
        const updatedAccount = { 
          ...cachedAccounts[accountIndex], 
          ...updates, 
          updatedAt: new Date() 
        };
        cachedAccounts[accountIndex] = updatedAccount;
        
        await storageAdapter.set('accounts', cachedAccounts);
        
        // Track for later sync
        const offlineUpdates = await storageAdapter.get<any[]>('offline_account_updates') || [];
        await storageAdapter.set('offline_account_updates', [...offlineUpdates, { id, updates }]);
        
        return updatedAccount;
      }
      
      return rejectWithValue('Account not found');
    }
  }
);

export const deleteAccountFromSupabase = createAsyncThunk(
  'accounts/deleteFromSupabase',
  async (id: string, { rejectWithValue }) => {
    try {
      const success = await SupabaseService.deleteAccount(id);
      
      if (!success) {
        throw new Error('Failed to delete account from Supabase');
      }

      // Update local cache
      const cachedAccounts = await storageAdapter.get<Account[]>('accounts') || [];
      const filteredAccounts = cachedAccounts.filter(acc => acc.id !== id);
      await storageAdapter.set('accounts', filteredAccounts);
      
      return id;
    } catch (error) {
      console.error('Failed to delete account from Supabase:', error);
      
      // Offline fallback - mark as deleted locally
      const cachedAccounts = await storageAdapter.get<Account[]>('accounts') || [];
      const filteredAccounts = cachedAccounts.filter(acc => acc.id !== id);
      await storageAdapter.set('accounts', filteredAccounts);
      
      // Track for later sync
      const offlineDeletes = await storageAdapter.get<string[]>('offline_account_deletes') || [];
      await storageAdapter.set('offline_account_deletes', [...offlineDeletes, id]);
      
      return id;
    }
  }
);

// =============================================================================
// TRANSACTIONS THUNKS
// =============================================================================

export const fetchTransactionsFromSupabase = createAsyncThunk(
  'transactions/fetchFromSupabase',
  async (limit: number = 1000, { rejectWithValue }) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const transactions = await SupabaseService.getTransactions(userId, limit);
      
      // Cache to localStorage for offline access
      await storageAdapter.set('transactions', transactions);
      
      return transactions;
    } catch (error) {
      console.error('Failed to fetch transactions from Supabase:', error);
      
      // Fallback to localStorage
      try {
        const cachedTransactions = await storageAdapter.get<Transaction[]>('transactions') || [];
        return cachedTransactions;
      } catch (cacheError) {
        return rejectWithValue('Failed to fetch transactions and no cached data available');
      }
    }
  }
);

export const createTransactionInSupabase = createAsyncThunk(
  'transactions/createInSupabase',
  async (transactionData: Omit<Transaction, 'id'>, { rejectWithValue }) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const newTransaction = await SupabaseService.createTransaction(userId, transactionData);
      
      if (!newTransaction) {
        throw new Error('Failed to create transaction in Supabase');
      }

      // Update local cache
      const cachedTransactions = await storageAdapter.get<Transaction[]>('transactions') || [];
      await storageAdapter.set('transactions', [...cachedTransactions, newTransaction]);
      
      return newTransaction;
    } catch (error) {
      console.error('Failed to create transaction in Supabase:', error);
      
      // Offline fallback - create locally with temp ID
      const tempTransaction: Transaction = {
        ...transactionData,
        id: `temp-${crypto.randomUUID()}`,
      };
      
      // Store in localStorage with sync flag
      const cachedTransactions = await storageAdapter.get<Transaction[]>('transactions') || [];
      const offlineTransactions = await storageAdapter.get<Transaction[]>('offline_transactions') || [];
      await storageAdapter.set('transactions', [...cachedTransactions, tempTransaction]);
      await storageAdapter.set('offline_transactions', [...offlineTransactions, tempTransaction]);
      
      return tempTransaction;
    }
  }
);

export const updateTransactionInSupabase = createAsyncThunk(
  'transactions/updateInSupabase',
  async ({ id, updates }: { id: string; updates: Partial<Transaction> }, { rejectWithValue }) => {
    try {
      const updatedTransaction = await SupabaseService.updateTransaction(id, updates);
      
      if (!updatedTransaction) {
        throw new Error('Failed to update transaction in Supabase');
      }

      // Update local cache
      const cachedTransactions = await storageAdapter.get<Transaction[]>('transactions') || [];
      const updatedCache = cachedTransactions.map(txn => 
        txn.id === id ? updatedTransaction : txn
      );
      await storageAdapter.set('transactions', updatedCache);
      
      return updatedTransaction;
    } catch (error) {
      console.error('Failed to update transaction in Supabase:', error);
      
      // Offline fallback - update locally
      const cachedTransactions = await storageAdapter.get<Transaction[]>('transactions') || [];
      const transactionIndex = cachedTransactions.findIndex(txn => txn.id === id);
      
      if (transactionIndex !== -1) {
        const updatedTransaction = { 
          ...cachedTransactions[transactionIndex], 
          ...updates
        };
        cachedTransactions[transactionIndex] = updatedTransaction;
        
        await storageAdapter.set('transactions', cachedTransactions);
        
        // Track for later sync
        const offlineUpdates = await storageAdapter.get<any[]>('offline_transaction_updates') || [];
        await storageAdapter.set('offline_transaction_updates', [...offlineUpdates, { id, updates }]);
        
        return updatedTransaction;
      }
      
      return rejectWithValue('Transaction not found');
    }
  }
);

export const deleteTransactionFromSupabase = createAsyncThunk(
  'transactions/deleteFromSupabase',
  async (id: string, { rejectWithValue }) => {
    try {
      const success = await SupabaseService.deleteTransaction(id);
      
      if (!success) {
        throw new Error('Failed to delete transaction from Supabase');
      }

      // Update local cache
      const cachedTransactions = await storageAdapter.get<Transaction[]>('transactions') || [];
      const filteredTransactions = cachedTransactions.filter(txn => txn.id !== id);
      await storageAdapter.set('transactions', filteredTransactions);
      
      return id;
    } catch (error) {
      console.error('Failed to delete transaction from Supabase:', error);
      
      // Offline fallback - mark as deleted locally
      const cachedTransactions = await storageAdapter.get<Transaction[]>('transactions') || [];
      const filteredTransactions = cachedTransactions.filter(txn => txn.id !== id);
      await storageAdapter.set('transactions', filteredTransactions);
      
      // Track for later sync
      const offlineDeletes = await storageAdapter.get<string[]>('offline_transaction_deletes') || [];
      await storageAdapter.set('offline_transaction_deletes', [...offlineDeletes, id]);
      
      return id;
    }
  }
);

// =============================================================================
// BUDGETS THUNKS
// =============================================================================

export const fetchBudgetsFromSupabase = createAsyncThunk(
  'budgets/fetchFromSupabase',
  async (_, { rejectWithValue }) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const budgets = await SupabaseService.getBudgets(userId);
      
      // Cache to localStorage for offline access
      await storageAdapter.set('budgets', budgets);
      
      return budgets;
    } catch (error) {
      console.error('Failed to fetch budgets from Supabase:', error);
      
      // Fallback to localStorage
      try {
        const cachedBudgets = await storageAdapter.get<Budget[]>('budgets') || [];
        return cachedBudgets;
      } catch (cacheError) {
        return rejectWithValue('Failed to fetch budgets and no cached data available');
      }
    }
  }
);

export const createBudgetInSupabase = createAsyncThunk(
  'budgets/createInSupabase',
  async (budgetData: Omit<Budget, 'id' | 'createdAt' | 'spent'>, { rejectWithValue }) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const newBudget = await SupabaseService.createBudget(userId, budgetData);
      
      if (!newBudget) {
        throw new Error('Failed to create budget in Supabase');
      }

      // Update local cache
      const cachedBudgets = await storageAdapter.get<Budget[]>('budgets') || [];
      await storageAdapter.set('budgets', [...cachedBudgets, newBudget]);
      
      return newBudget;
    } catch (error) {
      console.error('Failed to create budget in Supabase:', error);
      
      // Offline fallback - create locally with temp ID
      const tempBudget: Budget = {
        ...budgetData,
        id: `temp-${crypto.randomUUID()}`,
        createdAt: new Date(),
        spent: 0,
      };
      
      // Store in localStorage with sync flag
      const cachedBudgets = await storageAdapter.get<Budget[]>('budgets') || [];
      const offlineBudgets = await storageAdapter.get<Budget[]>('offline_budgets') || [];
      await storageAdapter.set('budgets', [...cachedBudgets, tempBudget]);
      await storageAdapter.set('offline_budgets', [...offlineBudgets, tempBudget]);
      
      return tempBudget;
    }
  }
);

// =============================================================================
// GOALS THUNKS
// =============================================================================

export const fetchGoalsFromSupabase = createAsyncThunk(
  'goals/fetchFromSupabase',
  async (_, { rejectWithValue }) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const goals = await SupabaseService.getGoals(userId);
      
      // Cache to localStorage for offline access
      await storageAdapter.set('goals', goals);
      
      return goals;
    } catch (error) {
      console.error('Failed to fetch goals from Supabase:', error);
      
      // Fallback to localStorage
      try {
        const cachedGoals = await storageAdapter.get<Goal[]>('goals') || [];
        return cachedGoals;
      } catch (cacheError) {
        return rejectWithValue('Failed to fetch goals and no cached data available');
      }
    }
  }
);

export const createGoalInSupabase = createAsyncThunk(
  'goals/createInSupabase',
  async (goalData: Omit<Goal, 'id' | 'createdAt' | 'currentAmount'>, { rejectWithValue }) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const newGoal = await SupabaseService.createGoal(userId, goalData);
      
      if (!newGoal) {
        throw new Error('Failed to create goal in Supabase');
      }

      // Update local cache
      const cachedGoals = await storageAdapter.get<Goal[]>('goals') || [];
      await storageAdapter.set('goals', [...cachedGoals, newGoal]);
      
      return newGoal;
    } catch (error) {
      console.error('Failed to create goal in Supabase:', error);
      
      // Offline fallback - create locally with temp ID
      const tempGoal: Goal = {
        ...goalData,
        id: `temp-${crypto.randomUUID()}`,
        createdAt: new Date(),
        currentAmount: 0,
      };
      
      // Store in localStorage with sync flag
      const cachedGoals = await storageAdapter.get<Goal[]>('goals') || [];
      const offlineGoals = await storageAdapter.get<Goal[]>('offline_goals') || [];
      await storageAdapter.set('goals', [...cachedGoals, tempGoal]);
      await storageAdapter.set('offline_goals', [...offlineGoals, tempGoal]);
      
      return tempGoal;
    }
  }
);

// =============================================================================
// SYNC UTILITIES
// =============================================================================

export const syncOfflineData = createAsyncThunk(
  'app/syncOfflineData',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Sync offline accounts
      const offlineAccounts = await storageAdapter.get<Account[]>('offline_accounts') || [];
      for (const account of offlineAccounts) {
        if (account.id.startsWith('temp-')) {
          await dispatch(createAccountInSupabase(account));
        }
      }

      // Sync offline transactions
      const offlineTransactions = await storageAdapter.get<Transaction[]>('offline_transactions') || [];
      for (const transaction of offlineTransactions) {
        if (transaction.id.startsWith('temp-')) {
          await dispatch(createTransactionInSupabase(transaction));
        }
      }

      // Clear offline data after successful sync
      await storageAdapter.remove('offline_accounts');
      await storageAdapter.remove('offline_transactions');
      await storageAdapter.remove('offline_budgets');
      await storageAdapter.remove('offline_goals');
      
      return true;
    } catch (error) {
      console.error('Failed to sync offline data:', error);
      return rejectWithValue('Failed to sync offline data');
    }
  }
);