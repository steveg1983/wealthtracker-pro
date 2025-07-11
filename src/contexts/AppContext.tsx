import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment';
  balance: number;
  currency: string;
  institution?: string;
  lastUpdated: Date;
}

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  accountId: string;
  tags?: string[];
  notes?: string;
  cleared?: boolean;
  isSplit?: boolean;
  originalTransactionId?: string;
  isRecurring?: boolean;
  recurringId?: string;
  reconciledWith?: string;
  reconciledDate?: Date;
  reconciledNotes?: string;
}

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'yearly';
  spent?: number;
}

interface RecurringTransaction {
  id?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate?: string;
  lastProcessed?: string;
}

interface AppContextType {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, account: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, budget: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  clearAllData: () => void;
  exportData: () => string;
  importData: (jsonData: string) => void;
  loadTestData: () => void;
  addRecurringTransaction: (transaction: RecurringTransaction) => void;
  deleteRecurringTransaction: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('moneyTrackerData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        if (parsedData.accounts) setAccounts(parsedData.accounts);
        if (parsedData.transactions) {
          setTransactions(parsedData.transactions.map((t: any) => ({
            ...t,
            date: new Date(t.date)
          })));
        }
        if (parsedData.budgets) setBudgets(parsedData.budgets);
        if (parsedData.recurringTransactions) setRecurringTransactions(parsedData.recurringTransactions);
      } catch (error) {
        console.error('Failed to load saved data:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    const dataToSave = {
      accounts,
      transactions,
      budgets,
      recurringTransactions
    };
    localStorage.setItem('moneyTrackerData', JSON.stringify(dataToSave));
  }, [accounts, transactions, budgets, recurringTransactions]);

  // Account methods
  const addAccount = (account: Omit<Account, 'id'>) => {
    const newAccount = { ...account, id: Date.now().toString() };
    setAccounts([...accounts, newAccount]);
  };

  const updateAccount = (id: string, updatedAccount: Partial<Account>) => {
    setAccounts(accounts.map(acc => 
      acc.id === id ? { ...acc, ...updatedAccount } : acc
    ));
  };

  const deleteAccount = (id: string) => {
    setAccounts(accounts.filter(acc => acc.id !== id));
    // Also delete related transactions
    setTransactions(transactions.filter(t => t.accountId !== id));
  };

  // Transaction methods
  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...transaction, id: Date.now().toString() };
    setTransactions([...transactions, newTransaction]);
    
    // Update account balance
    const account = accounts.find(acc => acc.id === transaction.accountId);
    if (account) {
      const balanceChange = transaction.type === 'income' ? transaction.amount : -transaction.amount;
      updateAccount(account.id, { balance: account.balance + balanceChange });
    }
  };

  const updateTransaction = (id: string, updatedTransaction: Partial<Transaction>) => {
    const oldTransaction = transactions.find(t => t.id === id);
    if (!oldTransaction) return;

    // Update the transaction
    setTransactions(transactions.map(t => 
      t.id === id ? { ...t, ...updatedTransaction } : t
    ));

    // If amount or type changed, update account balance
    if (updatedTransaction.amount !== undefined || updatedTransaction.type !== undefined) {
      const account = accounts.find(acc => acc.id === oldTransaction.accountId);
      if (account) {
        // Reverse old transaction
        const oldBalanceChange = oldTransaction.type === 'income' ? oldTransaction.amount : -oldTransaction.amount;
        // Apply new transaction
        const newAmount = updatedTransaction.amount || oldTransaction.amount;
        const newType = updatedTransaction.type || oldTransaction.type;
        const newBalanceChange = newType === 'income' ? newAmount : -newAmount;
        
        updateAccount(account.id, { 
          balance: account.balance - oldBalanceChange + newBalanceChange 
        });
      }
    }
  };

  const deleteTransaction = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    setTransactions(transactions.filter(t => t.id !== id));
    
    // Update account balance
    const account = accounts.find(acc => acc.id === transaction.accountId);
    if (account) {
      const balanceChange = transaction.type === 'income' ? -transaction.amount : transaction.amount;
      updateAccount(account.id, { balance: account.balance + balanceChange });
    }
  };

  // Budget methods
  const addBudget = (budget: Omit<Budget, 'id'>) => {
    const newBudget = { ...budget, id: Date.now().toString() };
    setBudgets([...budgets, newBudget]);
  };

  const updateBudget = (id: string, updatedBudget: Partial<Budget>) => {
    setBudgets(budgets.map(budget => 
      budget.id === id ? { ...budget, ...updatedBudget } : budget
    ));
  };

  const deleteBudget = (id: string) => {
    setBudgets(budgets.filter(budget => budget.id !== id));
  };

  // Recurring transaction methods
  const addRecurringTransaction = (transaction: RecurringTransaction) => {
    const newTransaction = { ...transaction, id: Date.now().toString() };
    setRecurringTransactions([...recurringTransactions, newTransaction]);
  };

  const deleteRecurringTransaction = (id: string) => {
    setRecurringTransactions(recurringTransactions.filter(t => t.id !== id));
  };

  // Data management
  const clearAllData = () => {
    setAccounts([]);
    setTransactions([]);
    setBudgets([]);
    setRecurringTransactions([]);
    localStorage.removeItem('moneyTrackerData');
  };

  const exportData = () => {
    return JSON.stringify({
      accounts,
      transactions,
      budgets,
      recurringTransactions,
      exportDate: new Date().toISOString()
    }, null, 2);
  };

  const importData = (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      if (data.accounts) setAccounts(data.accounts);
      if (data.transactions) {
        setTransactions(data.transactions.map((t: any) => ({
          ...t,
          date: new Date(t.date)
        })));
      }
      if (data.budgets) setBudgets(data.budgets);
      if (data.recurringTransactions) setRecurringTransactions(data.recurringTransactions);
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  };

  const loadTestData = () => {
    // Sample accounts
    const testAccounts: Account[] = [
      {
        id: '1',
        name: 'Main Checking',
        type: 'checking',
        balance: 5420.50,
        currency: 'GBP',
        institution: 'HSBC',
        lastUpdated: new Date()
      },
      {
        id: '2',
        name: 'Savings Account',
        type: 'savings',
        balance: 12750.00,
        currency: 'GBP',
        institution: 'HSBC',
        lastUpdated: new Date()
      },
      {
        id: '3',
        name: 'Credit Card',
        type: 'credit',
        balance: -1234.56,
        currency: 'GBP',
        institution: 'Barclaycard',
        lastUpdated: new Date()
      },
      {
        id: '4',
        name: 'Investment Account',
        type: 'investment',
        balance: 25000.00,
        currency: 'GBP',
        institution: 'Vanguard',
        lastUpdated: new Date()
      },
      {
        id: '5',
        name: 'Mortgage',
        type: 'loan',
        balance: -185000.00,
        currency: 'GBP',
        institution: 'Nationwide',
        lastUpdated: new Date()
      }
    ];

    // Sample transactions
    const testTransactions: Transaction[] = [
      {
        id: '101',
        date: new Date('2024-01-15'),
        description: 'Salary',
        amount: 3500.00,
        type: 'income',
        category: 'Income',
        accountId: '1',
        cleared: true
      },
      {
        id: '102',
        date: new Date('2024-01-16'),
        description: 'Tesco Groceries',
        amount: 87.43,
        type: 'expense',
        category: 'Groceries',
        accountId: '1',
        tags: ['shopping', 'weekly']
      },
      {
        id: '103',
        date: new Date('2024-01-17'),
        description: 'Transfer to Savings',
        amount: 500.00,
        type: 'expense',
        category: 'Transfer',
        accountId: '1',
        notes: 'Monthly savings goal'
      },
      {
        id: '104',
        date: new Date('2024-01-17'),
        description: 'Transfer from Checking',
        amount: 500.00,
        type: 'income',
        category: 'Transfer',
        accountId: '2',
        reconciledWith: '103'
      },
      {
        id: '105',
        date: new Date('2024-01-20'),
        description: 'Electricity Bill',
        amount: 145.00,
        type: 'expense',
        category: 'Utilities',
        accountId: '1',
        isRecurring: true
      }
    ];

    // Sample budgets
    const testBudgets: Budget[] = [
      {
        id: '201',
        category: 'Groceries',
        amount: 400,
        period: 'monthly'
      },
      {
        id: '202',
        category: 'Utilities',
        amount: 200,
        period: 'monthly'
      },
      {
        id: '203',
        category: 'Entertainment',
        amount: 150,
        period: 'monthly'
      }
    ];

    setAccounts(testAccounts);
    setTransactions(testTransactions);
    setBudgets(testBudgets);
  };

  return (
    <AppContext.Provider value={{
      accounts,
      transactions,
      budgets,
      recurringTransactions,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addBudget,
      updateBudget,
      deleteBudget,
      clearAllData,
      exportData,
      importData,
      loadTestData,
      addRecurringTransaction,
      deleteRecurringTransaction
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
