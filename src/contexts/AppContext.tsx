/* eslint-disable react-refresh/only-export-components */
// AppContext with secure encrypted storage and internal Decimal support
import { createContext, useContext, type ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  getDefaultTestAccounts, 
  getDefaultTestTransactions, 
  getDefaultTestBudgets, 
  getDefaultTestGoals 
} from '../data/defaultTestData';
import { getDefaultCategories, getMinimalSystemCategories } from '../data/defaultCategories';
import type { Account, Transaction, Budget, Goal, Investment } from '../types';
import type { DecimalAccount, DecimalTransaction, DecimalBudget, DecimalGoal } from '../types/decimal-types';
import { 
  toDecimalAccount, toDecimalTransaction, toDecimalBudget, toDecimalGoal,
  fromDecimalAccount, fromDecimalTransaction, fromDecimalBudget, fromDecimalGoal
} from '../utils/decimal-converters';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import { recalculateAccountBalances } from '../utils/recalculateBalances';
import { smartCategorizationService } from '../services/smartCategorizationService';
import { useMemoizedLogger } from '../loggers/useMemoizedLogger';
import { storageAdapter, STORAGE_KEYS } from '../services/storageAdapter';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
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

// Internal Decimal version of RecurringTransaction
interface DecimalRecurringTransaction extends Omit<RecurringTransaction, 'amount'> {
  amount: DecimalInstance;
}

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
  // Add required methods
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
  // Decimal getters for precision calculations
  getDecimalTransactions: () => DecimalTransaction[];
  getDecimalAccounts: () => DecimalAccount[];
  getDecimalBudgets: () => DecimalBudget[];
  getDecimalGoals: () => DecimalGoal[];
  // Additional properties
  investments?: Investment[];
  getAllUsedTags: () => string[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper functions for type conversion
function toDecimalRecurringTransaction(recurring: RecurringTransaction): DecimalRecurringTransaction {
  return {
    ...recurring,
    amount: toDecimal(recurring.amount)
  };
}

function fromDecimalRecurringTransaction(recurring: DecimalRecurringTransaction): RecurringTransaction {
  return {
    ...recurring,
    amount: recurring.amount.toNumber()
  };
}

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const logger = useMemoizedLogger('AppContext');
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Internal state uses Decimal types for precision
  const [decimalTransactions, setDecimalTransactions] = useState<DecimalTransaction[]>([]);
  const [decimalAccounts, setDecimalAccounts] = useState<DecimalAccount[]>([]);
  const [decimalBudgets, setDecimalBudgets] = useState<DecimalBudget[]>([]);
  const [decimalGoals, setDecimalGoals] = useState<DecimalGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [decimalRecurringTransactions, setDecimalRecurringTransactions] = useState<DecimalRecurringTransaction[]>([]);

  // Initialize secure storage
  useEffect((): void => {
    const initStorage = async (): Promise<void> => {
      try {
        await storageAdapter.init();
        setIsStorageReady(true);
      } catch (error) {
        logger.error?.('Failed to initialize storage', error);
        // Continue with localStorage fallback
        setIsStorageReady(true);
      }
    };
    initStorage();
  }, [logger]);

  // Load data from secure storage
  useEffect(() => {
    if (!isStorageReady) return;

    let isMounted = true;

    const loadData = async (): Promise<void> => {
      try {
        setIsLoading(true);

        // Check if data was cleared
        const dataCleared = await storageAdapter.get<boolean>('wealthtracker_data_cleared');
        if (!isMounted) return;
        
        // Load transactions
        const savedTransactions = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
        if (!isMounted) return;
        if (savedTransactions) {
          setDecimalTransactions(savedTransactions.map(toDecimalTransaction));
        } else if (!dataCleared) {
          setDecimalTransactions(getDefaultTestTransactions().map(toDecimalTransaction));
        }

        // Load accounts
        const savedAccounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
        if (!isMounted) return;
        if (savedAccounts) {
          setDecimalAccounts(savedAccounts.map(toDecimalAccount));
        } else if (!dataCleared) {
          const testAccounts = getDefaultTestAccounts();
          const testTransactions = getDefaultTestTransactions();
          const accountsWithBalances = recalculateAccountBalances(testAccounts, testTransactions);
          setDecimalAccounts(accountsWithBalances.map(toDecimalAccount));
        }

        // Load budgets
        const savedBudgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS);
        if (!isMounted) return;
        if (savedBudgets) {
          setDecimalBudgets(savedBudgets.map(toDecimalBudget));
        } else if (!dataCleared) {
          setDecimalBudgets(getDefaultTestBudgets().map(toDecimalBudget));
        }

        // Load goals
        const savedGoals = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS);
        if (!isMounted) return;
        if (savedGoals) {
          setDecimalGoals(savedGoals.map(toDecimalGoal));
        } else if (!dataCleared) {
          setDecimalGoals(getDefaultTestGoals().map(toDecimalGoal));
        }

        // Load categories
        const savedCategories = await storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES);
        if (!isMounted) return;
        if (savedCategories) {
          setCategories(savedCategories);
        } else {
          setCategories(getDefaultCategories());
        }

        // Load tags
        const savedTags = await storageAdapter.get<Tag[]>(STORAGE_KEYS.TAGS);
        if (!isMounted) return;
        if (savedTags) {
          setTags(savedTags);
        }

        // Load recurring transactions
        const savedRecurring = await storageAdapter.get<RecurringTransaction[]>(STORAGE_KEYS.RECURRING);
        if (!isMounted) return;
        if (savedRecurring) {
          setDecimalRecurringTransactions(savedRecurring.map(toDecimalRecurringTransaction));
        }

      } catch (error) {
        logger.error?.('Error loading data', error);
        if (!isMounted) return;

        // Provide minimal working state without marking for clear
        setCategories(getMinimalSystemCategories());
        setDecimalAccounts([]);
        setDecimalTransactions([]);
        setDecimalBudgets([]);
        setDecimalGoals([]);
        setTags([]);
        setDecimalRecurringTransactions([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isStorageReady, logger]);

  // Convert Decimal types to regular types for external use
  const accounts = decimalAccounts.map(fromDecimalAccount);
  const transactions = decimalTransactions.map(fromDecimalTransaction);
  const budgets = decimalBudgets.map(fromDecimalBudget);
  const goals = decimalGoals.map(fromDecimalGoal);
  const recurringTransactions = decimalRecurringTransactions.map(fromDecimalRecurringTransaction);

  // Check if we have test data
  const hasTestData = accounts.some(acc => 
    acc.name === 'Main Checking' || acc.name === 'Savings Account'
  );

  // Save to secure storage whenever data changes
  useEffect((): void => {
    if (!isStorageReady || isLoading) return;
    storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
  }, [accounts, isStorageReady, isLoading]);
  
  useEffect((): void => {
    if (!isStorageReady || isLoading) return;
    storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, transactions);
  }, [transactions, isStorageReady, isLoading]);
  
  useEffect((): void => {
    if (!isStorageReady || isLoading) return;
    storageAdapter.set(STORAGE_KEYS.BUDGETS, budgets);
  }, [budgets, isStorageReady, isLoading]);
  
  useEffect((): void => {
    if (!isStorageReady || isLoading) return;
    storageAdapter.set(STORAGE_KEYS.GOALS, goals);
  }, [goals, isStorageReady, isLoading]);
  
  useEffect((): void => {
    if (!isStorageReady || isLoading) return;
    storageAdapter.set(STORAGE_KEYS.TAGS, tags);
  }, [tags, isStorageReady, isLoading]);
  
  useEffect((): void => {
    if (!isStorageReady || isLoading) return;
    storageAdapter.set(STORAGE_KEYS.RECURRING, recurringTransactions);
  }, [recurringTransactions, isStorageReady, isLoading]);

  useEffect((): void => {
    if (!isStorageReady || isLoading) return;
    storageAdapter.set(STORAGE_KEYS.CATEGORIES, categories);
  }, [categories, isStorageReady, isLoading]);

  const getTagUsageCount = useCallback((tagName: string): number => {
    return decimalTransactions.filter((t): boolean => t.tags?.includes(tagName) ?? false).length;
  }, [decimalTransactions]);

  const getSubCategories = useCallback((parentId: string): Category[] => {
    return categories.filter((cat): boolean => cat.parentId === parentId && cat.level === 'sub');
  }, [categories]);

  const getDetailCategories = useCallback((parentId: string): Category[] => {
    return categories.filter((cat): boolean => cat.parentId === parentId && cat.level === 'detail');
  }, [categories]);

  const getCategoryById = useCallback((id: string): Category | undefined => {
    return categories.find((cat): boolean => cat.id === id);
  }, [categories]);

  const getCategoryPath = useCallback((categoryId: string): string => {
    const category = getCategoryById(categoryId);
    if (!category) return '';
    
    const path: string[] = [category.name];
    let currentCategory = category;
    
    while (currentCategory.parentId) {
      const parent = getCategoryById(currentCategory.parentId);
      if (!parent) break;
      path.unshift(parent.name);
      currentCategory = parent;
    }
    
    return path.join(' > ');
  }, [getCategoryById]);

  const contextValue: AppContextType = useMemo(() => ({
    accounts,
    transactions,
    budgets,
    categories,
    goals,
    tags,
    hasTestData,
    isLoading,
    clearAllData: async (): Promise<void> => {
      setDecimalAccounts([]);
      setDecimalTransactions([]);
      setDecimalBudgets([]);
      setDecimalGoals([]);
      setTags([]);
      setDecimalRecurringTransactions([]);
      setCategories(getMinimalSystemCategories());
      
      // Clear all secure storage
      await storageAdapter.clear();
      
      // Set a flag to prevent loading test data on refresh
      await storageAdapter.set('wealthtracker_data_cleared', true);
      
      // Also clear session storage
      sessionStorage.removeItem('wt_migration_completed');
    },
    exportData: (): string => {
      const data = {
        accounts,
        transactions,
        budgets,
        goals,
        tags,
        categories,
        recurringTransactions,
        exportDate: new Date().toISOString(),
        version: '2.0'
      };
      return JSON.stringify(data, null, 2);
    },
    loadTestData: (): void => {
      const testTransactions = getDefaultTestTransactions();
      setDecimalTransactions(testTransactions.map(toDecimalTransaction));
      
      const testAccounts = getDefaultTestAccounts();
      const accountsWithBalances = recalculateAccountBalances(testAccounts, testTransactions);
      setDecimalAccounts(accountsWithBalances.map(toDecimalAccount));
      
      const testBudgets = getDefaultTestBudgets();
      setDecimalBudgets(testBudgets.map(toDecimalBudget));
      
      const testGoals = getDefaultTestGoals();
      setDecimalGoals(testGoals.map(toDecimalGoal));
      
      // Remove the cleared flag since we're loading data
      storageAdapter.remove('wealthtracker_data_cleared');
    },
    addAccount: (account): void => {
      const decimalAccount = toDecimalAccount({
        ...account,
        id: crypto.randomUUID(),
        lastUpdated: new Date()
      });
      setDecimalAccounts(prev => [...prev, decimalAccount]);
    },
    updateAccount: (id, updates): void => {
      setDecimalAccounts(prev => prev.map(acc => 
        acc.id === id 
          ? { ...acc, ...toDecimalAccount({ ...fromDecimalAccount(acc), ...updates }), lastUpdated: new Date() }
          : acc
      ));
    },
    deleteAccount: (id): void => {
      setDecimalAccounts((prev): DecimalAccount[] => prev.filter((acc): boolean => acc.id !== id));
      setDecimalTransactions((prev): DecimalTransaction[] => prev.filter((t): boolean => t.accountId !== id));
    },
    addTransaction: (transaction): void => {
      const newTransaction = toDecimalTransaction({
        ...transaction,
        id: crypto.randomUUID()
      });

      setDecimalTransactions(prev => [...prev, newTransaction]);
      
      // Update account balance
      setDecimalAccounts((prev): DecimalAccount[] => prev.map((acc): DecimalAccount => {
        if (acc.id === transaction.accountId) {
          const amount = newTransaction.amount;
          const newBalance = transaction.type === 'income' 
            ? acc.balance.plus(amount)
            : acc.balance.minus(amount);
          return { ...acc, balance: newBalance, lastUpdated: new Date() };
        }
        return acc;
      }));

      // Note: Budget spending tracking would need to be implemented separately
      // as DecimalBudget type doesn't include spent, startDate, or endDate properties

      // Update goal progress if applicable
      if (transaction.goalId) {
        setDecimalGoals((prev): DecimalGoal[] => prev.map((goal): DecimalGoal => {
          if (goal.id === transaction.goalId) {
            return {
              ...goal,
              currentAmount: goal.currentAmount.plus(newTransaction.amount)
            };
          }
          return goal;
        }));
      }

      // Learn from this categorization
      if (transaction.category) {
        smartCategorizationService.learnFromCategorization({
          ...fromDecimalTransaction(newTransaction),
          amount: newTransaction.amount.toNumber()
        }, transaction.category);
      }
    },
    updateTransaction: (id, updates): void => {
      setDecimalTransactions((prev): DecimalTransaction[] => {
        const oldTransaction = prev.find((t): boolean => t.id === id);
        if (!oldTransaction) return prev;

        const updatedTransaction = {
          ...oldTransaction,
          ...toDecimalTransaction({ ...fromDecimalTransaction(oldTransaction), ...updates })
        };

        // Update account balances
        setDecimalAccounts((accounts): DecimalAccount[] => accounts.map((acc): DecimalAccount => {
          if (acc.id === oldTransaction.accountId || acc.id === updatedTransaction.accountId) {
            // Recalculate balance
            const allTransactions = prev
              .filter((t): boolean => t.id !== id)
              .concat(updatedTransaction)
              .filter((t): boolean => t.accountId === acc.id);
            
            const balance = allTransactions.reduce((sum, t): DecimalInstance => {
              return t.type === 'income' ? sum.plus(t.amount) : sum.minus(t.amount);
            }, acc.initialBalance || toDecimal(0));

            return { ...acc, balance, lastUpdated: new Date() };
          }
          return acc;
        }));

        return prev.map((t): DecimalTransaction => t.id === id ? updatedTransaction : t);
      });
    },
    deleteTransaction: (id): void => {
      const transaction = decimalTransactions.find((t): boolean => t.id === id);
      if (!transaction) return;

      setDecimalTransactions((prev): DecimalTransaction[] => prev.filter((t): boolean => t.id !== id));
      
      // Update account balance
      setDecimalAccounts((prev): DecimalAccount[] => prev.map((acc): DecimalAccount => {
        if (acc.id === transaction.accountId) {
          const amount = transaction.amount;
          const newBalance = transaction.type === 'income' 
            ? acc.balance.minus(amount)
            : acc.balance.plus(amount);
          return { ...acc, balance: newBalance, lastUpdated: new Date() };
        }
        return acc;
      }));
    },
    addBudget: (budget): void => {
      const decimalBudget = toDecimalBudget({
        ...budget,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        spent: 0
      });
      setDecimalBudgets(prev => [...prev, decimalBudget]);
    },
    updateBudget: (id, updates): void => {
      setDecimalBudgets((prev): DecimalBudget[] => prev.map((budget): DecimalBudget => 
        budget.id === id 
          ? { ...budget, ...toDecimalBudget({ ...fromDecimalBudget(budget), ...updates }) }
          : budget
      ));
    },
    deleteBudget: (id): void => {
      setDecimalBudgets((prev): DecimalBudget[] => prev.filter((budget): boolean => budget.id !== id));
    },
    addCategory: (category): void => {
      const newCategory = {
        ...category,
        id: crypto.randomUUID()
      };
      setCategories((prev): Category[] => [...prev, newCategory]);
    },
    updateCategory: (id, updates): void => {
      setCategories((prev): Category[] => prev.map((cat): Category => 
        cat.id === id ? { ...cat, ...updates } : cat
      ));
    },
    deleteCategory: (id): void => {
      setCategories((prev): Category[] => prev.filter((cat): boolean => cat.id !== id));
    },
    addGoal: (goal): void => {
      const decimalGoal = toDecimalGoal({
        ...goal,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        currentAmount: 0
      });
      setDecimalGoals((prev): DecimalGoal[] => [...prev, decimalGoal]);
    },
    updateGoal: (id, updates): void => {
      setDecimalGoals((prev): DecimalGoal[] => prev.map((goal): DecimalGoal => 
        goal.id === id 
          ? { ...goal, ...toDecimalGoal({ ...fromDecimalGoal(goal), ...updates }) }
          : goal
      ));
    },
    deleteGoal: (id): void => {
      setDecimalGoals((prev): DecimalGoal[] => prev.filter((goal): boolean => goal.id !== id));
    },
    addTag: (tag): void => {
      const newTag: Tag = {
        ...tag,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setTags((prev): Tag[] => [...prev, newTag]);
    },
    updateTag: (id, updates): void => {
      setTags((prev): Tag[] => prev.map((tag): Tag => 
        tag.id === id 
          ? { ...tag, ...updates, updatedAt: new Date() }
          : tag
      ));
    },
    deleteTag: (id): void => {
      const tag = tags.find((t): boolean => t.id === id);
      if (tag) {
        // Remove tag from all transactions
        setDecimalTransactions((prev): DecimalTransaction[] => prev.map((transaction): DecimalTransaction => ({
          ...transaction,
          tags: transaction.tags?.filter((t): boolean => t !== tag.name)
        })));
      }
      setTags((prev): Tag[] => prev.filter((t): boolean => t.id !== id));
    },
    getTagUsageCount,
    getSubCategories,
    getDetailCategories,
    getCategoryById,
    getCategoryPath,
    recurringTransactions,
    addRecurringTransaction: (transaction): void => {
      const nextDate = new Date(transaction.startDate);
      const decimalRecurring = toDecimalRecurringTransaction({
        ...transaction,
        id: crypto.randomUUID(),
        nextDate
      });
      setDecimalRecurringTransactions((prev): DecimalRecurringTransaction[] => [...prev, decimalRecurring]);
    },
    updateRecurringTransaction: (id, updates): void => {
      setDecimalRecurringTransactions((prev): DecimalRecurringTransaction[] => prev.map((rt): DecimalRecurringTransaction => 
        rt.id === id 
          ? { ...rt, ...toDecimalRecurringTransaction({ ...fromDecimalRecurringTransaction(rt), ...updates }) }
          : rt
      ));
    },
    deleteRecurringTransaction: (id): void => {
      setDecimalRecurringTransactions((prev): DecimalRecurringTransaction[] => prev.filter((rt): boolean => rt.id !== id));
    },
    processRecurringTransactions: (): void => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setDecimalRecurringTransactions((prev): DecimalRecurringTransaction[] => prev.map((rt): DecimalRecurringTransaction => {
        if (!rt.isActive || rt.nextDate > today) return rt;

        // Create transactions for all due dates
        const currentDate = new Date(rt.nextDate);
        const transactions: DecimalTransaction[] = [];

        while (currentDate <= today) {
          transactions.push(toDecimalTransaction({
            id: crypto.randomUUID(),
            date: new Date(currentDate),
            description: rt.description,
            amount: rt.amount.toNumber(),
            type: rt.type,
            category: rt.category,
            accountId: rt.accountId,
            tags: rt.tags,
            notes: rt.notes ? `${rt.notes} (Recurring)` : 'Recurring transaction',
            isRecurring: true,
            recurringTransactionId: rt.id
          }));

          // Calculate next date
          switch (rt.frequency) {
            case 'daily':
              currentDate.setDate(currentDate.getDate() + rt.interval);
              break;
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + (rt.interval * 7));
              break;
            case 'monthly':
              currentDate.setMonth(currentDate.getMonth() + rt.interval);
              break;
            case 'yearly':
              currentDate.setFullYear(currentDate.getFullYear() + rt.interval);
              break;
          }
        }

        // Add all generated transactions
        if (transactions.length > 0) {
          setDecimalTransactions((txns): DecimalTransaction[] => [...txns, ...transactions]);
          
          // Update account balances
          setDecimalAccounts((accounts): DecimalAccount[] => accounts.map((acc): DecimalAccount => {
            if (acc.id === rt.accountId) {
              const totalAmount = transactions.reduce((sum, t): DecimalInstance => 
                t.type === 'income' ? sum.plus(t.amount) : sum.minus(t.amount),
                toDecimal(0)
              );
              return {
                ...acc,
                balance: rt.type === 'income' 
                  ? acc.balance.plus(totalAmount)
                  : acc.balance.minus(totalAmount),
                lastUpdated: new Date()
              };
            }
            return acc;
          }));
        }

        // Update the recurring transaction with new next date
        return {
          ...rt,
          nextDate: currentDate,
          lastProcessed: today
        };
      }));
    },
    // Decimal getters for precision calculations
    getDecimalTransactions: (): DecimalTransaction[] => decimalTransactions,
    getDecimalAccounts: (): DecimalAccount[] => decimalAccounts,
    getDecimalBudgets: (): DecimalBudget[] => decimalBudgets,
    getDecimalGoals: (): DecimalGoal[] => decimalGoals,
    // Additional methods
    getAllUsedTags: (): string[] => {
      const tagSet = new Set<string>();
      transactions.forEach(t => {
        if (t.tags) {
          t.tags.forEach(tag => tagSet.add(tag));
        }
      });
      return Array.from(tagSet);
    }
  }), [
    accounts,
    transactions,
    budgets,
    categories,
    goals,
    tags,
    hasTestData,
    isLoading,
    decimalAccounts,
    decimalTransactions,
    decimalBudgets,
    decimalGoals,
    getTagUsageCount,
    getSubCategories,
    getDetailCategories,
    getCategoryById,
    getCategoryPath,
    recurringTransactions
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
