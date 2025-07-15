import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  categoryName?: string;
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
  isImported?: boolean;
}

interface RecurringTransaction {
  id?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate?: string;
  lastProcessed?: string;
}

interface TransactionContextType {
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addRecurringTransaction: (transaction: RecurringTransaction) => void;
  updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => void;
  deleteRecurringTransaction: (id: string) => void;
  importTransactions: (transactions: Omit<Transaction, 'id'>[]) => void;
  getTransactionsByAccount: (accountId: string) => Transaction[];
  getTransactionsByCategory: (categoryId: string) => Transaction[];
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

interface TransactionProviderProps {
  children: ReactNode;
  initialTransactions?: Transaction[];
  initialRecurringTransactions?: RecurringTransaction[];
}

export function TransactionProvider({ 
  children, 
  initialTransactions = [], 
  initialRecurringTransactions = [] 
}: TransactionProviderProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const savedTransactions = localStorage.getItem('money_management_transactions');
    if (savedTransactions) {
      try {
        const parsed = JSON.parse(savedTransactions);
        return parsed.map((t: any) => ({
          ...t,
          date: new Date(t.date),
          reconciledDate: t.reconciledDate ? new Date(t.reconciledDate) : undefined
        }));
      } catch (error) {
        console.error('Error parsing saved transactions:', error);
        return initialTransactions;
      }
    }
    return initialTransactions;
  });

  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>(() => {
    const savedRecurring = localStorage.getItem('money_management_recurring_transactions');
    if (savedRecurring) {
      try {
        return JSON.parse(savedRecurring);
      } catch (error) {
        console.error('Error parsing saved recurring transactions:', error);
        return initialRecurringTransactions;
      }
    }
    return initialRecurringTransactions;
  });

  // Save transactions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('money_management_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('money_management_recurring_transactions', JSON.stringify(recurringTransactions));
  }, [recurringTransactions]);

  const addTransaction = (transactionData: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: uuidv4()
    };
    setTransactions(prev => [...prev, newTransaction]);
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(transaction => 
      transaction.id === id 
        ? { ...transaction, ...updates }
        : transaction
    ));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(transaction => transaction.id !== id));
  };

  const addRecurringTransaction = (transaction: RecurringTransaction) => {
    const newRecurring: RecurringTransaction = {
      ...transaction,
      id: transaction.id || uuidv4()
    };
    setRecurringTransactions(prev => [...prev, newRecurring]);
  };

  const updateRecurringTransaction = (id: string, updates: Partial<RecurringTransaction>) => {
    setRecurringTransactions(prev => prev.map(recurring =>
      recurring.id === id
        ? { ...recurring, ...updates }
        : recurring
    ));
  };

  const deleteRecurringTransaction = (id: string) => {
    setRecurringTransactions(prev => prev.filter(recurring => recurring.id !== id));
  };

  const importTransactions = (newTransactions: Omit<Transaction, 'id'>[]) => {
    const transactionsWithIds = newTransactions.map(t => ({
      ...t,
      id: uuidv4(),
      isImported: true
    }));
    setTransactions(prev => [...prev, ...transactionsWithIds]);
  };

  // Memoized helper functions
  const getTransactionsByAccount = useMemo(() => {
    return (accountId: string) => transactions.filter(t => t.accountId === accountId);
  }, [transactions]);

  const getTransactionsByCategory = useMemo(() => {
    return (categoryId: string) => transactions.filter(t => t.category === categoryId);
  }, [transactions]);

  return (
    <TransactionContext.Provider value={{
      transactions,
      recurringTransactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addRecurringTransaction,
      updateRecurringTransaction,
      deleteRecurringTransaction,
      importTransactions,
      getTransactionsByAccount,
      getTransactionsByCategory
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransactions must be used within TransactionProvider');
  }
  return context;
}