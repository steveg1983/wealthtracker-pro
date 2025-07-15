// Restore working AppContext with test data
import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { 
  getDefaultTestAccounts, 
  getDefaultTestTransactions, 
  getDefaultTestBudgets, 
  getDefaultTestGoals 
} from '../data/defaultTestData';
import { getDefaultCategories } from '../data/defaultCategories';

interface AppContextType {
  accounts: any[];
  transactions: any[];
  budgets: any[];
  categories: any[];
  goals: any[];
  hasTestData: boolean;
  clearAllData: () => void;
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
  // Load test data
  const [accounts, setAccounts] = useState(() => getDefaultTestAccounts());
  const [transactions, setTransactions] = useState(() => getDefaultTestTransactions());
  const [budgets, setBudgets] = useState(() => getDefaultTestBudgets());
  const [goals, setGoals] = useState(() => getDefaultTestGoals());
  const [categories] = useState(() => getDefaultCategories());
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>([]);

  const value: AppContextType = {
    accounts,
    transactions,
    budgets,
    categories,
    goals,
    hasTestData: true,
    clearAllData: () => {
      setAccounts([]);
      setTransactions([]);
      setBudgets([]);
      setGoals([]);
      setRecurringTransactions([]);
    },
    addAccount: (account) => setAccounts(prev => [...prev, { ...account, id: Date.now().toString() }]),
    updateAccount: (id, updates) => setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a)),
    deleteAccount: (id) => setAccounts(prev => prev.filter(a => a.id !== id)),
    addTransaction: (transaction) => setTransactions(prev => [...prev, { ...transaction, id: Date.now().toString() }]),
    updateTransaction: (id, updates) => setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t)),
    deleteTransaction: (id) => setTransactions(prev => prev.filter(t => t.id !== id)),
    addBudget: (budget) => setBudgets(prev => [...prev, { ...budget, id: Date.now().toString() }]),
    updateBudget: (id, updates) => setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b)),
    deleteBudget: (id) => setBudgets(prev => prev.filter(b => b.id !== id)),
    addCategory: (category) => console.log('Add category:', category),
    updateCategory: (id, updates) => console.log('Update category:', id, updates),
    deleteCategory: (id) => console.log('Delete category:', id),
    addGoal: (goal) => setGoals(prev => [...prev, { ...goal, id: Date.now().toString() }]),
    updateGoal: (id, updates) => setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g)),
    deleteGoal: (id) => setGoals(prev => prev.filter(g => g.id !== id)),
    recurringTransactions,
    addRecurringTransaction: (transaction) => setRecurringTransactions(prev => [...prev, { ...transaction, id: Date.now().toString() }]),
    updateRecurringTransaction: (id, updates) => setRecurringTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t)),
    deleteRecurringTransaction: (id) => setRecurringTransactions(prev => prev.filter(t => t.id !== id)),
    importTransactions: (newTransactions) => setTransactions(prev => [...prev, ...newTransactions]),
    getSubCategories: (parentId) => categories.filter(c => c.parentId === parentId && c.level === 'sub'),
    getDetailCategories: (parentId) => categories.filter(c => c.parentId === parentId && c.level === 'detail'),
    createTransferTransaction: (from, to, amount, date) => {
      // Create transfer transactions
      setTransactions(prev => [...prev,
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