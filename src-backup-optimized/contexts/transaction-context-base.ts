import { createContext } from 'react';
import type { RecurringTransaction, Transaction } from '../types';

export type { RecurringTransaction, Transaction };

export interface TransactionContextType {
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

export const TransactionContext = createContext<TransactionContextType | undefined>(undefined);
