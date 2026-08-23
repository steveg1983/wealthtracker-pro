import { useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { computeIncomeExpense, type FlowFactorResolver, type IncomeExpenseBreakdown } from '../utils/incomeExpense';
import { expandSplitTransactions, type SplitExpandedTransaction } from '../utils/transactionSplits';
import { useNetWorthConversion } from './useNetWorthConversion';
import type { UsePeriodResult } from './usePeriod';
import type { Account, Category, Transaction, TransactionSplit } from '../types';

/**
 * Which accounts a report covers: 'all', a single account id, or an explicit
 * set of ids (an empty set covers nothing, and reports honest zeros).
 */
export type ReportAccountScope = string | ReadonlySet<string>;

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
  /**
   * THE FLOWS SEAM (the disclosure ruling, 22 Aug §7 phase 1): each row's
   * factor into the display currency, at the row's OWN date, from the ECB
   * history the net-worth series already uses — so a 2017 dollar purchase
   * converts at 2017's rate, never today's. Undefined while the history is
   * unavailable: the totals then stay NATIVE and the hub's mixed-currency
   * disclosure keeps saying so — the seam converts on the real basis or not
   * at all, never on a third one nobody stated. Pages pass this to every
   * aggregator they run over the dataset's rows (payee, matrix, netting,
   * trend, comparison) so no report can sum on a different basis than its
   * own summary cards.
   */
  convert?: FlowFactorResolver;
}

export function useReportDataset(picker: UsePeriodResult, scope: ReportAccountScope): ReportDataset {
  const { transactions, transactionSplits, accounts, categories } = useApp();
  const { inRange } = picker;

  const accountTransactions = useMemo(() => {
    if (typeof scope === 'string') {
      return scope === 'all' ? transactions : transactions.filter(t => t.accountId === scope);
    }
    return transactions.filter(t => scope.has(t.accountId));
  }, [transactions, scope]);

  // Split parents become one row per line so each line's value lands in ITS
  // category — the same view every other reporting surface uses.
  const rows = useMemo(
    () => expandSplitTransactions(accountTransactions, transactionSplits).filter(t => inRange(t.date)),
    [accountTransactions, transactionSplits, inRange]
  );

  // The WHOLE history is fetched (from: null → the ECB epoch, one small
  // cached request) rather than the picker's window, because comparison
  // reports reach for rows before the window and a factor resolved outside
  // the fetched span would carry the wrong rate.
  const { conversionAt, historical } = useNetWorthConversion(accounts, {
    range: { from: null, to: picker.range.to ?? null },
  });

  const convert = useMemo<FlowFactorResolver | undefined>(() => {
    if (!historical || conversionAt === null) return undefined;
    return row => conversionAt(new Date(row.date))?.factors.get(row.accountId) ?? null;
  }, [historical, conversionAt]);

  // Already expanded, so splits are passed empty — no double expansion.
  const flows = useMemo(() => computeIncomeExpense(rows, [], categories, { convert }), [rows, categories, convert]);

  return {
    accounts,
    categories,
    allTransactions: transactions,
    accountTransactions,
    transactionSplits,
    rows,
    flows,
    convert,
  };
}
