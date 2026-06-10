/* eslint-disable react-refresh/only-export-components */
/**
 * AppContext with Supabase Integration
 * This version uses the DataService layer to work with either Supabase or localStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { DataService } from '../services/api/dataService';
import * as SimpleAccountService from '../services/api/simpleAccountService';
import AutoSyncService from '../services/autoSyncService';
import { userIdService } from '../services/userIdService';
import { PlanningService } from '../services/api/planningService';
import { getDefaultCategories } from '../data/defaultCategories';
// formatCurrency import removed - not used in this context
import {
  toDecimalTransaction,
  toDecimalAccount,
  toDecimalGoal
} from '../utils/decimal-converters';
import { toDecimal } from '../utils/decimal';
import type { DecimalTransaction, DecimalAccount, DecimalGoal } from '../types/decimal-types';
import type { 
  Account, 
  Transaction, 
  Category, 
  Budget, 
  Goal, 
  RecurringTransaction,
  AppState 
} from '../types';
import { createScopedLogger } from '../loggers/scopedLogger';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppContextType extends AppState {
  // Account operations
  addAccount: (account: Omit<Account, 'id'> & { initialBalance?: number }) => Promise<Account>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Transaction operations — async so callers can surface save failures.
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  // Budget operations — async so callers can surface persistence failures
  addBudget: (budget: Omit<Budget, 'id' | 'spent'>) => Promise<void>;
  updateBudget: (id: string, updates: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  // Goal operations — async so callers can surface persistence failures
  addGoal: (goal: Omit<Goal, 'id' | 'progress'>) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  contributeToGoal: (id: string, amount: number) => Promise<void>;
  
  // Category operations — async so callers can surface persistence failures
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
  
  // Tag operations
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  getTagUsageCount: (tagName: string) => number;
  getAllUsedTags: () => string[];
  
  // Other operations
  importData: (data: Partial<AppState>) => void;
  exportData: () => string;
  clearAllData: () => Promise<void>;
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

const AppContext = createContext<AppContextType | undefined>(undefined);
const appLogger = createScopedLogger('AppContext');

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isUsingSupabase, setIsUsingSupabase] = useState(false);
  
  // Refs to prevent duplicate updates and manage debouncing
  const lastUpdateRef = useRef<{ type: string; timestamp: number } | null>(null);
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Suppress real-time reloads shortly after a local write to prevent overwriting optimistic updates
  const recentLocalUpdateRef = useRef<number>(0);

  // Initialize data service and load data
  useEffect(() => {
    if (!isLoaded) return;

    const initializeData = async () => {
      setIsLoading(true);
      setSyncError(null);

      try {
        appLogger.info('Initializing app context', { userId: user?.id });
        // Initialize DataService with user info
        if (user) {
          appLogger.info('User found, initializing services');
          
          // Initialize userIdService first - this is now the single source of truth
          const databaseId = await userIdService.ensureUserExists(
            user.id,
            user.emailAddresses[0]?.emailAddress || '',
            user.firstName || undefined,
            user.lastName || undefined
          );
          if (databaseId) {
            appLogger.info('Database user ID resolved', { databaseId });
            
            // Initialize AutoSync with the database ID ready
            await AutoSyncService.initialize(user.id);
            
            await DataService.initialize(
              user.id,
              user.emailAddresses[0]?.emailAddress || '',
              user.firstName || undefined,
              user.lastName || undefined
            );
            appLogger.info('Loading application data');
            
            // Use the database ID we just got - no need to fetch it again!
            const accounts = await SimpleAccountService.getAccounts(databaseId);
            appLogger.info('Accounts loaded', { count: accounts.length });
            setAccounts(accounts);
          } else {
            appLogger.warn('Failed to resolve database user ID - no data will be loaded');
            setAccounts([]);
          }
        } else {
          // No user logged in
          appLogger.info('No user logged in');
          setAccounts([]);
        }
        
        // Categories MUST resolve before transactions/budgets are read:
        // ensureCategories runs the one-time cloud migration on first
        // signed-in load (per-user uuid ids + atomic remap of the category
        // references on transactions and budgets) — reading those first
        // would snapshot pre-remap ids into state.
        const planningUserId = userIdService.getCurrentDatabaseUserId();
        const loadedCategories = await PlanningService.ensureCategories(planningUserId);
        setCategories(loadedCategories);

        // Now load transactions, budgets, and goals (post-remap views).
        const data = await DataService.loadAppData();
        setTransactions(data.transactions);

        const [loadedBudgets, loadedGoals] = await Promise.all([
          PlanningService.getBudgets(planningUserId),
          PlanningService.getGoals(planningUserId)
        ]);
        setBudgets(loadedBudgets);
        setGoals(loadedGoals);

        setIsUsingSupabase(DataService.isUsingSupabase());
        setLastSyncTime(new Date());

        // Subscribe to real-time updates if using Supabase
        if (DataService.isUsingSupabase() && user) {
          // Helper function to debounce updates
          const debouncedUpdate = (updateType: string, updateFn: () => Promise<void>) => {
            // Check if this is a duplicate update (within 1 second)
            const now = Date.now();
            if (lastUpdateRef.current && 
                lastUpdateRef.current.type === updateType && 
                now - lastUpdateRef.current.timestamp < 1000) {
              appLogger.debug('Skipping duplicate real-time update', { updateType });
              return;
            }
            
            // Clear any pending debounced update
            if (updateDebounceRef.current) {
              clearTimeout(updateDebounceRef.current);
            }
            
            // Set a new debounced update
            updateDebounceRef.current = setTimeout(async () => {
              lastUpdateRef.current = { type: updateType, timestamp: now };
              await updateFn();
            }, 200); // 200ms debounce
          };
          
          // Use the simple account service for real-time updates
          const unsubscribeAccountsPromise = SimpleAccountService.subscribeToAccountChanges(
            user.id,
            async (payload) => {
              const realtimePayload = payload as { eventType: string; new?: { is_active?: boolean } };
              appLogger.debug('Real-time account update received', realtimePayload);
              appLogger.debug('Real-time account update type', { eventType: realtimePayload.eventType });

              // Handle different event types
              if (realtimePayload.eventType === 'UPDATE' && realtimePayload.new && !realtimePayload.new.is_active) {
                appLogger.debug('Real-time account marked inactive');
              }
              
              // Skip real-time reload if we just made a local update (prevents overwriting optimistic state)
              if (Date.now() - recentLocalUpdateRef.current < 2000) {
                appLogger.debug('Skipping real-time account reload (recent local update)');
                return;
              }

              debouncedUpdate('account', async () => {
                appLogger.debug('Reloading accounts after real-time update');
                // Reload accounts when any change happens
                const updatedAccounts = await SimpleAccountService.getAccounts(user.id);
                appLogger.debug('Accounts reloaded', { count: updatedAccounts.length });
                setAccounts(updatedAccounts);
                setLastSyncTime(new Date());
                
                // Also refresh transactions to update account balances
                const updatedTransactions = await DataService.getTransactions();
                setTransactions(updatedTransactions);
              });
            }
          );
          
          // Wait for the subscription to be set up
          const unsubscribeAccounts = await unsubscribeAccountsPromise;

          // Subscribe to transaction updates only (accounts are handled above by SimpleAccountService)
          const unsubscribeData = DataService.subscribeToUpdates({
            // Don't subscribe to accounts here - already handled by SimpleAccountService above
            // This prevents duplicate subscriptions and duplicate real-time events
            onTransactionUpdate: async (payload) => {
              appLogger.debug('Transaction update received', payload);
              
              debouncedUpdate('transaction', async () => {
                // Reload transactions when any change happens
                const updatedTransactions = await DataService.getTransactions();
                setTransactions(updatedTransactions);
                
                // Also refresh accounts to update balances
                const updatedAccounts = await DataService.getAccounts();
                setAccounts(updatedAccounts);
                setLastSyncTime(new Date());
              });
            }
          });

          return () => {
            if (updateDebounceRef.current) {
              clearTimeout(updateDebounceRef.current);
            }
            unsubscribeAccounts();
            unsubscribeData();
          };
        }
      } catch (error) {
        appLogger.error('Failed to initialize data', error);
        appLogger.error('Initialization details', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        setSyncError('Failed to load data. Using offline mode.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [user, isLoaded]);

  // Refresh data from source
  const _refreshData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await DataService.refreshData();
      setAccounts(data.accounts);
      setTransactions(data.transactions);
      setBudgets(data.budgets);
      setGoals(data.goals);
      if (data.categories.length > 0) {
        setCategories(data.categories);
      }
      setLastSyncTime(new Date());
      setSyncError(null);
    } catch (error) {
      appLogger.error('Failed to refresh data', error);
      setSyncError('Failed to sync data');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Account operations
  const addAccount = useCallback(async (account: Omit<Account, 'id'> & { initialBalance?: number }) => {
    try {
      appLogger.info('Adding account', account);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const accountToCreate = {
        ...account,
        balance: account.initialBalance || account.balance || 0,
        initialBalance: account.initialBalance || account.balance || 0,
        isActive: account.isActive !== undefined ? account.isActive : true
      };
      
      // Create in database directly and wait for response
      const newAccount = await SimpleAccountService.createAccount(user.id, accountToCreate);
      appLogger.info('Account created', newAccount);
      
      // Add to state
      setAccounts(prev => [...prev, newAccount]);
      
      // Don't queue for sync - it's already in the database!
      // AutoSyncService is for offline-created items only
      
      return newAccount;
    } catch (error) {
      appLogger.error('Failed to add account', error);
      throw error;
    }
  }, [user]);

  const updateAccount = useCallback(async (id: string, updates: Partial<Account>) => {
    try {
      recentLocalUpdateRef.current = Date.now();
      const updatedAccount = await DataService.updateAccount(id, updates);
      setAccounts(prev => prev.map(a => a.id === id ? updatedAccount : a));
    } catch (error) {
      appLogger.error('Failed to update account', error);
      throw error;
    }
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      await DataService.deleteAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      // Also remove related transactions
      setTransactions(prev => prev.filter(t => t.accountId !== id));
    } catch (error) {
      appLogger.error('Failed to delete account', error);
      throw error;
    }
  }, []);

  // Transaction operations
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    try {
      const newTransaction = await DataService.createTransaction(transaction);
      setTransactions(prev => [...prev, newTransaction]);
      
      // Update account balance locally for immediate UI feedback.
      // Decimal arithmetic — float math is banned on money values. The DB
      // balance is adjusted atomically inside create_transaction_atomic.
      setAccounts(prev => prev.map(acc => {
        if (acc.id === transaction.accountId) {
          return {
            ...acc,
            balance: toDecimal(acc.balance || 0).plus(toDecimal(transaction.amount)).toNumber()
          };
        }
        return acc;
      }));
    } catch (error) {
      appLogger.error('Failed to add transaction', error);
      throw error;
    }
  }, []);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    try {
      const oldTransaction = transactions.find(t => t.id === id);
      const updatedTransaction = await DataService.updateTransaction(id, updates);
      setTransactions(prev => prev.map(t => t.id === id ? updatedTransaction : t));
      
      // Update account balance if amount changed (Decimal arithmetic; the DB
      // balance is adjusted atomically inside update_transaction_atomic).
      if (oldTransaction && updates.amount !== undefined && updates.amount !== oldTransaction.amount) {
        const difference = toDecimal(updates.amount).minus(toDecimal(oldTransaction.amount));
        setAccounts(prev => prev.map(acc => {
          if (acc.id === oldTransaction.accountId) {
            return {
              ...acc,
              balance: toDecimal(acc.balance || 0).plus(difference).toNumber()
            };
          }
          return acc;
        }));
      }
    } catch (error) {
      appLogger.error('Failed to update transaction', error);
      throw error;
    }
  }, [transactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      const transaction = transactions.find(t => t.id === id);
      await DataService.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      
      // Update account balance (Decimal arithmetic; the DB balance is reversed
      // atomically inside delete_transaction_atomic).
      if (transaction) {
        setAccounts(prev => prev.map(acc => {
          if (acc.id === transaction.accountId) {
            return {
              ...acc,
              balance: toDecimal(acc.balance || 0).minus(toDecimal(transaction.amount)).toNumber()
            };
          }
          return acc;
        }));
      }
    } catch (error) {
      appLogger.error('Failed to delete transaction', error);
      throw error;
    }
  }, [transactions]);

  // Budget operations — persisted via PlanningService (Supabase or local)
  const addBudget = useCallback(async (budget: Omit<Budget, 'id' | 'spent'>) => {
    try {
      const created = await PlanningService.createBudget(
        userIdService.getCurrentDatabaseUserId(),
        budget
      );
      setBudgets(prev => [...prev, created]);
    } catch (error) {
      appLogger.error('Failed to add budget', error);
      throw error;
    }
  }, []);

  const updateBudget = useCallback(async (id: string, updates: Partial<Budget>) => {
    try {
      const updated = await PlanningService.updateBudget(
        userIdService.getCurrentDatabaseUserId(),
        id,
        updates
      );
      setBudgets(prev => prev.map(b => b.id === id ? updated : b));
    } catch (error) {
      appLogger.error('Failed to update budget', error);
      throw error;
    }
  }, []);

  const deleteBudget = useCallback(async (id: string) => {
    try {
      await PlanningService.deleteBudget(userIdService.getCurrentDatabaseUserId(), id);
      setBudgets(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      appLogger.error('Failed to delete budget', error);
      throw error;
    }
  }, []);

  // Goal operations — persisted via PlanningService (Supabase or local)
  const addGoal = useCallback(async (goal: Omit<Goal, 'id' | 'progress'>) => {
    try {
      const created = await PlanningService.createGoal(
        userIdService.getCurrentDatabaseUserId(),
        goal
      );
      setGoals(prev => [...prev, created]);
    } catch (error) {
      appLogger.error('Failed to add goal', error);
      throw error;
    }
  }, []);

  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    try {
      const updated = await PlanningService.updateGoal(
        userIdService.getCurrentDatabaseUserId(),
        id,
        updates
      );
      setGoals(prev => prev.map(g => g.id === id ? updated : g));
    } catch (error) {
      appLogger.error('Failed to update goal', error);
      throw error;
    }
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    try {
      await PlanningService.deleteGoal(userIdService.getCurrentDatabaseUserId(), id);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      appLogger.error('Failed to delete goal', error);
      throw error;
    }
  }, []);

  const contributeToGoal = useCallback(async (id: string, amount: number) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newProgress = toDecimal(goal.progress || 0)
      .plus(toDecimal(amount))
      .toNumber();
    const cappedProgress = Math.min(newProgress, goal.targetAmount);
    try {
      const updated = await PlanningService.updateGoal(
        userIdService.getCurrentDatabaseUserId(),
        id,
        { progress: cappedProgress, currentAmount: cappedProgress }
      );
      setGoals(prev => prev.map(g => g.id === id ? updated : g));
    } catch (error) {
      appLogger.error('Failed to contribute to goal', error);
      throw error;
    }
  }, [goals]);

  // Category operations — persisted via PlanningService (Supabase when
  // signed in, encrypted localStorage otherwise).
  const addCategory = useCallback(async (category: Omit<Category, 'id'>) => {
    try {
      const created = await PlanningService.createCategory(
        userIdService.getCurrentDatabaseUserId(),
        category
      );
      setCategories(prev => [...prev, created]);
    } catch (error) {
      appLogger.error('Failed to add category', error);
      throw error;
    }
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    try {
      const updated = await PlanningService.updateCategory(
        userIdService.getCurrentDatabaseUserId(),
        id,
        updates
      );
      setCategories(prev => prev.map(c => c.id === id ? updated : c));
    } catch (error) {
      appLogger.error('Failed to update category', error);
      throw error;
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      await PlanningService.deleteCategory(userIdService.getCurrentDatabaseUserId(), id);
      // Children go with the parent (cloud FK is ON DELETE CASCADE; mirror it)
      setCategories(prev => prev.filter(c => c.id !== id && c.parentId !== id));
    } catch (error) {
      appLogger.error('Failed to delete category', error);
      throw error;
    }
  }, []);

  const getSubCategories = useCallback((parentId: string) => {
    return categories.filter(c => c.parentId === parentId);
  }, [categories]);

  const getDetailCategories = useCallback((parentId: string) => {
    return categories.filter(c => c.parentId === parentId);
  }, [categories]);

  // Tag operations
  const addTag = useCallback((tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTag: Tag = {
      ...tag,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setTags(prev => [...prev, newTag]);
  }, []);

  const updateTag = useCallback((id: string, updates: Partial<Tag>) => {
    setTags(prev => prev.map(t => 
      t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
    ));
  }, []);

  const deleteTag = useCallback((id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
  }, []);

  const getTagUsageCount = useCallback((tagName: string) => {
    return transactions.filter(t => t.tags?.includes(tagName) ?? false).length;
  }, [transactions]);

  const getAllUsedTags = useCallback(() => {
    const tagSet = new Set<string>();
    transactions.forEach(t => {
      if (t.tags) {
        t.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  }, [transactions]);

  // Import/Export operations
  const importData = useCallback((data: Partial<AppState>) => {
    if (data.accounts) setAccounts(data.accounts);
    if (data.transactions) setTransactions(data.transactions);
    if (data.budgets) setBudgets(data.budgets);
    if (data.goals) setGoals(data.goals);
    if (data.categories) setCategories(data.categories);
    if (data.tags) setTags(data.tags);
    if (data.recurringTransactions) setRecurringTransactions(data.recurringTransactions);
  }, []);

  const exportData = useCallback((): string => {
    const data = {
      accounts,
      transactions,
      budgets,
      goals,
      categories,
      tags,
      recurringTransactions,
      isLoading: false,
      isSyncing: false,
      isUsingSupabase: true,
      hasTestData: false
    };
    return JSON.stringify(data, null, 2);
  }, [accounts, transactions, budgets, goals, categories, tags, recurringTransactions]);

  const getDecimalTransactions = useCallback((): DecimalTransaction[] => {
    // Convert all transactions to decimal format for precise calculations
    return transactions.map(toDecimalTransaction);
  }, [transactions]);

  const getDecimalAccounts = useCallback((): DecimalAccount[] => {
    // Convert all accounts to decimal format for precise calculations
    return accounts.map(toDecimalAccount);
  }, [accounts]);

  const getDecimalGoals = useCallback((): DecimalGoal[] => {
    // Convert all goals to decimal format for precise calculations
    return goals.map(toDecimalGoal);
  }, [goals]);

  const clearAllData = useCallback(async () => {
    setAccounts([]);
    setTransactions([]);
    setBudgets([]);
    setGoals([]);
    setCategories(getDefaultCategories());
    setTags([]);
    setRecurringTransactions([]);
  }, []);

  const loadTestData = useCallback(() => {
    // Load test data - this would be implemented with actual test data
    appLogger.info('Loading test data');
  }, []);

  const value: AppContextType = {
    // State
    accounts,
    transactions,
    budgets,
    goals,
    categories,
    tags,
    recurringTransactions,
    
    // Account operations
    addAccount,
    updateAccount,
    deleteAccount,
    
    // Transaction operations
    addTransaction,
    updateTransaction,
    deleteTransaction,
    
    // Budget operations
    addBudget,
    updateBudget,
    deleteBudget,
    
    // Goal operations
    addGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal,
    
    // Category operations
    addCategory,
    updateCategory,
    deleteCategory,
    getSubCategories,
    getDetailCategories,
    
    // Tag operations
    addTag,
    updateTag,
    deleteTag,
    getTagUsageCount,
    getAllUsedTags,
    
    // Other operations
    importData,
    exportData,
    clearAllData,
    getDecimalTransactions,
    getDecimalAccounts,
    getDecimalGoals,
    
    // Sync status
    isLoading,
    isSyncing,
    lastSyncTime,
    syncError,
    isUsingSupabase,
    hasTestData: false,
    loadTestData
  };

  // The value object is always defined, no need to check

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    appLogger.error('useApp called outside of AppProvider');
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
