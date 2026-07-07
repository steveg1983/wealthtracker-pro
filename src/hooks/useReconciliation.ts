import { useMemo, useCallback } from 'react';
import { toDecimal } from '../utils/decimal';
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

/** MS Money-style session totals: what's been marked cleared, split by direction. */
export interface ClearedSummary {
  clearedCount: number;
  totalCount: number;
  depositsTotal: number;
  depositsCount: number;
  paymentsTotal: number;
  paymentsCount: number;
}

interface UseReconciliationReturn {
  reconciliationDetails: ReconciliationSummary[];
  totalUnreconciledCount: number;
  getUnreconciledCount: (accountId: string) => number;
  computeAccountBalance: (accountId: string) => number;
  computeClearedBalance: (accountId: string) => number;
  computeClearedSummary: (accountId: string) => ClearedSummary;
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
    return txns
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(openingBalance))
      .toNumber();
  }, [accounts, accountTransactionMap]);

  const computeClearedBalance = useCallback((accountId: string): number => {
    const account = accounts.find(a => a.id === accountId);
    const openingBalance = account?.openingBalance ?? 0;
    const txns = accountTransactionMap.get(accountId) ?? [];
    return txns
      .filter(t => t.cleared === true)
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(openingBalance))
      .toNumber();
  }, [accounts, accountTransactionMap]);

  const computeClearedSummary = useCallback((accountId: string): ClearedSummary => {
    const txns = accountTransactionMap.get(accountId) ?? [];
    let depositsTotal = toDecimal(0);
    let paymentsTotal = toDecimal(0);
    let depositsCount = 0;
    let paymentsCount = 0;
    let clearedCount = 0;

    for (const t of txns) {
      if (t.cleared !== true) continue;
      clearedCount += 1;
      if (t.amount >= 0) {
        depositsTotal = depositsTotal.plus(toDecimal(t.amount));
        depositsCount += 1;
      } else {
        paymentsTotal = paymentsTotal.plus(toDecimal(t.amount));
        paymentsCount += 1;
      }
    }

    return {
      clearedCount,
      totalCount: txns.length,
      depositsTotal: depositsTotal.toNumber(),
      depositsCount,
      paymentsTotal: paymentsTotal.toNumber(),
      paymentsCount,
    };
  }, [accountTransactionMap]);

  const reconciliationDetails = useMemo<ReconciliationSummary[]>(() =>
    accounts.map(account => {
      const txns = accountTransactionMap.get(account.id) ?? [];
      const unreconciledCount = txns.filter(t => t.cleared !== true).length;
      const bankBalance = account.bankBalance ?? null;
      const openingBalance = account.openingBalance ?? 0;
      const accountBalance = txns
        .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(openingBalance))
        .toNumber();
      const clearedBalance = txns
        .filter(t => t.cleared === true)
        .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(openingBalance))
        .toNumber();
      const difference = bankBalance != null
        ? toDecimal(bankBalance).minus(toDecimal(clearedBalance)).toNumber()
        : null;

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
    computeClearedSummary,
  };
}
