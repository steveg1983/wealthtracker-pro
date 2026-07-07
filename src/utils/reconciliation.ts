// Shared reconciliation logic

import type { Account, Transaction } from '../types';

export const getUnreconciledCount = (accountId: string, transactions: Transaction[]): number => {
  return transactions.filter(t =>
    t.accountId === accountId && t.cleared !== true
  ).length;
};

/**
 * Derive a reconciliation adjustment's direction and signed amount from the
 * remaining difference (bank − cleared). Bank higher than cleared → missing
 * income (+); bank lower → missing expense (−). The direction always comes
 * from the difference, never from the sign the user typed.
 */
export function deriveAdjustment(
  difference: number,
  enteredAmount: number | null
): { type: 'income' | 'expense'; signedAmount: number | null } {
  const type: 'income' | 'expense' = difference > 0 ? 'income' : 'expense';
  if (enteredAmount == null) {
    return { type, signedAmount: null };
  }
  const absAmount = Math.abs(enteredAmount);
  return { type, signedAmount: type === 'income' ? absAmount : -absAmount };
}

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
