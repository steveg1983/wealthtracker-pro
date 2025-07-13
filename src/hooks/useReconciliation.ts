import { useMemo } from 'react';
import { getReconciliationSummary, mockBankTransactions } from '../utils/reconciliation';
import type { ReconciliationSummary } from '../utils/reconciliation';

interface UseReconciliationReturn {
  reconciliationDetails: ReconciliationSummary[];
  totalUnreconciledCount: number;
  getUnreconciledCount: (accountId: string) => number;
}

export function useReconciliation(accounts: any[], transactions: any[]): UseReconciliationReturn {
  // Get reconciliation summary (memoized)
  const reconciliationDetails = useMemo(() => 
    getReconciliationSummary(accounts, transactions),
    [accounts, transactions]
  );

  // Count total unreconciled transactions (memoized)
  const totalUnreconciledCount = useMemo(() => 
    mockBankTransactions.filter(bt => 
      !transactions.some(t => (t as any).bankReference === bt.id)
    ).length,
    [transactions]
  );

  // Get unreconciled count for specific account (memoized)
  const getUnreconciledCount = useMemo(() => 
    (accountId: string) => mockBankTransactions.filter(bt => 
      bt.accountId === accountId && !transactions.some(t => (t as any).bankReference === bt.id)
    ).length,
    [transactions]
  );

  return {
    reconciliationDetails,
    totalUnreconciledCount,
    getUnreconciledCount
  };
}