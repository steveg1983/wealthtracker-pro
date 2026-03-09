// Shared reconciliation logic

import type { Account, Transaction } from '../types';

export const getUnreconciledCount = (accountId: string, transactions: Transaction[]): number => {
  return transactions.filter(t =>
    t.accountId === accountId && t.cleared !== true
  ).length;
};

export interface ReconciliationSummary {
  account: Account;
  unreconciledCount: number;
  bankBalance: number | null;
  accountBalance: number;
  clearedBalance: number;
  difference: number | null;
  lastReconciledDate: Date | null;
}

export const getReconciliationSummary = (accounts: Account[], transactions: Transaction[]): ReconciliationSummary[] => {
  return accounts.map(account => {
    const accountTransactions = transactions.filter(t => t.accountId === account.id);
    const unreconciledCount = accountTransactions.filter(t => t.cleared !== true).length;
    const openingBalance = account.openingBalance ?? 0;
    const accountBalance = openingBalance + accountTransactions.reduce((sum, t) => sum + t.amount, 0);
    const clearedBalance = openingBalance + accountTransactions.filter(t => t.cleared === true).reduce((sum, t) => sum + t.amount, 0);
    const bankBalance = account.bankBalance ?? null;
    const difference = bankBalance != null ? bankBalance - clearedBalance : null;

    return {
      account,
      unreconciledCount,
      bankBalance,
      accountBalance,
      clearedBalance,
      difference,
      lastReconciledDate: account.lastReconciledDate ?? null,
    };
  });
};
