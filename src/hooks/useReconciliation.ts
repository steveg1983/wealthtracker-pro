import { useMemo, useCallback } from 'react';
import type { Account, Transaction } from '../types';

export interface ReconciliationSummary {
  account: Account;
  unreconciledCount: number;
  bankBalance: number | null;
  accountBalance: number;
  clearedBalance: number;
  difference: number | null;
  lastReconciledDate: Date | null;
}

interface UseReconciliationReturn {
  reconciliationDetails: ReconciliationSummary[];
  totalUnreconciledCount: number;
  getUnreconciledCount: (accountId: string) => number;
  computeAccountBalance: (accountId: string) => number;
  computeClearedBalance: (accountId: string) => number;
}

export function useReconciliation(accounts: Account[], transactions: Transaction[]): UseReconciliationReturn {
  // Build per-account transaction maps once
  const accountTransactionMap = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const list = map.get(t.accountId);
      if (list) {
        list.push(t);
      } else {
        map.set(t.accountId, [t]);
      }
    }
    return map;
  }, [transactions]);

  const computeAccountBalance = useCallback((accountId: string): number => {
    const account = accounts.find(a => a.id === accountId);
    const openingBalance = account?.openingBalance ?? 0;
    const txns = accountTransactionMap.get(accountId) ?? [];
    return openingBalance + txns.reduce((sum, t) => sum + t.amount, 0);
  }, [accounts, accountTransactionMap]);

  const computeClearedBalance = useCallback((accountId: string): number => {
    const account = accounts.find(a => a.id === accountId);
    const openingBalance = account?.openingBalance ?? 0;
    const txns = accountTransactionMap.get(accountId) ?? [];
    return openingBalance + txns.filter(t => t.cleared === true).reduce((sum, t) => sum + t.amount, 0);
  }, [accounts, accountTransactionMap]);

  const reconciliationDetails = useMemo<ReconciliationSummary[]>(() =>
    accounts.map(account => {
      const txns = accountTransactionMap.get(account.id) ?? [];
      const unreconciledCount = txns.filter(t => t.cleared !== true).length;
      const bankBalance = account.bankBalance ?? null;
      const openingBalance = account.openingBalance ?? 0;
      const accountBalance = openingBalance + txns.reduce((sum, t) => sum + t.amount, 0);
      const clearedBalance = openingBalance + txns.filter(t => t.cleared === true).reduce((sum, t) => sum + t.amount, 0);
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
    }),
    [accounts, accountTransactionMap]
  );

  const totalUnreconciledCount = useMemo(() =>
    transactions.filter(t => t.cleared !== true).length,
    [transactions]
  );

  const getUnreconciledCount = useCallback(
    (accountId: string) =>
      (accountTransactionMap.get(accountId) ?? []).filter(t => t.cleared !== true).length,
    [accountTransactionMap]
  );

  return {
    reconciliationDetails,
    totalUnreconciledCount,
    getUnreconciledCount,
    computeAccountBalance,
    computeClearedBalance,
  };
}
