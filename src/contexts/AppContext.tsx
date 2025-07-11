import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { generateTestData } from '../utils/generateTestData';

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment';
  balance: number;
  currency: string;
  institution: string;
  lastUpdated: Date;
}

interface Transaction {
  id: string;
  accountId: string;
  date: Date;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  isActive: boolean;
  createdAt: Date;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date;
  createdAt: Date;
}

interface AppContextType {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // Initialize with test data if first time user
  const initializeData = () => {
    const savedAccounts = localStorage.getItem('wealthtracker_accounts');
    const savedTransactions = localStorage.getItem('wealthtracker_transactions');
    const savedBudgets = localStorage.getItem('wealthtracker_budgets');
    
    // If no data exists, load test data
    if (!savedAccounts && !savedTransactions && !savedBudgets) {
      const testData = generateTestData();
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(testData.accounts));
      localStorage.setItem('wealthtracker_transactions', JSON.stringify(testData.transactions));
      localStorage.setItem('wealthtracker_budgets', JSON.stringify(testData.budgets));
      localStorage.setItem('wealthtracker_first_time', 'false');
      return {
        accounts: testData.accounts,
        transactions: testData.transactions,
        budgets: testData.budgets
      };
    }
    
    return {
      accounts: savedAccounts ? JSON.parse(savedAccounts) : [],
      transactions: savedTransactions ? JSON.parse(savedTransactions) : [],
      budgets: savedBudgets ? JSON.parse(savedBudgets) : []
    };
  };

  const initialData = initializeData();

  const [accounts, setAccounts] = useState<Account[]>(initialData.accounts);
  const [transactions, setTransactions] = useState<Transaction[]>(initialData.transactions);
  const [budgets, setBudgets] = useState<Budget[]>(initialData.budgets);
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('wealthtracker_goals');
    return saved ? JSON.parse(saved) : [];
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

  // Account functions
  const addAccount = (account: Omit<Account, 'id'>) => {
    const newAccount = {
      ...account,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setAccounts([...accounts, newAccount]);
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    setAccounts(accounts.map(acc => 
      acc.id === id ? { ...acc, ...updates } : acc
    ));
  };

  const deleteAccount = (id: string) => {
    setAccounts(accounts.filter(acc => acc.id !== id));
    // Also delete related transactions
    setTransactions(transactions.filter(t => t.accountId !== id));
  };

  // Transaction functions
  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = {
      ...transaction,
      id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setTransactions([...transactions, newTransaction]);

    // Update account balance
    const account = accounts.find(acc => acc.id === transaction.accountId);
    if (account) {
      const balanceChange = transaction.type === 'income' ? transaction.amount : -transaction.amount;
      updateAccount(account.id, { 
        balance: account.balance + balanceChange,
        lastUpdated: new Date()
      });
    }
  };

  const deleteTransaction = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      // Reverse the balance change
      const account = accounts.find(acc => acc.id === transaction.accountId);
      if (account) {
        const balanceChange = transaction.type === 'income' ? -transaction.amount : transaction.amount;
        updateAccount(account.id, { 
          balance: account.balance + balanceChange,
          lastUpdated: new Date()
        });
      }
    }
    setTransactions(transactions.filter(t => t.id !== id));
  };

  // Budget functions
  const addBudget = (budget: Omit<Budget, 'id'>) => {
    const newBudget = {
      ...budget,
      id: `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setBudgets([...budgets, newBudget]);
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    setBudgets(budgets.map(budget => 
      budget.id === id ? { ...budget, ...updates } : budget
    ));
  };

  const deleteBudget = (id: string) => {
    setBudgets(budgets.filter(budget => budget.id !== id));
  };

  // Goal functions
  const addGoal = (goal: Omit<Goal, 'id'>) => {
    const newGoal = {
      ...goal,
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setGoals([...goals, newGoal]);
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals(goals.map(goal => 
      goal.id === id ? { ...goal, ...updates } : goal
    ));
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter(goal => goal.id !== id));
  };

  return (
    <AppContext.Provider value={{
      accounts,
      transactions,
      budgets,
      goals,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      deleteTransaction,
      addBudget,
      updateBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      deleteGoal,
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
