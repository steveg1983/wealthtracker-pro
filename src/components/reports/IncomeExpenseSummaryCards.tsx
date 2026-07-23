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
 *
 * Portfolio gains & losses (revaluations) are a SEPARATE, opt-in line below
 * the cards. They are never part of the income/expense/net totals — the
 * classifier rules them out unconditionally — because a change in an account's
 * value is not money earned or spent, and on this day-to-day report a paper
 * "gain" is not income received. `showRevaluations` only controls whether that
 * separate line is displayed; it can never move a figure into the totals.
 */
export default function IncomeExpenseSummaryCards({
  flows,
  categories,
  showRevaluations = false,
}: {
  flows: IncomeExpenseBreakdown;
  categories: Category[];
  showRevaluations?: boolean;
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
      // NET, signed — an upward revaluation is positive, a downward one
      // negative. Kept out of every figure above by construction.
      revaluation: flows.revaluation.toNumber(),
      revaluationCount: flows.revaluationRows.length,
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

      {/* Opt-in, and only when there is something to show. A full-width band,
          not a fifth card, so it reads as a note beside the day-to-day figures
          rather than a peer of income and spending. Drills in with 'neutral'
          so rows keep their own signed amounts (a gain +, a loss −). */}
      {showRevaluations && flows.revaluationRows.length > 0 && (
        <button
          type="button"
          onClick={() => setDrill({
            title: 'Portfolio gains & losses',
            bucket: 'neutral',
            rows: flows.revaluationRows,
            total: summary.revaluation,
          })}
          className="mt-4 w-full flex flex-col items-start bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        >
          <div className="flex w-full items-baseline justify-between gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Portfolio gains &amp; losses
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                {summary.revaluationCount} {summary.revaluationCount === 1 ? 'revaluation' : 'revaluations'}
              </span>
            </p>
            <div className={`text-2xl font-bold ${
              summary.revaluation >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {isLoading
                ? <SkeletonText className="w-32 h-8" />
                : summary.revaluation >= 0
                  ? `+${formatCurrency(summary.revaluation)}`
                  : `-${formatCurrency(Math.abs(summary.revaluation))}`}
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            A change in what your accounts are worth — not counted in income or expenses.
          </p>
        </button>
      )}

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />
    </>
  );
}
