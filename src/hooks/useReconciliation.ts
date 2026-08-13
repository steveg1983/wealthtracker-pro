import { useMemo, useCallback } from 'react';
import { toDecimal } from '../utils/decimal';
import { isMarkedAwaitingFinalize, isReconciled } from '../utils/transactionReconciliation';
import type { Account, Transaction } from '../types';

export interface ReconciliationSummary {
  account: Account;
  /**
   * Rows this account has NOT reconciled — never "rows not marked".
   *
   * The distinction is the owner's core complaint: marking eight hundred rows
   * and walking away used to leave this at zero, so the Accounts page said the
   * work was done when nothing had been finalized. It counts the committed
   * state, so an account with everything marked and nothing finalized still
   * shows every one of those rows as outstanding.
   */
  unreconciledCount: number;
  bankBalance: number | null;
  accountBalance: number;
  clearedBalance: number;
  difference: number | null;
  lastReconciledDate: Date | null;
  /** The ending balance the last finalized reconciliation was settled against. */
  lastReconciledBalance: number | null;
}

/** MS Money-style session totals: what's been marked, split by direction. */
export interface ClearedSummary {
  clearedCount: number;
  totalCount: number;
  depositsTotal: number;
  depositsCount: number;
  paymentsTotal: number;
  paymentsCount: number;
  /**
   * Marked but not yet committed — exactly what Finalize would convert, and the
   * number the finalize step reports back. Distinct from `clearedCount`, which
   * includes rows reconciled in earlier sessions.
   */
  awaitingFinalizeCount: number;
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
    let awaitingFinalizeCount = 0;

    for (const t of txns) {
      if (t.cleared !== true) continue;
      clearedCount += 1;
      if (isMarkedAwaitingFinalize(t)) awaitingFinalizeCount += 1;
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
      awaitingFinalizeCount,
    };
  }, [accountTransactionMap]);

  const reconciliationDetails = useMemo<ReconciliationSummary[]>(() =>
    accounts.map(account => {
      const txns = accountTransactionMap.get(account.id) ?? [];
      const unreconciledCount = txns.filter(t => !isReconciled(t)).length;
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
        lastReconciledBalance: account.lastReconciledBalance ?? null,
      };
    }),
    [accounts, accountTransactionMap]
  );

  /**
   * The headline figure — and it counts ONLY the accounts this page lists.
   *
   * It used to count every unreconciled row in the ledger, which is a
   * different question from the one the page answers. The owner's book made
   * the gap plain: the heading read 2,447 while every account on screen said
   * "All reconciled", because all 2,447 sat on 73 CLOSED accounts. Closed
   * accounts are deliberately absent from this page (they are fetched
   * separately and never listed here) — closing one is how you say you are
   * done with it, and there is no bank statement left to agree it against.
   * A page whose whole job is "how much work is left, and where" must not
   * count work it will not show you, and cannot let you do.
   *
   * Scoped to `accounts` rather than to a flag, so it stays true by
   * construction: reopen an account and it returns to that list, and its rows
   * return to this count with it. Nothing here needs to know what "closed"
   * means.
   */
  const totalUnreconciledCount = useMemo(() => {
    const listedAccountIds = new Set(accounts.map(a => a.id));
    return transactions.filter(
      t => listedAccountIds.has(t.accountId) && !isReconciled(t)
    ).length;
  }, [accounts, transactions]);

  const getUnreconciledCount = useCallback(
    (accountId: string) =>
      (accountTransactionMap.get(accountId) ?? []).filter(t => !isReconciled(t)).length,
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
