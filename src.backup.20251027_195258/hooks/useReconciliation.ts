import { useMemo } from 'react';
import { getReconciliationSummary } from '../utils/reconciliation';
import type { ReconciliationSummary } from '../utils/reconciliation';
import type { Account, Transaction } from '../types';

interface UseReconciliationReturn {
  reconciliationDetails: ReconciliationSummary[];
  totalUnreconciledCount: number;
  getUnreconciledCount: (accountId: string) => number;
}

export function useReconciliation(accounts: Account[], transactions: Transaction[]): UseReconciliationReturn {
  // Get reconciliation summary (memoized)
  const reconciliationDetails = useMemo(() => 
    getReconciliationSummary(accounts, transactions),
    [accounts, transactions]
  );

  // Count total unreconciled transactions (memoized)
  const totalUnreconciledCount = useMemo(() => 
    transactions.filter(t => t.cleared !== true).length,
    [transactions]
  );

  // Get unreconciled count for specific account (memoized)
  const getUnreconciledCount = useMemo(() => 
    (accountId: string) => transactions.filter(t => 
      t.accountId === accountId && t.cleared !== true
    ).length,
    [transactions]
  );

  return {
    reconciliationDetails,
    totalUnreconciledCount,
    getUnreconciledCount
  };
}