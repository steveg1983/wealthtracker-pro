import React from 'react';
import type { Account } from '../../types';

interface DashboardTransaction {
  date: Date;
  amount: number;
  type?: string;
}

export function useDashboardCalculations(
  accounts: Account[],
  transactions: DashboardTransaction[]
) {
  return React.useMemo(() => {
    const totalAssets = accounts
      .filter(acc => acc.isActive && acc.type !== 'credit' && acc.type !== 'loan')
      .reduce((sum, acc) => sum + acc.balance, 0);

    const totalLiabilities = accounts
      .filter(acc => acc.isActive && (acc.type === 'credit' || acc.type === 'loan'))
      .reduce((sum, acc) => sum + acc.balance, 0);

    const netWorth = totalAssets - totalLiabilities;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlySpending = transactions
      .filter(txn => txn.date >= thirtyDaysAgo && txn.amount < 0)
      .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      monthlySpending
    };
  }, [accounts, transactions]);
}
