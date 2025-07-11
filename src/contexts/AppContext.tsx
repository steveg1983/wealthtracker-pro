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
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Initialize data on mount
  useEffect(() => {
    const initializeData = () => {
      try {
        console.log('Initializing app data...');
        
        // Check if we have any saved data
        const hasAccounts = localStorage.getItem('wealthtracker_accounts');
        const hasTransactions = localStorage.getItem('wealthtracker_transactions');
        const hasBudgets = localStorage.getItem('wealthtracker_budgets');
        
        console.log('Checking for existing data:', { hasAccounts: !!hasAccounts, hasTransactions: !!hasTransactions, hasBudgets: !!hasBudgets });
        
        // If no data exists at all, generate test data
        if (!hasAccounts && !hasTransactions && !hasBudgets) {
          console.log('No existing data found, generating test data...');
          const testData = generateTestData();
          
          // Save to localStorage
          localStorage.setItem('wealthtracker_accounts', JSON.stringify(testData.accounts));
          localStorage.setItem('wealthtracker_transactions', JSON.stringify(testData.transactions));
          localStorage.setItem('wealthtracker_budgets', JSON.stringify(testData.budgets));
          
          // Set state
          setAccounts(testData.accounts);
          setTransactions(testData.transactions);
          setBudgets(testData.budgets);
          
          console.log('Test data generated:', {
            accounts: testData.accounts.length,
            transactions: testData.transactions.length,
            budgets: testData.budgets.length
          });
        } else {
          // Load existing data
          console.log('Loading existing data...');
          
          if (hasAccounts) {
            const parsedAccounts = JSON.parse(hasAccounts);
            setAccounts(parsedAccounts);
            console.log('Loaded accounts:', parsedAccounts.length);
          }
          
          if (hasTransactions) {
            const parsedTransactions = JSON.parse(hasTransactions);
            setTransactions(parsedTransactions);
            console.log('Loaded transactions:', parsedTransactions.length);
          }
          
          if (hasBudgets) {
            const parsedBudgets = JSON.parse(hasBudgets);
            setBudgets(parsedBudgets);
            console.log('Loaded budgets:', parsedBudgets.length);
          }
        }
        
        // Load goals (always check separately as they might not exist)
        const savedGoals = localStorage.getItem('wealthtracker_goals');
        if (savedGoals) {
          setGoals(JSON.parse(savedGoals));
        }
        
      } catch (error) {
        console.error('Error initializing data:', error);
        
        // If there's any error, generate fresh test data
        console.log('Error occurred, generating fresh test data...');
        const testData = generateTestData();
        
        setAccounts(testData.accounts);
        setTransactions(testData.transactions);
        setBudgets(testData.budgets);
        
        // Try to save to localStorage (might fail on some browsers)
        try {
          localStorage.setItem('wealthtracker_accounts', JSON.stringify(testData.accounts));
          localStorage.setItem('wealthtracker_transactions', JSON.stringify(testData.transactions));
          localStorage.setItem('wealthtracker_budgets', JSON.stringify(testData.budgets));
        } catch (saveError) {
          console.error('Could not save to localStorage:', saveError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(initializeData, 100);
  }, []);

  // Save to localStorage whenever data changes (skip during loading)
  useEffect(() => {
    if (!isLoading && accounts.length > 0) {
      try {
        localStorage.setItem('wealthtracker_accounts', JSON.stringify(accounts));
      } catch (error) {
        console.error('Error saving accounts:', error);
      }
    }
  }, [accounts, isLoading]);

  useEffect(() => {
    if (!isLoading && transactions.length > 0) {
      try {
        localStorage.setItem('wealthtracker_transactions', JSON.stringify(transactions));
      } catch (error) {
        console.error('Error saving transactions:', error);
      }
    }
  }, [transactions, isLoading]);

  useEffect(() => {
    if (!isLoading && budgets.length > 0) {
      try {
        localStorage.setItem('wealthtracker_budgets', JSON.stringify(budgets));
      } catch (error) {
        console.error('Error saving budgets:', error);
      }
    }
  }, [budgets, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem('wealthtracker_goals', JSON.stringify(goals));
      } catch (error) {
        console.error('Error saving goals:', error);
      }
    }
  }, [goals, isLoading]);

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
      isLoading,
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
