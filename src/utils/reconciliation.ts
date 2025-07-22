// Shared reconciliation logic between Dashboard and Reconciliation pages

export interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  accountId: string;
  type: 'credit' | 'debit';
  bankReference?: string;
  merchantCategory?: string;
}

// Mock bank transactions (same data used by both pages)
const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

export const mockBankTransactions: BankTransaction[] = [
  {
    id: 'bank-1',
    date: new Date(currentYear, currentMonth, 10),
    description: 'TESCO STORES 2345',
    amount: 45.67,
    accountId: '1',
    type: 'debit',
    merchantCategory: 'Groceries'
  },
  {
    id: 'bank-2',
    date: new Date(currentYear, currentMonth, 11),
    description: 'TFL TRAVEL CHARGE',
    amount: 8.40,
    accountId: '1',
    type: 'debit',
    merchantCategory: 'Transportation'
  },
  {
    id: 'bank-3',
    date: new Date(currentYear, currentMonth, 12),
    description: 'SALARY - TECH CORP LTD',
    amount: 3500.00,
    accountId: '1',
    type: 'credit',
    merchantCategory: 'Salary'
  },
  {
    id: 'bank-4',
    date: new Date(currentYear, currentMonth, 13),
    description: 'TRANSFER TO SAVINGS',
    amount: 500.00,
    accountId: '1',
    type: 'debit',
    bankReference: 'TFR-123456'
  },
  {
    id: 'bank-5',
    date: new Date(currentYear, currentMonth, 14),
    description: 'NETFLIX.COM',
    amount: 15.99,
    accountId: '1',
    type: 'debit',
    merchantCategory: 'Entertainment'
  },
  {
    id: 'bank-6',
    date: new Date(currentYear, currentMonth, 15),
    description: 'BARCLAYCARD PAYMENT',
    amount: 250.00,
    accountId: '7',
    type: 'credit',
    merchantCategory: 'Payment'
  },
  {
    id: 'bank-7',
    date: new Date(currentYear, currentMonth, 16),
    description: 'AMAZON.CO.UK',
    amount: 89.99,
    accountId: '7',
    type: 'debit',
    merchantCategory: 'Shopping'
  },
  {
    id: 'bank-8',
    date: new Date(currentYear, currentMonth, 16),
    description: 'MORTGAGE PAYMENT',
    amount: 1200.00,
    accountId: '1',
    type: 'debit',
    merchantCategory: 'Housing'
  },
  {
    id: 'bank-9',
    date: new Date(currentYear, currentMonth, 17),
    description: 'INTEREST CREDIT',
    amount: 2.50,
    accountId: '2',
    type: 'credit',
    merchantCategory: 'Interest'
  },
  {
    id: 'bank-10',
    date: new Date(currentYear, currentMonth, 18),
    description: 'TRANSFER FROM CURRENT',
    amount: 500.00,
    accountId: '2',
    type: 'credit',
    bankReference: 'TFR-123456'
  }
];

import type { Account, Transaction } from '../types';

// Shared reconciliation utility functions
export const getUnreconciledCount = (accountId: string, transactions: Transaction[]): number => {
  // Count uncleared transactions for this account
  return transactions.filter(t => 
    t.accountId === accountId && t.cleared !== true
  ).length;
};

export interface ReconciliationSummary {
  account: Account;
  unreconciledCount: number;
  totalToReconcile: number;
  lastImportDate: Date | null;
}

export const getReconciliationSummary = (accounts: Account[], transactions: Transaction[]): ReconciliationSummary[] => {
  // Get all accounts that have uncleared transactions
  const reconciliationDetails = accounts.map(account => {
    const accountTransactions = transactions.filter(t => t.accountId === account.id);
    const unclearedTransactions = accountTransactions.filter(t => t.cleared !== true);
    const unreconciledCount = unclearedTransactions.length;
    
    const totalToReconcile = unclearedTransactions.reduce((sum, t) => {
      // For expenses, count as positive amount to reconcile
      // For income, count as positive amount to reconcile
      return sum + Math.abs(t.amount);
    }, 0);

    // Get the most recent transaction date as last import date
    const lastImportDate = accountTransactions.length > 0 
      ? new Date(Math.max(...accountTransactions.map(t => new Date(t.date).getTime())))
      : null;

    return {
      account,
      unreconciledCount,
      totalToReconcile,
      lastImportDate
    };
  }).filter(summary => summary.unreconciledCount > 0); // Only accounts with unreconciled items

  return reconciliationDetails;
};