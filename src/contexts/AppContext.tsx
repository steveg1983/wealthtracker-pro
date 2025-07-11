import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { generateTestData } from '../utils/generateTestData';
import type { Account, Transaction, Budget } from '../types';

interface AppContextType {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  isLoading: boolean;
  clearAllData: () => void;
  exportData: () => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  accounts: 'wealthtracker_accounts',
  transactions: 'wealthtracker_transactions',
  budgets: 'wealthtracker_budgets',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadData = () => {
      try {
        const storedAccounts = localStorage.getItem(STORAGE_KEYS.accounts);
        const storedTransactions = localStorage.getItem(STORAGE_KEYS.transactions);
        const storedBudgets = localStorage.getItem(STORAGE_KEYS.budgets);

        if (!storedAccounts && !storedTransactions && !storedBudgets) {
          // Initialize with test data if no data exists
          const testData = generateTestData();
          setAccounts(testData.accounts);
          setTransactions(testData.transactions);
          setBudgets(testData.budgets);
          
          // Save test data to localStorage
          localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(testData.accounts));
          localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(testData.transactions));
          localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(testData.budgets));
        } else {
          // Load existing data
          if (storedAccounts) setAccounts(JSON.parse(storedAccounts));
          if (storedTransactions) setTransactions(JSON.parse(storedTransactions));
          if (storedBudgets) setBudgets(JSON.parse(storedBudgets));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
    }
  }, [accounts, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
    }
  }, [transactions, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(budgets));
    }
  }, [budgets, isLoading]);

  // Account methods
  const addAccount = (account: Omit<Account, 'id'>) => {
    const newAccount: Account = {
      ...account,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setAccounts(prev => [...prev, newAccount]);
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    setAccounts(prev => prev.map(acc => 
      acc.id === id ? { ...acc, ...updates } : acc
    ));
  };

  const deleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(acc => acc.id !== id));
    // Also delete associated transactions
    setTransactions(prev => prev.filter(trans => trans.accountId !== id));
  };

  // Transaction methods
  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setTransactions(prev => [...prev, newTransaction]);
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(trans => 
      trans.id === id ? { ...trans, ...updates } : trans
    ));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(trans => trans.id !== id));
  };

  // Budget methods
  const addBudget = (budget: Omit<Budget, 'id'>) => {
    const newBudget: Budget = {
      ...budget,
      id: `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setBudgets(prev => [...prev, newBudget]);
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setBudgets(prev => prev.map(budget => 
      budget.id === id ? { ...budget, ...updates } : budget
    ));
  };

  const deleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(budget => budget.id !== id));
  };

  // Clear all data
  const clearAllData = () => {
    setAccounts([]);
    setTransactions([]);
    setBudgets([]);
    localStorage.removeItem(STORAGE_KEYS.accounts);
    localStorage.removeItem(STORAGE_KEYS.transactions);
    localStorage.removeItem(STORAGE_KEYS.budgets);
  };

  // Export data
  const exportData = () => {
    const data = {
      accounts,
      transactions,
      budgets,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    return JSON.stringify(data, null, 2);
  };

  return (
    <AppContext.Provider value={{
      accounts,
      transactions,
      budgets,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addBudget,
      updateBudget,
      deleteBudget,
      isLoading,
      clearAllData,
      exportData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
