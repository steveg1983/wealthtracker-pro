import React, { useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { useReportDataset } from '../../hooks/useReportDataset';
import { useReportAccountFilter } from '../../hooks/useReportAccountFilter';
import ReportAccountFilter from '../../components/reports/ReportAccountFilter';
import ReportDrillModal, { type ReportDrillTarget } from '../../components/reports/ReportDrillModal';
import ReportExportBar from '../../components/reports/ReportExportBar';
import UncategorisedReviewBand from '../../components/reports/UncategorisedReviewBand';
import { computeIncomeExpense } from '../../utils/incomeExpense';
import {
  buildPeriodComparison,
  resolveComparisonRanges,
  COMPARISON_BASIS_LABELS,
  type ComparisonBasis,
  type ComparisonCategoryRow,
  type ComparisonFigure,
} from '../../utils/periodComparison';
import { formatDecimal } from '../../utils/decimal-format';
import { PERIOD_LABELS } from '../../hooks/usePeriod';
import type { ReportViewProps } from './types';

/**
 * "This period vs last" — Money's comparison report.
 *
 * Two equal-length windows, classified by the one shared classifier
 * (utils/incomeExpense) and compared by the one shared builder
 * (utils/periodComparison). Both windows are computed from the SAME resolved
 * bounds, so the comparison is never an apples-to-oranges pairing of a full
 * month against a part of one.
 *
 * Every figure — current or comparison — clicks through to the transactions
 * behind it.
 */

const BASIS_KEY = 'reportsComparisonBasis';

const formatWindow = (window: { from: Date; to: Date }): string => {
  const short = (date: Date): string =>
    date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${short(window.from)} – ${short(window.to)}`;
};

export default function PeriodComparisonReport({ picker }: ReportViewProps): React.JSX.Element {
  const filter = useReportAccountFilter();
  const { accounts, categories, accountTransactions, transactionSplits, rows, flows } =
    useReportDataset(picker, filter.accountId);
  const { formatCurrency } = useCurrencyDecimal();
  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [basis, setBasis] = useState<ComparisonBasis>(() =>
    localStorage.getItem(BASIS_KEY) === 'same-period-last-year' ? 'same-period-last-year' : 'previous-period'
  );
  const handleBasis = (next: ComparisonBasis): void => {
    setBasis(next);
    localStorage.setItem(BASIS_KEY, next);
  };

  const ranges = useMemo(() => resolveComparisonRanges(picker.range, basis), [picker.range, basis]);

  // BOTH windows are measured from the resolved bounds, so the two figures
  // are always like for like.
  const currentFlows = useMemo(
    () => (ranges ? computeIncomeExpense(accountTransactions, transactionSplits, categories, ranges.current) : null),
    [ranges, accountTransactions, transactionSplits, categories]
  );
  const previousFlows = useMemo(
    () => (ranges ? computeIncomeExpense(accountTransactions, transactionSplits, categories, ranges.previous) : null),
    [ranges, accountTransactions, transactionSplits, categories]
  );

  const comparison = useMemo(
    () => (currentFlows && previousFlows ? buildPeriodComparison(currentFlows, previousFlows, categories) : null),
    [currentFlows, previousFlows, categories]
  );

  const chartData = useMemo(
    () => (comparison ? comparison.categories.slice(0, 10).map(row => ({
      // `categoryId`, never `key`: recharts spreads datum fields onto React
      // elements and a `key` field collides with React's reserved prop.
      categoryId: row.categoryId,
      name: row.name,
      current: row.current,
      previous: row.previous,
    })) : []),
    [comparison]
  );

  const drillIntoCategory = (row: ComparisonCategoryRow, window: 'current' | 'previous'): void => {
    const source = window === 'current' ? currentFlows : previousFlows;
    if (!source || !ranges) return;
    const sideRows = row.bucket === 'income' ? source.incomeRows : source.expenseRows;
    setDrill({
      title: `${row.name} — ${formatWindow(window === 'current' ? ranges.current : ranges.previous)}`,
      bucket: row.bucket,
      rows: sideRows.filter(t => t.category === row.categoryId),
      total: window === 'current' ? row.current : row.previous,
    });
  };

  const drillIntoSide = (bucket: 'income' | 'expense', window: 'current' | 'previous', total: number): void => {
    const source = window === 'current' ? currentFlows : previousFlows;
    if (!source || !ranges) return;
    setDrill({
      title: `${bucket === 'income' ? 'Income' : 'Expenses'} — ${formatWindow(window === 'current' ? ranges.current : ranges.previous)}`,
      bucket,
      rows: bucket === 'income' ? source.incomeRows : source.expenseRows,
      total,
    });
  };

  const money = (value: number): string =>
    value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value);

  const percent = (figure: ComparisonFigure): string =>
    figure.changePercent === null
      ? figure.current === 0 ? '—' : 'new'
      : `${figure.changePercent > 0 ? '+' : ''}${formatDecimal(figure.changePercent, 1)}%`;

  /** Green when the move is the good one: more income, or less spending. */
  const moveClass = (change: number, goodWhen: 'up' | 'down'): string => {
    if (change === 0) return 'text-gray-500 dark:text-gray-400';
    const good = goodWhen === 'up' ? change > 0 : change < 0;
    return good ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const summaryCard = (
    label: string,
    figure: ComparisonFigure,
    goodWhen: 'up' | 'down',
    bucket: 'income' | 'expense' | null
  ): React.JSX.Element => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
      {bucket === null ? (
        <p className={`text-2xl font-bold mt-1 ${figure.current < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
          {money(figure.current)}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => drillIntoSide(bucket, 'current', figure.current)}
          className={`text-2xl font-bold mt-1 rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            bucket === 'income' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
          title={`${label} — view these transactions`}
        >
          {money(figure.current)}
        </button>
      )}
      <p className="text-sm mt-2">
        <span className={`font-semibold tabular-nums ${moveClass(figure.change, goodWhen)}`}>
          {figure.change > 0 ? '+' : ''}{money(figure.change)}
        </span>
        <span className="text-gray-400 dark:text-gray-500"> · {percent(figure)}</span>
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {bucket === null ? (
          <>was {money(figure.previous)}</>
        ) : (
          <button
            type="button"
            onClick={() => drillIntoSide(bucket, 'previous', figure.previous)}
            className="rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="View the comparison period's transactions"
          >
            was {money(figure.previous)}
          </button>
        )}
      </p>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ReportAccountFilter accounts={accounts} filter={filter} />
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            {(Object.keys(COMPARISON_BASIS_LABELS) as ComparisonBasis[]).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => handleBasis(value)}
                aria-pressed={basis === value}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  basis === value
                    ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {COMPARISON_BASIS_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
        <ReportExportBar
          title="Period comparison"
          dateRange={PERIOD_LABELS[picker.period]}
          rows={rows}
          flows={flows}
          categories={categories}
          accounts={accounts}
          charts={[chartRef]}
        />
      </div>

      {ranges === null || comparison === null ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-10 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            This report needs a period with a start date to compare against.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Choose any period other than All time — this month, last month, the tax year, twelve months, or a custom range.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">{formatWindow(ranges.current)}</span>
            {' compared with '}
            <span className="font-medium text-gray-700 dark:text-gray-300">{formatWindow(ranges.previous)}</span>
          </p>

          <UncategorisedReviewBand flows={flows} categories={categories} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summaryCard('Income', comparison.income, 'up', 'income')}
            {summaryCard('Expenses', comparison.expenses, 'down', 'expense')}
            {summaryCard('Left over', comparison.net, 'up', null)}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-theme-heading dark:text-white mb-1">
              Biggest movers
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              The categories that changed most between the two periods.
            </p>
            {chartData.length === 0 ? (
              <p className="text-center py-16 text-gray-400">Nothing categorised in either period</p>
            ) : (
              <div className="h-96" ref={chartRef}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.2)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      tickFormatter={(value: number) => formatDecimal(value, 0)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={170}
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      interval={0}
                    />
                    <Tooltip
                      formatter={(value: number | string) =>
                        formatCurrency(typeof value === 'number' ? value : Number(value))
                      }
                      contentStyle={{ borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="current" name="This period" fill="#3B82F6" radius={[0, 3, 3, 0]} isAnimationActive={false} />
                    <Bar dataKey="previous" name={COMPARISON_BASIS_LABELS[basis]} fill="#94A3B8" radius={[0, 3, 3, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="p-6 pb-3">
              <h2 className="text-lg font-semibold text-theme-heading dark:text-white">Category by category</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Click either figure to see the transactions behind it.
              </p>
            </div>
            {comparison.categories.length === 0 ? (
              <p className="text-center py-16 text-gray-400">Nothing categorised in either period</p>
            ) : (
              /* The table scrolls inside its own box; the page never scrolls sideways. */
              <div className="overflow-x-auto rounded-b-2xl">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">Each category in both periods, with the change between them</caption>
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th scope="col" className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[220px]">
                        Category
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        This period
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[130px]">
                        {COMPARISON_BASIS_LABELS[basis]}
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Change
                      </th>
                      <th scope="col" className="px-6 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.categories.map(row => (
                      <tr key={row.categoryId} className="border-t border-gray-50 dark:border-gray-700/50">
                        <th scope="row" className="px-6 py-2 text-left font-normal">
                          <span className="text-sm text-gray-900 dark:text-white">{row.name}</span>
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                            {row.bucket === 'income' ? 'income' : 'expense'}
                          </span>
                        </th>
                        <td className="px-3 py-2 text-sm text-right">
                          <button
                            type="button"
                            onClick={() => drillIntoCategory(row, 'current')}
                            className="w-full text-right rounded px-1 -mx-1 tabular-nums text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            title={`${row.name}, this period — view these transactions`}
                          >
                            {money(row.current)}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm text-right">
                          <button
                            type="button"
                            onClick={() => drillIntoCategory(row, 'previous')}
                            className="w-full text-right rounded px-1 -mx-1 tabular-nums text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            title={`${row.name}, comparison period — view these transactions`}
                          >
                            {money(row.previous)}
                          </button>
                        </td>
                        <td className={`px-3 py-2 text-sm text-right font-medium tabular-nums ${
                          moveClass(row.change, row.bucket === 'income' ? 'up' : 'down')
                        }`}>
                          {row.change > 0 ? '+' : ''}{money(row.change)}
                        </td>
                        <td className="px-6 py-2 text-sm text-right tabular-nums text-gray-500 dark:text-gray-400">
                          {percent(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />
    </div>
  );
}
