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
import { getDefaultCategories } from '../data/defaultCategories';
import { formatCurrency } from '../utils/formatters';
import { 
  toDecimalTransaction, 
  toDecimalAccount, 
  toDecimalGoal 
} from '../utils/decimal-converters';
import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('AppContextSupabase');
import type { 
  Account, 
  Transaction, 
  Category, 
  Budget, 
  Goal, 
  RecurringTransaction,
  Investment
} from '../types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

type AccountRow = Database['public']['Tables']['accounts']['Row'];

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

type AppState = {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
  tags: Tag[];
  recurringTransactions: RecurringTransaction[];
  investments: Investment[];
};

interface AppContextType extends AppState {
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
  getDecimalTransactions: () => any[]; // Returns DecimalTransaction[] for decimal calculations
  getDecimalAccounts: () => any[]; // Returns DecimalAccount[] for decimal calculations
  getDecimalGoals: () => any[]; // Returns DecimalGoal[] for decimal calculations
  
  // Sync status
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  isUsingSupabase: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isUsingSupabase, setIsUsingSupabase] = useState(false);
  
  // Refs to prevent duplicate updates and manage debouncing
  const lastUpdateRef = useRef<{ type: string; timestamp: number } | null>(null);
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize data service and load data
  useEffect(() => {
    if (!isLoaded) return;

    const initializeData = async () => {
      setIsLoading(true);
      setSyncError(null);

      try {
        logger.debug('[AppContext] Initializing with user:', { userId: user?.id });
        // Initialize DataService with user info
        if (user) {
          logger.debug('[AppContext] User found, initializing services');
          
          // Initialize userIdService first - this is now the single source of truth
          const databaseId = await userIdService.ensureUserExists(
            user.id,
            user.emailAddresses[0]?.emailAddress || '',
            user.firstName || undefined,
            user.lastName || undefined
          );
          
          if (databaseId) {
            logger.debug('[AppContext] Database user ID resolved');
            
            // Initialize AutoSync with the database ID ready
            await AutoSyncService.initialize(user.id);
            
            await DataService.initialize(
              user.id,
              user.emailAddresses[0]?.emailAddress || '',
              user.firstName || undefined,
              user.lastName || undefined
            );
            
            logger.debug('[AppContext] Loading app data...');
            
            // Use the database ID we just got - no need to fetch it again!
            const accounts = await SimpleAccountService.getAccounts(databaseId);
            logger.debug('[AppContext] Accounts loaded', { count: accounts.length });
            setAccounts(accounts);
          } else {
            logger.warn('[AppContext] Failed to resolve database user ID - no data will be loaded');
            setAccounts([]);
            setInvestments([]);
          }
        } else {
          // No user logged in
          logger.debug('[AppContext] No user logged in');
          setAccounts([]);
          setInvestments([]);
        }
        
        // Load other data through DataService for now
        const data = await DataService.loadAppData();
        setTransactions(data.transactions);
        setBudgets(data.budgets);
        setGoals(data.goals);
        setInvestments(data.investments ?? []);
        
        // Use default categories if none exist
        if (data.categories.length === 0) {
          setCategories(getDefaultCategories());
        } else {
          setCategories(data.categories);
        }

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
              logger.debug(`[AppContext] Skipping duplicate ${updateType} update`);
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
            async (payload: RealtimePostgresChangesPayload<AccountRow>) => {
              logger.debug('[AppContext] Real-time account update received:', payload);
              logger.debug('[AppContext] Update type:', payload.eventType);
              
              // Handle different event types
              if (payload.eventType === 'UPDATE' && payload.new && !payload.new.is_active) {
                logger.info('[AppContext] Account was soft-deleted (is_active = false)');
              }
              
              debouncedUpdate('account', async () => {
                logger.debug('[AppContext] Reloading accounts after real-time update');
                // Reload accounts when any change happens
                const updatedAccounts = await SimpleAccountService.getAccounts(user.id);
                logger.debug('[AppContext] Updated accounts:', { count: updatedAccounts.length });
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
              logger.debug('[AppContext] Transaction update:', payload);
              
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
        logger.error('[AppContext] Failed to initialize data:', error);
        logger.error('[AppContext] Error details:', {
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
  const refreshData = useCallback(async () => {
    setIsSyncing(true);
    try {
    const data = await DataService.refreshData();
      setAccounts(data.accounts);
      setTransactions(data.transactions);
      setBudgets(data.budgets);
      setGoals(data.goals);
      setInvestments(data.investments ?? []);
      if (data.categories.length > 0) {
        setCategories(data.categories);
      }
      setLastSyncTime(new Date());
      setSyncError(null);
    } catch (error) {
      logger.error('Failed to refresh data:', error);
      setSyncError('Failed to sync data');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Account operations
  const addAccount = useCallback(async (account: Omit<Account, 'id'> & { initialBalance?: number }) => {
    try {
      logger.info('[AppContext] Adding account:', account);
      
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
      logger.info('[AppContext] Account created:', newAccount);
      
      // Add to state
      setAccounts(prev => [...prev, newAccount]);
      
      // Create transfer category for this account
      const transferCategory: Omit<Category, 'id'> = {
        name: `To/From ${newAccount.name}`,
        type: 'both',
        level: 'detail',
        parentId: 'type-transfer',
        isSystem: true,
        isTransferCategory: true,
        accountId: newAccount.id
      };
      
      // Add the transfer category with a specific ID
      const newCategory: Category = {
        ...transferCategory,
        id: `transfer-${newAccount.id}`
      };
      setCategories(prev => [...prev, newCategory]);
      logger.info('[AppContext] Transfer category created for account', newCategory);
      
      // Don't queue for sync - it's already in the database!
      // AutoSyncService is for offline-created items only
      
      return newAccount;
      return newAccount;
    } catch (error) {
      logger.error('[AppContext] Failed to add account:', error);
      throw error;
    }
  }, [user]);

  const updateAccount = useCallback(async (id: string, updates: Partial<Account>) => {
    try {
      const updatedAccount = await DataService.updateAccount(id, updates);
      setAccounts(prev => prev.map(a => a.id === id ? updatedAccount : a));
      
      // If the account name was updated, update the transfer category name too
      if (updates.name) {
        const transferCategoryId = `transfer-${id}`;
        setCategories(prev => prev.map(cat => 
          cat.id === transferCategoryId 
            ? { ...cat, name: `To/From ${updates.name}` }
            : cat
        ));
      }

      return updatedAccount;
    } catch (error) {
      logger.error('Failed to update account:', error);
      throw error;
    }
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      await DataService.deleteAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      // Also remove related transactions
      setTransactions(prev => prev.filter(t => t.accountId !== id));
      
      // Soft-delete the transfer category (mark as inactive rather than delete)
      // This preserves historical transfer records
      const transferCategoryId = `transfer-${id}`;
      setCategories(prev => prev.map(cat => 
        cat.id === transferCategoryId 
          ? { ...cat, isActive: false } // Mark as inactive instead of deleting
          : cat
      ));
    } catch (error) {
      logger.error('Failed to delete account:', error);
      throw error;
    }
  }, []);

  // Transaction operations
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    try {
      const newTransaction = await DataService.createTransaction(transaction);
      let resultTransaction = newTransaction;
      setTransactions(prev => [...prev, newTransaction]);
      
      // Update account balance locally for immediate UI feedback
      setAccounts(prev => prev.map(acc => {
        if (acc.id === transaction.accountId) {
          return {
            ...acc,
            balance: (acc.balance || 0) + transaction.amount
          };
        }
        return acc;
      }));
      
      // Handle linked transfer creation
      if (transaction.type === 'transfer' && transaction.category) {
        // Check if this is a transfer category
        const transferCategory = categories.find(cat => cat.id === transaction.category);
        if (transferCategory?.isTransferCategory && transferCategory.accountId) {
          // Create the opposite transaction in the target account
          const linkedTransaction: Omit<Transaction, 'id'> = {
            ...transaction,
            accountId: transferCategory.accountId, // Target account
            amount: -transaction.amount, // Opposite amount
            linkedTransferId: newTransaction.id, // Link to the original
            // Keep all other fields the same (date, description, etc.)
          };
          
          // Create the linked transaction
          const newLinkedTransaction = await DataService.createTransaction(linkedTransaction);
          
          // Update the original transaction with the linked ID
          const updatedOriginal = await DataService.updateTransaction(newTransaction.id, {
            linkedTransferId: newLinkedTransaction.id
          });
          
          // Update local state
          setTransactions(prev => {
            const filtered = prev.filter(t => t.id !== newTransaction.id);
            return [...filtered, updatedOriginal, newLinkedTransaction];
          });
          
          // Update the target account balance
          setAccounts(prev => prev.map(acc => {
            if (acc.id === transferCategory.accountId) {
              return {
                ...acc,
                balance: (acc.balance || 0) - transaction.amount // Opposite of original
              };
            }
            return acc;
          }));
          
          logger.info('[AppContext] Linked transfer created:', { original: updatedOriginal, linked: newLinkedTransaction });
          resultTransaction = updatedOriginal;
        }
      }

      return resultTransaction;
    } catch (error) {
      logger.error('Failed to add transaction:', error);
      throw error;
    }
  }, [categories]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    try {
      const oldTransaction = transactions.find(t => t.id === id);
      const updatedTransaction = await DataService.updateTransaction(id, updates);
      setTransactions(prev => prev.map(t => t.id === id ? updatedTransaction : t));
      
      // Update account balance if amount changed
      if (oldTransaction && updates.amount !== undefined && updates.amount !== oldTransaction.amount) {
        const difference = updates.amount - oldTransaction.amount;
        setAccounts(prev => prev.map(acc => {
          if (acc.id === oldTransaction.accountId) {
            return {
              ...acc,
              balance: (acc.balance || 0) + difference
            };
          }
          return acc;
        }));
      }
      
      // Handle linked transfer updates
      if (oldTransaction?.linkedTransferId) {
        const linkedTransaction = transactions.find(t => t.id === oldTransaction.linkedTransferId);
        
        if (linkedTransaction) {
          // Check if category changed (transfer to different account)
          if (updates.category !== undefined && updates.category !== oldTransaction.category) {
            const newCategory = categories.find(cat => cat.id === updates.category);
            
            if (newCategory?.isTransferCategory) {
              // Delete old linked transaction
              await DataService.deleteTransaction(linkedTransaction.id);
              setTransactions(prev => prev.filter(t => t.id !== linkedTransaction.id));
              
              // Update old target account balance
              setAccounts(prev => prev.map(acc => {
                if (acc.id === linkedTransaction.accountId) {
                  return {
                    ...acc,
                    balance: (acc.balance || 0) - linkedTransaction.amount
                  };
                }
                return acc;
              }));
              
              // Create new linked transaction in new account
              if (newCategory.accountId) {
                const newLinkedTransaction: Omit<Transaction, 'id'> = {
                  ...updatedTransaction,
                  accountId: newCategory.accountId,
                  amount: -(updates.amount !== undefined ? updates.amount : oldTransaction.amount),
                  linkedTransferId: id
                };
                
                const createdLinked = await DataService.createTransaction(newLinkedTransaction);
                setTransactions(prev => [...prev, createdLinked]);
                
                // Update new target account balance
                setAccounts(prev => prev.map(acc => {
                  if (acc.id === newCategory.accountId) {
                    return {
                      ...acc,
                      balance: (acc.balance || 0) + newLinkedTransaction.amount
                    };
                  }
                  return acc;
                }));
                
                // Update original with new linked ID
                await DataService.updateTransaction(id, { linkedTransferId: createdLinked.id });
              }
            } else {
              // Category changed to non-transfer, remove link
              await DataService.deleteTransaction(linkedTransaction.id);
              const { linkedTransferId, ...updateData } = updatedTransaction;
              await DataService.updateTransaction(id, updateData);
              setTransactions(prev => prev.filter(t => t.id !== linkedTransaction.id));
            }
          } else {
            // Update existing linked transaction
            const linkedUpdates: Partial<Transaction> = {};
            
            if (updates.amount !== undefined) {
              linkedUpdates.amount = -updates.amount;
            }
            if (updates.date !== undefined) {
              linkedUpdates.date = updates.date;
            }
            if (updates.description !== undefined) {
              linkedUpdates.description = updates.description;
            }
            
            if (Object.keys(linkedUpdates).length > 0) {
              const updatedLinked = await DataService.updateTransaction(linkedTransaction.id, linkedUpdates);
              setTransactions(prev => prev.map(t => t.id === linkedTransaction.id ? updatedLinked : t));
              
              // Update linked account balance if amount changed
              if (linkedUpdates.amount !== undefined) {
                const linkedDifference = linkedUpdates.amount - linkedTransaction.amount;
                setAccounts(prev => prev.map(acc => {
                  if (acc.id === linkedTransaction.accountId) {
                    return {
                      ...acc,
                      balance: (acc.balance || 0) + linkedDifference
                    };
                  }
                  return acc;
                }));
              }
            }
          }
        }
      }

      return updatedTransaction;
    } catch (error) {
      logger.error('Failed to update transaction:', error);
      throw error;
    }
  }, [transactions, categories]);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      const transaction = transactions.find(t => t.id === id);
      
      // Handle linked transfer deletion
      if (transaction?.linkedTransferId) {
        const linkedTransaction = transactions.find(t => t.id === transaction.linkedTransferId);
        
        if (linkedTransaction) {
          // Check if this is the original transaction (has a transfer category)
          const category = categories.find(cat => cat.id === transaction.category);
          
          if (category?.isTransferCategory) {
            // This is the original, delete both transactions
            await DataService.deleteTransaction(linkedTransaction.id);
            setTransactions(prev => prev.filter(t => t.id !== linkedTransaction.id));
            
            // Update linked account balance
            setAccounts(prev => prev.map(acc => {
              if (acc.id === linkedTransaction.accountId) {
                return {
                  ...acc,
                  balance: (acc.balance || 0) - linkedTransaction.amount
                };
              }
              return acc;
            }));
          } else {
            // This is the linked transaction, just remove the category from original
            const originalTransaction = transactions.find(t => t.linkedTransferId === id);
            if (originalTransaction) {
              const { linkedTransferId, ...originalData } = originalTransaction;
              await DataService.updateTransaction(originalTransaction.id, {
                ...originalData,
                category: ''
              });
              setTransactions(prev => prev.map(t =>
                t.id === originalTransaction.id
                  ? (() => {
                      const { linkedTransferId, ...tData } = t;
                      return { ...tData, category: '' };
                    })()
                  : t
              ));
            }
          }
        }
      }
      
      // Delete the transaction itself
      await DataService.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      
      // Update account balance
      if (transaction) {
        setAccounts(prev => prev.map(acc => {
          if (acc.id === transaction.accountId) {
            return {
              ...acc,
              balance: (acc.balance || 0) - transaction.amount
            };
          }
          return acc;
        }));
      }
    } catch (error) {
      logger.error('Failed to delete transaction:', error);
      throw error;
    }
  }, [transactions, categories]);

  // Budget operations using DataService
  const addBudget = useCallback(async (budget: Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt'>) => {
    try {
      const budgetInput: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'> = {
        ...budget,
        spent: 0
      };
      const newBudget = await DataService.createBudget(budgetInput);
      setBudgets(prev => [...prev, newBudget]);
      return newBudget;
    } catch (error) {
      logger.error('Failed to create budget:', error);
      throw error;
    }
  }, []);

  const updateBudget = useCallback(async (id: string, updates: Partial<Budget>) => {
    try {
      const updatedBudget = await DataService.updateBudget(id, updates);
      setBudgets(prev => prev.map(b => b.id === id ? updatedBudget : b));
      return updatedBudget;
    } catch (error) {
      logger.error('Failed to update budget:', error);
      throw error;
    }
  }, []);

  const deleteBudget = useCallback(async (id: string) => {
    try {
      await DataService.deleteBudget(id);
      setBudgets(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      logger.error('Failed to delete budget:', error);
      throw error;
    }
  }, []);

  // Goal operations using DataService
  const addGoal = useCallback(async (goal: Omit<Goal, 'id' | 'progress' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newGoal = await DataService.createGoal(goal);
      setGoals(prev => [...prev, newGoal]);
      return newGoal;
    } catch (error) {
      logger.error('Failed to create goal:', error);
      throw error;
    }
  }, []);

  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    try {
      const updatedGoal = await DataService.updateGoal(id, updates);
      setGoals(prev => prev.map(g => g.id === id ? updatedGoal : g));
      return updatedGoal;
    } catch (error) {
      logger.error('Failed to update goal:', error);
      throw error;
    }
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    try {
      await DataService.deleteGoal(id);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      logger.error('Failed to delete goal:', error);
      throw error;
    }
  }, []);

  const contributeToGoal = useCallback(async (id: string, amount: number) => {
    try {
      const goal = goals.find(g => g.id === id);
      if (!goal) throw new Error('Goal not found');
      
      const newCurrentAmount = Math.min(goal.currentAmount + amount, goal.targetAmount);
      const updatedGoal = await DataService.updateGoal(id, {
        currentAmount: newCurrentAmount
      });
      
      setGoals(prev => prev.map(g => g.id === id ? updatedGoal : g));
      return updatedGoal;
    } catch (error) {
      logger.error('Failed to contribute to goal:', error);
      throw error;
    }
  }, [goals]);

  // Category operations (still using localStorage for now)
  const addCategory = useCallback((category: Omit<Category, 'id'>) => {
    const newCategory: Category = {
      ...category,
      id: crypto.randomUUID()
    };
    setCategories(prev => [...prev, newCategory]);
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id && c.parentId !== id));
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

  const normalizeDate = (value: Date | string | undefined): Date | undefined => {
    if (!value) {
      return undefined;
    }
    return value instanceof Date ? value : new Date(value);
  };

  const addRecurringTransaction = useCallback((transaction: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt' | 'nextDate'> & { nextDate?: Date }) => {
    const createdAt = new Date();
    const startDate = transaction.startDate instanceof Date ? transaction.startDate : new Date(transaction.startDate);
    const nextDate = transaction.nextDate ?? startDate;
    const normalizedEndDate = normalizeDate(transaction.endDate);
    const normalizedLastProcessed = normalizeDate(transaction.lastProcessed);

    const recurring: RecurringTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
      startDate,
      nextDate,
      createdAt,
      updatedAt: createdAt
    };

    if (normalizedEndDate) {
      recurring.endDate = normalizedEndDate;
    }

    if (normalizedLastProcessed) {
      recurring.lastProcessed = normalizedLastProcessed;
    }

    setRecurringTransactions(prev => [...prev, recurring]);
    return recurring;
  }, [normalizeDate]);

  const updateRecurringTransaction = useCallback((id: string, updates: Partial<RecurringTransaction>) => {
    let updatedRecurring: RecurringTransaction | undefined;
    setRecurringTransactions(prev => prev.map(recurring => {
      if (recurring.id !== id) {
        return recurring;
      }

      const normalizedEndDate = updates.endDate === undefined ? recurring.endDate : normalizeDate(updates.endDate);
      const normalizedLastProcessed = updates.lastProcessed === undefined ? recurring.lastProcessed : normalizeDate(updates.lastProcessed);
      const normalizedStartDate = updates.startDate ? (updates.startDate instanceof Date ? updates.startDate : new Date(updates.startDate)) : recurring.startDate;
      const normalizedNextDate = updates.nextDate ? (updates.nextDate instanceof Date ? updates.nextDate : new Date(updates.nextDate)) : recurring.nextDate;

      const nextRecurring: RecurringTransaction = {
        ...recurring,
        ...updates,
        startDate: normalizedStartDate,
        nextDate: normalizedNextDate,
        updatedAt: new Date()
      };

      if (normalizedEndDate) {
        nextRecurring.endDate = normalizedEndDate;
      } else {
        delete (nextRecurring as { endDate?: Date }).endDate;
      }

      if (normalizedLastProcessed) {
        nextRecurring.lastProcessed = normalizedLastProcessed;
      } else {
        delete (nextRecurring as { lastProcessed?: Date }).lastProcessed;
      }

      updatedRecurring = nextRecurring;
      return nextRecurring;
    }));

    return updatedRecurring;
  }, [normalizeDate]);

  const deleteRecurringTransaction = useCallback((id: string) => {
    setRecurringTransactions(prev => prev.filter(recurring => recurring.id !== id));
  }, []);

  // Import/Export operations
  const importData = useCallback((data: Partial<AppState>) => {
    if (data.accounts) setAccounts(data.accounts);
    if (data.transactions) setTransactions(data.transactions);
    if (data.budgets) setBudgets(data.budgets);
    if (data.goals) setGoals(data.goals);
    if (data.categories) setCategories(data.categories);
    if (data.tags) setTags(data.tags);
    if (data.recurringTransactions) setRecurringTransactions(data.recurringTransactions);
    if (data.investments) setInvestments(data.investments);
  }, []);

  const exportData = useCallback((): AppState => {
    return {
      accounts,
      transactions,
      budgets,
      goals,
      categories,
      tags,
      recurringTransactions,
      investments
    };
  }, [accounts, transactions, budgets, goals, categories, tags, recurringTransactions, investments]);

  const getDecimalTransactions = useCallback(() => {
    // Convert all transactions to decimal format for precise calculations
    return transactions.map(toDecimalTransaction);
  }, [transactions]);

  const getDecimalAccounts = useCallback(() => {
    // Convert all accounts to decimal format for precise calculations
    return accounts.map(toDecimalAccount);
  }, [accounts]);

  const getDecimalGoals = useCallback(() => {
    // Convert all goals to decimal format for precise calculations
    return goals.map(toDecimalGoal);
  }, [goals]);

  const clearAllData = useCallback(() => {
    setAccounts([]);
    setTransactions([]);
    setBudgets([]);
    setGoals([]);
    setCategories(getDefaultCategories());
    setTags([]);
    setRecurringTransactions([]);
    setInvestments([]);
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
    investments,
    
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

    // Recurring transactions
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    
    // Other operations
    importData,
    exportData,
    clearAllData,
    refreshData,
    getDecimalTransactions,
    getDecimalAccounts,
    getDecimalGoals,
    
    // Sync status
    isLoading,
    isSyncing,
    lastSyncTime,
    syncError,
    isUsingSupabase
  };

  // The value object is always defined, no need to check

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    logger.error('useApp called outside of AppProvider');
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
