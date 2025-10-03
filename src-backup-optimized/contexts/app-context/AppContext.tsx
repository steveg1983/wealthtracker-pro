/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, memo, type ReactNode } from 'react';
import { 
  getDefaultTestAccounts, 
  getDefaultTestTransactions, 
  getDefaultTestBudgets, 
  getDefaultTestGoals 
} from '../../data/defaultTestData';
import { getDefaultCategories, getMinimalSystemCategories } from '../../data/defaultCategories';
import type { Account, Transaction, Budget, Goal } from '../../types';
import type { DecimalAccount, DecimalTransaction, DecimalBudget, DecimalGoal } from '../../types/decimal-types';
import type { DecimalInstance } from '../../utils/decimal';
import { 
  toDecimalAccount, toDecimalTransaction, toDecimalBudget, toDecimalGoal,
  fromDecimalAccount, fromDecimalTransaction, fromDecimalBudget, fromDecimalGoal
} from '../../utils/decimal-converters';
import { toDecimal } from '../../utils/decimal';
import { recalculateAccountBalances } from '../../utils/recalculateBalances';
import { storageAdapter, STORAGE_KEYS } from '../../services/storageAdapter';
import { useLogger } from '../services/ServiceProvider';

// Import types
import type { AppContextType, Category, Tag, RecurringTransaction } from './types';

// Import management hooks
import { useAccountManagement } from './useAccountManagement';
import { useTransactionManagement } from './useTransactionManagement';
import { useCategoryManagement } from './useCategoryManagement';
import { useTagManagement } from './useTagManagement';
import { useDataPersistence } from './useDataPersistence';

// Internal Decimal version of RecurringTransaction
interface DecimalRecurringTransaction extends Omit<RecurringTransaction, 'amount'> {
  amount: DecimalInstance;
}

