import React, { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '../components/icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useReportDataset } from '../hooks/useReportDataset';
import { useReportAccountFilter } from '../hooks/useReportAccountFilter';
import ReportAccountFilter from '../components/reports/ReportAccountFilter';
import ReportDrillModal, { type ReportDrillTarget } from '../components/reports/ReportDrillModal';
import ReportExportBar from '../components/reports/ReportExportBar';
import IncomeExpenseSummaryCards from '../components/reports/IncomeExpenseSummaryCards';
import UncategorisedReviewBand from '../components/reports/UncategorisedReviewBand';
import MonthlyIncomeExpenseMatrix, { type MatrixDrillTarget } from '../components/MonthlyIncomeExpenseMatrix';
import EditTransactionModal from '../components/EditTransactionModal';
import { buildMonthlyCategoryMatrix, monthKeyOf } from '../utils/monthlyCategoryMatrix';
import { buildCategoryNameLookup } from '../utils/categoryNames';
import { PERIOD_LABELS } from '../hooks/usePeriod';
import type { ReportViewProps } from './reports/types';

/**
 * "Monthly income and expenses" — the Microsoft Money report, and the
 * gallery's detailed read: every category down the side, the months of the
 * selected period across the top, with the four headline figures above it.
 *
 * The summary cards, the matrix and the review band are all built from ONE
 * classification pass (utils/incomeExpense via useReportDataset), so they
 * cannot disagree with each other or with any other report in the gallery.
 *
 * The trend chart and the category pie that used to share this page are now
 * reports of their own in the gallery ("Income and spending over time",
 * "Spending by category").
 */
export default function Reports({ picker }: ReportViewProps): React.JSX.Element {
  const filter = useReportAccountFilter();
  const { accounts, categories, rows, flows, allTransactions } = useReportDataset(picker, filter.accountId);
  const { formatCurrency } = useCurrencyDecimal();
  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Top Transactions is a curiosity next to the matrix, so it starts hidden;
  // the choice is persisted like the report's other view preferences.
  const [showTopTransactions, setShowTopTransactions] = useState<boolean>(
    () => localStorage.getItem('reportsShowTopTransactions') === '1'
  );
  const toggleTopTransactions = (): void => {
    setShowTopTransactions(prev => {
      localStorage.setItem('reportsShowTopTransactions', prev ? '0' : '1');
      return !prev;
    });
  };

  // Category ids are UUIDs — everything user-facing resolves through this
  // lookup ("Parent : Child", "Uncategorised" for a dangling id).
  const categoryName = useMemo(() => buildCategoryNameLookup(categories), [categories]);

  // Biggest movements in the period. A COPY: sorting `rows` in place would
  // mutate the memoised array on every render.
  const topTransactions = useMemo(
    () => [...rows].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10),
    [rows]
  );

  // The Money-style category × month matrix, built from the SAME classified
  // rows as the summary cards so the two can never disagree.
  const matrix = useMemo(
    () => buildMonthlyCategoryMatrix(flows.incomeRows, flows.expenseRows, categories, picker.range),
    [flows, categories, picker.range]
  );

  const handleMatrixDrill = (target: MatrixDrillTarget): void => {
    const source = target.bucket === 'income' ? flows.incomeRows : flows.expenseRows;
    const ids = target.categoryIds ? new Set(target.categoryIds) : null;
    setDrill({
      title: target.label,
      bucket: target.bucket,
      rows: source.filter(t =>
        (ids === null || ids.has(t.category)) &&
        (target.monthKey === null || monthKeyOf(t.date) === target.monthKey)
      ),
      total: target.total,
    });
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportAccountFilter accounts={accounts} filter={filter} />
        <ReportExportBar
          title="Monthly income and expenses"
          dateRange={PERIOD_LABELS[picker.period]}
          rows={rows}
          flows={flows}
          categories={categories}
          accounts={accounts}
        />
      </div>

      <IncomeExpenseSummaryCards flows={flows} categories={categories} />

      {/* Rows with no category are EXCLUDED from every figure above — said out
          loud, with the three ways to clear them. */}
      <UncategorisedReviewBand flows={flows} categories={categories} />

      {/* The detailed read. */}
      <MonthlyIncomeExpenseMatrix matrix={matrix} onDrill={handleMatrixDrill} />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className={`flex items-center justify-between gap-4 p-6 ${showTopTransactions ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}>
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">Top Transactions</h2>
          <button
            type="button"
            onClick={toggleTopTransactions}
            aria-expanded={showTopTransactions}
            aria-controls="top-transactions-panel"
            className="flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            {showTopTransactions ? 'Hide' : 'Show'}
            {showTopTransactions ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
          </button>
        </div>
        <div id="top-transactions-panel" hidden={!showTopTransactions}>
          {/* Mobile card view */}
          <div className="block sm:hidden p-4">
            <div className="space-y-3">
              {topTransactions.map(transaction => (
                <div key={transaction.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(transaction.splitParentId ?? transaction.id)}
                        className="font-medium text-left text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        title="View or edit this transaction"
                      >
                        {transaction.description}
                      </button>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{categoryName(transaction.category)}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p className={`text-lg font-semibold ${
                      transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                    }`}>
                      {/* Amounts are stored signed; derive the sign from the value so incoming transfers show '+' */}
                      {transaction.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop table view — scrolls inside its own box. */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">The ten largest transactions in the selected period</caption>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Category</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {topTransactions.map(transaction => (
                  <tr key={transaction.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      <button
                        type="button"
                        onClick={() => setEditingId(transaction.splitParentId ?? transaction.id)}
                        className="text-left hover:text-blue-700 dark:hover:text-blue-400 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        title="View or edit this transaction"
                      >
                        {transaction.description}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      {categoryName(transaction.category)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium tabular-nums whitespace-nowrap ${
                      transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                    }`}>
                      {/* Amounts are stored signed; derive the sign from the value so incoming transfers show '+' */}
                      {transaction.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />

      {/* A top transaction opens straight in the editor — a split line opens
          its PARENT, which is the real record. */}
      {editingId !== null && (
        <EditTransactionModal
          isOpen
          onClose={() => setEditingId(null)}
          transaction={allTransactions.find(t => t.id === editingId) ?? null}
        />
      )}
    </div>
  );
}
