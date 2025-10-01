/* eslint-disable react-refresh/only-export-components */
// Restore working AppContext with test data
import { createContext, useContext, type ReactNode, useState, useEffect } from 'react';
import { 
  getDefaultTestAccounts, 
  getDefaultTestTransactions, 
  getDefaultTestBudgets, 
  getDefaultTestGoals 
} from '../data/defaultTestData';
import { getDefaultCategories, getMinimalSystemCategories } from '../data/defaultCategories';
import type { Account, Transaction, Budget, Goal } from '../types';

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
}

interface AppContextType {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  goals: Goal[];
  tags: Tag[];
  hasTestData: boolean;
  clearAllData: () => void;
  exportData: () => string;
  loadTestData: () => void;
  // Add required methods
  addAccount: (account: Omit<Account, 'id' | 'lastUpdated'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  getTagUsageCount: (tagName: string) => number;
  getAllUsedTags: () => string[];
  recurringTransactions: RecurringTransaction[];
  addRecurringTransaction: (transaction: Omit<RecurringTransaction, 'id'>) => void;
  updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => void;
  deleteRecurringTransaction: (id: string) => void;
  importTransactions: (transactions: Omit<Transaction, 'id'>[]) => void;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
  createTransferTransaction: (from: string, to: string, amount: number, date: Date) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // Initialize with empty data or load from localStorage if exists
  const [accounts, setAccounts] = useState(() => {
    // Check for existing localStorage data first
    const saved = localStorage.getItem('wealthtracker_accounts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved accounts:', e);
      }
    }
    // Check if data was explicitly cleared
    if (localStorage.getItem('wealthtracker_data_cleared') === 'true') {
      return [];
    }
    // Otherwise load test data
    return getDefaultTestAccounts();
  });
  
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('wealthtracker_transactions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved transactions:', e);
      }
    }
    if (localStorage.getItem('wealthtracker_data_cleared') === 'true') {
      return [];
    }
    return getDefaultTestTransactions();
  });
  
  const [budgets, setBudgets] = useState(() => {
    const saved = localStorage.getItem('wealthtracker_budgets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved budgets:', e);
      }
    }
    if (localStorage.getItem('wealthtracker_data_cleared') === 'true') {
      return [];
    }
    return getDefaultTestBudgets();
  });
  
  const [goals, setGoals] = useState(() => {
    const saved = localStorage.getItem('wealthtracker_goals');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved goals:', e);
      }
    }
    if (localStorage.getItem('wealthtracker_data_cleared') === 'true') {
      return [];
    }
    return getDefaultTestGoals();
  });
  
  const [categories, setCategories] = useState(() => getDefaultCategories());
  
  const [tags, setTags] = useState<Tag[]>(() => {
    const saved = localStorage.getItem('wealthtracker_tags');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved tags:', e);
      }
    }
    return [];
  });
  
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>(() => {
    const saved = localStorage.getItem('wealthtracker_recurring');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved recurring transactions:', e);
      }
    }
    return [];
  });
  
  // Determine if we have test data based on actual data presence
  const [hasTestData, setHasTestData] = useState(() => {
    // Check if we have the default test data loaded
    return accounts.length > 0 && accounts.some((acc: Account) => 
      acc.name === 'Main Checking' || acc.name === 'Savings Account'
    );
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
  }, [accounts]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_transactions', JSON.stringify(transactions));
  }, [transactions]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_budgets', JSON.stringify(budgets));
  }, [budgets]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_goals', JSON.stringify(goals));
  }, [goals]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_tags', JSON.stringify(tags));
  }, [tags]);
  
  useEffect(() => {
    localStorage.setItem('wealthtracker_recurring', JSON.stringify(recurringTransactions));
  }, [recurringTransactions]);

  const value: AppContextType = {
    accounts,
    transactions,
    budgets,
    categories,
    goals,
    tags,
    hasTestData,
    clearAllData: () => {
      // Clear all state
      setAccounts([]);
      setTransactions([]);
      setBudgets([]);
      setGoals([]);
      setTags([]);
      setRecurringTransactions([]);
      setCategories(getMinimalSystemCategories()); // Keep only minimal system categories
      setHasTestData(false);
      
      // Clear all localStorage keys
      localStorage.removeItem('wealthtracker_accounts');
      localStorage.removeItem('wealthtracker_transactions');
      localStorage.removeItem('wealthtracker_budgets');
      localStorage.removeItem('wealthtracker_goals');
      localStorage.removeItem('wealthtracker_tags');
      localStorage.removeItem('wealthtracker_recurring');
      
      // Also clear other app-related keys
      localStorage.removeItem('testDataWarningDismissed');
      localStorage.removeItem('onboardingCompleted');
      
      // Set a flag to prevent loading test data on refresh
      localStorage.setItem('wealthtracker_data_cleared', 'true');
      
      // Clear money_management keys from old versions
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('money_management_') || key.startsWith('wealthtracker_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    },
    exportData: () => {
      const data = {
        accounts,
        transactions,
        budgets,
        goals,
        recurringTransactions,
        categories,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      return JSON.stringify(data, null, 2);
    },
    loadTestData: () => {
      const testAccounts = getDefaultTestAccounts();
      const testTransactions = getDefaultTestTransactions();
      const testBudgets = getDefaultTestBudgets();
      const testGoals = getDefaultTestGoals();
      
      setAccounts(testAccounts);
      setTransactions(testTransactions);
      setBudgets(testBudgets);
      setGoals(testGoals);
      setHasTestData(true);
      
      // Remove the cleared flag since we're loading data
      localStorage.removeItem('wealthtracker_data_cleared');
    },
    addAccount: (account) => setAccounts((prev: Account[]) => [...prev, { ...account, id: Date.now().toString(), lastUpdated: new Date() }]),
    updateAccount: (id, updates) => setAccounts((prev: Account[]) => prev.map((a: Account) => a.id === id ? { ...a, ...updates, lastUpdated: new Date() } : a)),
    deleteAccount: (id) => setAccounts((prev: Account[]) => prev.filter((a: Account) => a.id !== id)),
    addTransaction: (transaction) => setTransactions((prev: Transaction[]) => [...prev, { ...transaction, id: Date.now().toString() }]),
    updateTransaction: (id, updates) => setTransactions((prev: Transaction[]) => prev.map((t: Transaction) => t.id === id ? { ...t, ...updates } : t)),
    deleteTransaction: (id) => setTransactions((prev: Transaction[]) => prev.filter((t: Transaction) => t.id !== id)),
    addBudget: (budget) => setBudgets((prev: Budget[]) => [...prev, { ...budget, id: Date.now().toString(), createdAt: new Date() }]),
    updateBudget: (id, updates) => setBudgets((prev: Budget[]) => prev.map((b: Budget) => b.id === id ? { ...b, ...updates } : b)),
    deleteBudget: (id) => setBudgets((prev: Budget[]) => prev.filter((b: Budget) => b.id !== id)),
    addCategory: (category) => setCategories(prev => [...prev, { ...category, id: Date.now().toString() }]),
    updateCategory: (id, updates) => setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)),
    deleteCategory: (id) => setCategories(prev => prev.filter(c => c.id !== id)),
    addGoal: (goal) => setGoals((prev: Goal[]) => [...prev, { ...goal, id: Date.now().toString(), createdAt: new Date() }]),
    updateGoal: (id, updates) => setGoals((prev: Goal[]) => prev.map((g: Goal) => g.id === id ? { ...g, ...updates } : g)),
    deleteGoal: (id) => setGoals((prev: Goal[]) => prev.filter((g: Goal) => g.id !== id)),
    addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newTag: Tag = {
        ...tag,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setTags((prev: Tag[]) => [...prev, newTag]);
    },
    updateTag: (id, updates) => {
      setTags(prev => prev.map(t => 
        t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
      ));
    },
    deleteTag: (id) => setTags(prev => prev.filter(t => t.id !== id)),
    getTagUsageCount: (tagName) => {
      return transactions.filter((t: Transaction) => t.tags?.includes(tagName)).length;
    },
    getAllUsedTags: () => {
      const allTags = new Set<string>();
      transactions.forEach((t: Transaction) => {
        if (t.tags) {
          t.tags.forEach((tag: string) => allTags.add(tag));
        }
      });
      return Array.from(allTags);
    },
    recurringTransactions,
    addRecurringTransaction: (transaction) => setRecurringTransactions(prev => [...prev, { ...transaction, id: Date.now().toString() }]),
    updateRecurringTransaction: (id, updates) => setRecurringTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t)),
    deleteRecurringTransaction: (id) => setRecurringTransactions(prev => prev.filter(t => t.id !== id)),
    importTransactions: (newTransactions) => setTransactions((prev: Transaction[]) => [...prev, ...newTransactions.map(t => ({ ...t, id: Date.now().toString() + Math.random() }))]),
    getSubCategories: (parentId) => categories.filter(c => c.parentId === parentId && c.level === 'sub'),
    getDetailCategories: (parentId) => categories.filter(c => c.parentId === parentId && c.level === 'detail'),
    createTransferTransaction: (from, to, amount, date) => {
      // Create transfer transactions
      setTransactions((prev: Transaction[]) => [...prev,
        { id: Date.now().toString(), date, description: 'Transfer Out', amount, type: 'expense', category: 'transfer-out', accountId: from, cleared: false },
        { id: (Date.now() + 1).toString(), date, description: 'Transfer In', amount, type: 'income', category: 'transfer-in', accountId: to, cleared: false }
      ]);
    }
  };

  return (
    <AppContext.Provider value={value}>
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