function toDecimalRecurringTransaction(recurring: RecurringTransaction): DecimalRecurringTransaction {
  const logger = useLogger();
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

const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Main App Provider component
 * Orchestrates all state management using specialized hooks
 */
export const AppProvider = memo(function AppProvider({ children }: { children: ReactNode }) {
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
  useEffect(() => {
    const initStorage = async () => {
      try {
        await storageAdapter.init();
        setIsStorageReady(true);
      } catch (error) {
        logger.error('Failed to initialize storage:', error);
        setIsStorageReady(true); // Continue with localStorage fallback
      }
    };
    initStorage();
  }, []);

  // Load initial data
  useEffect(() => {
    if (!isStorageReady) return;

    const loadData = async () => {
      try {
        setIsLoading(true);

        const dataCleared = await storageAdapter.get<boolean>('wealthtracker_data_cleared');
        
        // Load transactions
        const savedTransactions = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
        if (savedTransactions) {
          setDecimalTransactions(savedTransactions.map(toDecimalTransaction));
        } else if (!dataCleared) {
          setDecimalTransactions(getDefaultTestTransactions().map(toDecimalTransaction));
        }

        // Load accounts
        const savedAccounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
        if (savedAccounts) {
          setDecimalAccounts(savedAccounts.map(toDecimalAccount));
        } else if (!dataCleared) {
          const testAccounts = getDefaultTestAccounts();
          const testTransactions = getDefaultTestTransactions();
          const accountsWithBalances = recalculateAccountBalances(testAccounts, testTransactions);
          setDecimalAccounts(accountsWithBalances.map(toDecimalAccount));
        }

        // Load other data...
        const savedBudgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS);
        if (savedBudgets) {
          setDecimalBudgets(savedBudgets.map(toDecimalBudget));
        } else if (!dataCleared) {
          setDecimalBudgets(getDefaultTestBudgets().map(toDecimalBudget));
        }

        const savedGoals = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS);
        if (savedGoals) {
          setDecimalGoals(savedGoals.map(toDecimalGoal));
        } else if (!dataCleared) {
          setDecimalGoals(getDefaultTestGoals().map(toDecimalGoal));
        }

        const savedCategories = await storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES);
        if (savedCategories) {
          setCategories(savedCategories);
        } else {
          setCategories(dataCleared ? getMinimalSystemCategories() : getDefaultCategories());
        }

        const savedTags = await storageAdapter.get<Tag[]>(STORAGE_KEYS.TAGS);
        if (savedTags) {
          setTags(savedTags);
        }

        const savedRecurring = await storageAdapter.get<RecurringTransaction[]>(STORAGE_KEYS.RECURRING_TRANSACTIONS);
        if (savedRecurring) {
          setDecimalRecurringTransactions(savedRecurring.map(toDecimalRecurringTransaction));
        }
      } catch (error) {
        logger.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [isStorageReady]);

  // Use management hooks
  const accountManagement = useAccountManagement(decimalAccounts, setDecimalAccounts);
  const transactionManagement = useTransactionManagement(
    decimalTransactions, 
    setDecimalTransactions,
    decimalAccounts,
    setDecimalAccounts,
    decimalBudgets,
    setDecimalBudgets
  );
  const categoryManagement = useCategoryManagement(categories, setCategories);
  const tagManagement = useTagManagement(tags, setTags, decimalTransactions, setDecimalTransactions);
  const dataPersistence = useDataPersistence(
    isStorageReady,
    decimalTransactions,
    decimalAccounts,
    decimalBudgets,
    decimalGoals,
    categories,
    tags,
    decimalRecurringTransactions
  );

  // Budget management
  const budgets = decimalBudgets.map(fromDecimalBudget);
  const addBudget = (budget: Omit<Budget, 'id' | 'createdAt' | 'spent'>) => {
    const decimalBudget = toDecimalBudget({
      ...budget,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      spent: 0
    });
    setDecimalBudgets(prev => [...prev, decimalBudget]);
  };
  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setDecimalBudgets(prev => prev.map(budget => 
      budget.id === id 
        ? { ...budget, ...toDecimalBudget({ ...fromDecimalBudget(budget), ...updates }) }
        : budget
    ));
  };
  const deleteBudget = (id: string) => {
    setDecimalBudgets(prev => prev.filter(budget => budget.id !== id));
  };

  // Goal management
  const goals = decimalGoals.map(fromDecimalGoal);
  const addGoal = (goal: Omit<Goal, 'id' | 'createdAt' | 'currentAmount'>) => {
    const decimalGoal = toDecimalGoal({
      ...goal,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      currentAmount: 0
    });
    setDecimalGoals(prev => [...prev, decimalGoal]);
  };
  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setDecimalGoals(prev => prev.map(goal => 
      goal.id === id 
        ? { ...goal, ...toDecimalGoal({ ...fromDecimalGoal(goal), ...updates }) }
        : goal
    ));
  };
  const deleteGoal = (id: string) => {
    setDecimalGoals(prev => prev.filter(goal => goal.id !== id));
  };

  // Recurring transactions
  const recurringTransactions = decimalRecurringTransactions.map(fromDecimalRecurringTransaction);
  const addRecurringTransaction = (transaction: Omit<RecurringTransaction, 'id' | 'nextDate'>) => {
    const nextDate = new Date(transaction.startDate);
    const decimalRecurring = toDecimalRecurringTransaction({
      ...transaction,
      id: crypto.randomUUID(),
      nextDate
    });
    setDecimalRecurringTransactions(prev => [...prev, decimalRecurring]);
  };
  const updateRecurringTransaction = (id: string, updates: Partial<RecurringTransaction>) => {
    setDecimalRecurringTransactions(prev => prev.map(rt => 
      rt.id === id 
        ? { ...rt, ...toDecimalRecurringTransaction({ ...fromDecimalRecurringTransaction(rt), ...updates }) }
        : rt
    ));
  };
  const deleteRecurringTransaction = (id: string) => {
    setDecimalRecurringTransactions(prev => prev.filter(rt => rt.id !== id));
  };

  const processRecurringTransactions = () => {
    // Implementation for processing recurring transactions
    logger.info('Processing recurring transactions');
  };

  const loadTestData = () => {
    setDecimalTransactions(getDefaultTestTransactions().map(toDecimalTransaction));
    const testAccounts = getDefaultTestAccounts();
    const testTransactions = getDefaultTestTransactions();
    const accountsWithBalances = recalculateAccountBalances(testAccounts, testTransactions);
    setDecimalAccounts(accountsWithBalances.map(toDecimalAccount));
    setDecimalBudgets(getDefaultTestBudgets().map(toDecimalBudget));
    setDecimalGoals(getDefaultTestGoals().map(toDecimalGoal));
    setCategories(getDefaultCategories());
  };

  const hasTestData = decimalTransactions.length > 0 || decimalAccounts.length > 0;

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AppContextType>(() => ({
    // Data from hooks
    ...accountManagement,
    ...transactionManagement,
    ...categoryManagement,
    ...tagManagement,
    ...dataPersistence,
    
    // Budget operations
    budgets,
    addBudget,
    updateBudget,
    deleteBudget,
    
    // Goal operations
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    
    // Recurring transactions
    recurringTransactions,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    processRecurringTransactions,
    
    // Decimal getters
    getDecimalTransactions: () => decimalTransactions,
    getDecimalAccounts: () => decimalAccounts,
    getDecimalBudgets: () => decimalBudgets,
    getDecimalGoals: () => decimalGoals,
    
    // State flags
    hasTestData,
    isLoading,
    loadTestData
  }), [
    accountManagement,
    transactionManagement,
    categoryManagement,
    tagManagement,
    dataPersistence,
    budgets,
    goals,
    recurringTransactions,
    decimalTransactions,
    decimalAccounts,
    decimalBudgets,
    decimalGoals,
    hasTestData,
    isLoading
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
});

/**
 * Hook to use the App context
 * @throws Error if used outside of AppProvider
 */
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}