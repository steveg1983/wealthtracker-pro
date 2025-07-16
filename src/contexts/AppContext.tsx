// Restore working AppContext with test data
import { createContext, useContext, type ReactNode, useState, useEffect } from 'react';
import { 
  getDefaultTestAccounts, 
  getDefaultTestTransactions, 
  getDefaultTestBudgets, 
  getDefaultTestGoals 
} from '../data/defaultTestData';
import { getDefaultCategories, getMinimalSystemCategories } from '../data/defaultCategories';

interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AppContextType {
  accounts: any[];
  transactions: any[];
  budgets: any[];
  categories: any[];
  goals: any[];
  tags: Tag[];
  hasTestData: boolean;
  clearAllData: () => void;
  exportData: () => string;
  loadTestData: () => void;
  // Add required methods
  addAccount: (account: any) => void;
  updateAccount: (id: string, updates: any) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (transaction: any) => void;
  updateTransaction: (id: string, updates: any) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (budget: any) => void;
  updateBudget: (id: string, updates: any) => void;
  deleteBudget: (id: string) => void;
  addCategory: (category: any) => void;
  updateCategory: (id: string, updates: any) => void;
  deleteCategory: (id: string) => void;
  addGoal: (goal: any) => void;
  updateGoal: (id: string, updates: any) => void;
  deleteGoal: (id: string) => void;
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  getTagUsageCount: (tagName: string) => number;
  getAllUsedTags: () => string[];
  recurringTransactions: any[];
  addRecurringTransaction: (transaction: any) => void;
  updateRecurringTransaction: (id: string, updates: any) => void;
  deleteRecurringTransaction: (id: string) => void;
  importTransactions: (transactions: any[]) => void;
  getSubCategories: (parentId: string) => any[];
  getDetailCategories: (parentId: string) => any[];
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
  
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>(() => {
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
    return accounts.length > 0 && accounts.some((acc: any) => 
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
      
      // Also clear any other app-related keys
      localStorage.removeItem('testDataWarningDismissed');
      localStorage.removeItem('onboardingCompleted');
      
      // Set a flag to prevent loading test data on refresh
      localStorage.setItem('wealthtracker_data_cleared', 'true');
      
      // Clear any money_management keys from old versions
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
    addAccount: (account: any) => setAccounts((prev: any[]) => [...prev, { ...account, id: Date.now().toString() }]),
    updateAccount: (id: string, updates: any) => setAccounts((prev: any[]) => prev.map((a: any) => a.id === id ? { ...a, ...updates } : a)),
    deleteAccount: (id: string) => setAccounts((prev: any[]) => prev.filter((a: any) => a.id !== id)),
    addTransaction: (transaction: any) => setTransactions((prev: any[]) => [...prev, { ...transaction, id: Date.now().toString() }]),
    updateTransaction: (id: string, updates: any) => setTransactions((prev: any[]) => prev.map((t: any) => t.id === id ? { ...t, ...updates } : t)),
    deleteTransaction: (id: string) => setTransactions((prev: any[]) => prev.filter((t: any) => t.id !== id)),
    addBudget: (budget: any) => setBudgets((prev: any[]) => [...prev, { ...budget, id: Date.now().toString() }]),
    updateBudget: (id: string, updates: any) => setBudgets((prev: any[]) => prev.map((b: any) => b.id === id ? { ...b, ...updates } : b)),
    deleteBudget: (id: string) => setBudgets((prev: any[]) => prev.filter((b: any) => b.id !== id)),
    addCategory: (category: any) => setCategories((prev: any[]) => [...prev, { ...category, id: Date.now().toString() }]),
    updateCategory: (id: string, updates: any) => setCategories((prev: any[]) => prev.map((c: any) => c.id === id ? { ...c, ...updates } : c)),
    deleteCategory: (id: string) => setCategories((prev: any[]) => prev.filter((c: any) => c.id !== id)),
    addGoal: (goal: any) => setGoals((prev: any[]) => [...prev, { ...goal, id: Date.now().toString() }]),
    updateGoal: (id: string, updates: any) => setGoals((prev: any[]) => prev.map((g: any) => g.id === id ? { ...g, ...updates } : g)),
    deleteGoal: (id: string) => setGoals((prev: any[]) => prev.filter((g: any) => g.id !== id)),
    addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newTag: Tag = {
        ...tag,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setTags((prev: Tag[]) => [...prev, newTag]);
    },
    updateTag: (id: string, updates: Partial<Tag>) => {
      setTags((prev: Tag[]) => prev.map((t: Tag) => 
        t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
      ));
    },
    deleteTag: (id: string) => setTags((prev: Tag[]) => prev.filter((t: Tag) => t.id !== id)),
    getTagUsageCount: (tagName: string) => {
      return transactions.filter((t: any) => t.tags?.includes(tagName)).length;
    },
    getAllUsedTags: () => {
      const allTags = new Set<string>();
      transactions.forEach((t: any) => {
        if (t.tags) {
          t.tags.forEach((tag: string) => allTags.add(tag));
        }
      });
      return Array.from(allTags);
    },
    recurringTransactions,
    addRecurringTransaction: (transaction: any) => setRecurringTransactions((prev: any[]) => [...prev, { ...transaction, id: Date.now().toString() }]),
    updateRecurringTransaction: (id: string, updates: any) => setRecurringTransactions((prev: any[]) => prev.map((t: any) => t.id === id ? { ...t, ...updates } : t)),
    deleteRecurringTransaction: (id: string) => setRecurringTransactions((prev: any[]) => prev.filter((t: any) => t.id !== id)),
    importTransactions: (newTransactions: any[]) => setTransactions((prev: any[]) => [...prev, ...newTransactions]),
    getSubCategories: (parentId: string) => categories.filter((c: any) => c.parentId === parentId && c.level === 'sub'),
    getDetailCategories: (parentId: string) => categories.filter((c: any) => c.parentId === parentId && c.level === 'detail'),
    createTransferTransaction: (from, to, amount, date) => {
      // Create transfer transactions
      setTransactions((prev: any[]) => [...prev,
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