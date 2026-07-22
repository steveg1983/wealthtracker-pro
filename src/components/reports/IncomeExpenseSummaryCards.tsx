import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { SkeletonText } from '../loading/Skeleton';
import ReportDrillModal, { type ReportDrillTarget } from './ReportDrillModal';
import { toDecimal } from '../../utils/decimal';
import { formatDecimal } from '../../utils/decimal-format';
import type { Category } from '../../types';
import type { IncomeExpenseBreakdown } from '../../utils/incomeExpense';

/**
 * Total income, total expenses, what is left and the savings rate — the four
 * figures every spending report is measured against, drawn from the SAME
 * classified rows the report itself uses, so a card can never disagree with
 * the table beneath it.
 *
 * Income and Expenses are buttons: both drill into the transactions behind
 * them.
 */
export default function IncomeExpenseSummaryCards({
  flows,
  categories,
}: {
  flows: IncomeExpenseBreakdown;
  categories: Category[];
}): React.JSX.Element {
  const { isLoading } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);

  const summary = useMemo(() => {
    const net = flows.income.minus(flows.expenses);
    const savingsRate = flows.income.greaterThan(0)
      ? net.dividedBy(flows.income).times(100)
      : toDecimal(0);
    return {
      income: flows.income.toNumber(),
      expenses: flows.expenses.toNumber(),
      net: net.toNumber(),
      savingsRate: savingsRate.toNumber(),
    };
  }, [flows]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* flex-col: buttons lay children out in a ROW by default, which would
            put the figure beside the label — every stat card stacks label OVER
            figure, matching the Dashboard. */}
        <button
          type="button"
          onClick={() => setDrill({
            title: 'Income Breakdown',
            bucket: 'income',
            rows: flows.incomeRows,
            total: summary.income,
          })}
          className="flex flex-col items-start bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 text-left cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Income</p>
          {/* div, not p: the loading skeleton renders block elements and a
              <div> inside <p> is invalid DOM nesting */}
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.income)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDrill({
            title: 'Expense Breakdown',
            bucket: 'expense',
            rows: flows.expenseRows,
            total: summary.expenses,
          })}
          className="flex flex-col items-start bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 text-left cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Expenses</p>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.expenses)}
          </div>
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Income</p>
          <div className={`text-2xl font-bold ${
            summary.net >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isLoading ? <SkeletonText className="w-32 h-8" /> : formatCurrency(summary.net)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Savings Rate</p>
          <div className={`text-2xl font-bold ${
            summary.savingsRate >= 20 ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'
          }`}>
            {isLoading ? <SkeletonText className="w-20 h-8" /> : `${formatDecimal(summary.savingsRate, 1)}%`}
          </div>
        </div>
      </div>

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />
    </>
  );
}
