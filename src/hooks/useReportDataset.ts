import { useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { computeIncomeExpense, type IncomeExpenseBreakdown } from '../utils/incomeExpense';
import { expandSplitTransactions, type SplitExpandedTransaction } from '../utils/transactionSplits';
import type { UsePeriodResult } from './usePeriod';
import type { Account, Category, Transaction, TransactionSplit } from '../types';

/**
 * The dataset every spending report reads: the selected period and account
 * filter applied once, split transactions expanded once, and the shared
 * income/expense classification run once.
 *
 * One hook means the gallery's reports cannot disagree with each other or
 * with the Dashboard — they are all looking at the same rows, classified by
 * `utils/incomeExpense` (category semantics; transfers and uncategorised rows
 * excluded from every total).
 */
export interface ReportDataset {
  accounts: Account[];
  categories: Category[];
  /** Unfiltered, unexpanded — for editors that need the real record. */
  allTransactions: Transaction[];
  /** Account-filtered but NOT period-filtered — for other-window maths. */
  accountTransactions: Transaction[];
  transactionSplits: TransactionSplit[];
  /** Period- and account-filtered, split-expanded. */
  rows: SplitExpandedTransaction[];
  flows: IncomeExpenseBreakdown;
}

export function useReportDataset(picker: UsePeriodResult, accountId: string): ReportDataset {
  const { transactions, transactionSplits, accounts, categories } = useApp();
  const { inRange } = picker;

  const accountTransactions = useMemo(
    () => (accountId === 'all' ? transactions : transactions.filter(t => t.accountId === accountId)),
    [transactions, accountId]
  );

  // Split parents become one row per line so each line's value lands in ITS
  // category — the same view every other reporting surface uses.
  const rows = useMemo(
    () => expandSplitTransactions(accountTransactions, transactionSplits).filter(t => inRange(t.date)),
    [accountTransactions, transactionSplits, inRange]
  );

  // Already expanded, so splits are passed empty — no double expansion.
  const flows = useMemo(() => computeIncomeExpense(rows, [], categories), [rows, categories]);

  return {
    accounts,
    categories,
    allTransactions: transactions,
    accountTransactions,
    transactionSplits,
    rows,
    flows,
  };
}
