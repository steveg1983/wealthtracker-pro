import React, { useState, useCallback, useEffect } from 'react';
import { TransactionContext } from './transaction-context-base';
import type { TransactionContextType, Transaction, RecurringTransaction } from './transaction-context-base';

interface TransactionProviderProps {
  children: React.ReactNode;
}

export function TransactionProvider({ children }: TransactionProviderProps): React.JSX.Element {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Load transactions from localStorage on mount
  useEffect(() => {
    const storedTransactions = localStorage.getItem('wealthtracker-transactions');
    if (storedTransactions) {
      try {
        const parsed = JSON.parse(storedTransactions);
        setTransactions(parsed);
      } catch (error) {
        console.error('Failed to parse stored transactions:', error);
      }
    }

    const storedRecurring = localStorage.getItem('wealthtracker-recurring-transactions');
    if (storedRecurring) {
      try {
        const parsed = JSON.parse(storedRecurring);
        setRecurringTransactions(parsed);
      } catch (error) {
        console.error('Failed to parse stored recurring transactions:', error);
      }
    }
  }, []);

  // Save transactions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('wealthtracker-transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('wealthtracker-recurring-transactions', JSON.stringify(recurringTransactions));
  }, [recurringTransactions]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
    setLoading(true);
    try {
      const newTransaction: Transaction = {
        ...transaction,
        id: `transaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      setTransactions(prev => [newTransaction, ...prev]);
      return newTransaction;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>): Promise<void> => {
    setLoading(true);
    try {
      setTransactions(prev =>
        prev.map(transaction =>
          transaction.id === id ? { ...transaction, ...updates } : transaction
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTransaction = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      setTransactions(prev => prev.filter(transaction => transaction.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkDeleteTransactions = useCallback(async (ids: string[]): Promise<void> => {
    setLoading(true);
    try {
      setTransactions(prev => prev.filter(transaction => !ids.includes(transaction.id)));
    } finally {
      setLoading(false);
    }
  }, []);

  const getTransactionById = useCallback((id: string): Transaction | undefined => {
    return transactions.find(transaction => transaction.id === id);
  }, [transactions]);

  const getTransactionsByAccount = useCallback((accountId: string): Transaction[] => {
    return transactions.filter(transaction => transaction.accountId === accountId);
  }, [transactions]);

  const getTransactionsByCategory = useCallback((category: string): Transaction[] => {
    return transactions.filter(transaction => transaction.category === category);
  }, [transactions]);

  const getTransactionsByDateRange = useCallback((startDate: Date, endDate: Date): Transaction[] => {
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [transactions]);

  const addRecurringTransaction = useCallback(async (recurringTransaction: Omit<RecurringTransaction, 'id'>): Promise<RecurringTransaction> => {
    setLoading(true);
    try {
      const newRecurringTransaction: RecurringTransaction = {
        ...recurringTransaction,
        id: `recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      setRecurringTransactions(prev => [...prev, newRecurringTransaction]);
      return newRecurringTransaction;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRecurringTransaction = useCallback(async (id: string, updates: Partial<RecurringTransaction>): Promise<void> => {
    setLoading(true);
    try {
      setRecurringTransactions(prev =>
        prev.map(recurring =>
          recurring.id === id ? { ...recurring, ...updates } : recurring
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRecurringTransaction = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      setRecurringTransactions(prev => prev.filter(recurring => recurring.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  const importTransactions = useCallback(async (importedTransactions: Transaction[]): Promise<void> => {
    setLoading(true);
    try {
      // Add imported transactions, avoiding duplicates based on amount, date, and description
      const existingSet = new Set(
        transactions.map(t => `${t.amount}_${t.date}_${t.description}`)
      );

      const newTransactions = importedTransactions.filter(
        transaction => !existingSet.has(`${transaction.amount}_${transaction.date}_${transaction.description}`)
      );

      if (newTransactions.length > 0) {
        setTransactions(prev => [...newTransactions, ...prev]);
      }
    } finally {
      setLoading(false);
    }
  }, [transactions]);

  const contextValue: TransactionContextType = {
    transactions,
    recurringTransactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    bulkDeleteTransactions,
    getTransactionById,
    getTransactionsByAccount,
    getTransactionsByCategory,
    getTransactionsByDateRange,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    importTransactions
  };

  return (
    <TransactionContext.Provider value={contextValue}>
      {children}
    </TransactionContext.Provider>
  );
}
