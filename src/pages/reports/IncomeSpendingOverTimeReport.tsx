import React, { useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { useReportDataset } from '../../hooks/useReportDataset';
import { useReportAccountFilter } from '../../hooks/useReportAccountFilter';
import ReportAccountFilter from '../../components/reports/ReportAccountFilter';
import ReportDrillModal, { type ReportDrillTarget } from '../../components/reports/ReportDrillModal';
import ReportExportBar from '../../components/reports/ReportExportBar';
import UncategorisedReviewBand from '../../components/reports/UncategorisedReviewBand';
import { buildMonthlyTrend } from '../../utils/monthlyTrend';
import { toDecimal } from '../../utils/decimal';
import { formatDecimal } from '../../utils/decimal-format';
import { PERIOD_LABELS } from '../../hooks/usePeriod';
import type { ReportViewProps } from './types';
import type { SplitExpandedTransaction } from '../../utils/transactionSplits';

/**
 * "Income and spending over time" — month by month, what came in against what
 * went out, and what was left.
 *
 * The series comes from the shared builder (utils/monthlyTrend), which is the
 * same one behind the Dashboard's pinned trend widget — the glance and the
 * full report cannot disagree. Points on the chart and figures in the table
 * both open the transactions behind them.
 */

const compactTick = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${formatDecimal(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${sign}${formatDecimal(abs / 1_000, 0)}K`;
  return formatDecimal(value, 0);
};

export default function IncomeSpendingOverTimeReport({ picker }: ReportViewProps): React.JSX.Element {
  const filter = useReportAccountFilter();
  const { accounts, categories, rows, flows } = useReportDataset(picker, filter.accountId);
  const { formatCurrency } = useCurrencyDecimal();
  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  // Lines or bars — same data, same drill-in; the choice is persisted.
  const [chartType, setChartType] = useState<'line' | 'bar'>(() =>
    localStorage.getItem('reportsTrendChartType') === 'bar' ? 'bar' : 'line'
  );
  const handleChartType = (type: 'line' | 'bar'): void => {
    setChartType(type);
    localStorage.setItem('reportsTrendChartType', type);
  };

  const trend = useMemo(() => buildMonthlyTrend(rows, categories), [rows, categories]);

  const totals = useMemo(() => {
    const income = trend.reduce((sum, point) => sum.plus(toDecimal(point.income)), toDecimal(0));
    const expenses = trend.reduce((sum, point) => sum.plus(toDecimal(point.expenses)), toDecimal(0));
    return { income: income.toNumber(), expenses: expenses.toNumber(), net: income.minus(expenses).toNumber() };
  }, [trend]);

  const netOf = (point: { income: number; expenses: number }): number =>
    toDecimal(point.income).minus(toDecimal(point.expenses)).toNumber();

  const rowsOfMonth = (source: SplitExpandedTransaction[], monthKey: string): SplitExpandedTransaction[] =>
    source.filter(t => new Date(t.date).toISOString().slice(0, 7) === monthKey);

  const drillIntoMonth = (
    monthKey: string,
    label: string,
    bucket: 'income' | 'expense',
    total: number
  ): void => {
    setDrill({
      title: `${bucket === 'income' ? 'Income' : 'Expenses'} — ${label}`,
      bucket,
      rows: rowsOfMonth(bucket === 'income' ? flows.incomeRows : flows.expenseRows, monthKey),
      total,
    });
  };

  // recharts calls activeDot onClick with (props, event) — but the argument
  // order has differed across versions, so scan for whichever carries the
  // datum payload.
  const handlePointClick = (series: 'income' | 'expenses') =>
    (...args: unknown[]): void => {
      for (const arg of args) {
        const payload = (arg as { payload?: { monthKey?: string; month?: string; income?: number; expenses?: number } } | null)?.payload;
        if (payload?.monthKey && payload.month) {
          drillIntoMonth(
            payload.monthKey,
            payload.month,
            series === 'income' ? 'income' : 'expense',
            payload[series] ?? 0
          );
          return;
        }
      }
    };

  const figureButton = (
    label: string,
    value: number,
    onClick: () => void,
    colour: string
  ): React.JSX.Element => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-right rounded px-1 -mx-1 tabular-nums hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${colour}`}
      title={`${label} — view these transactions`}
    >
      {formatCurrency(value)}
    </button>
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportAccountFilter accounts={accounts} filter={filter} />
        <ReportExportBar
          title="Income and spending over time"
          dateRange={PERIOD_LABELS[picker.period]}
          rows={rows}
          flows={flows}
          categories={categories}
          accounts={accounts}
          charts={[chartRef]}
        />
      </div>

      <UncategorisedReviewBand flows={flows} categories={categories} />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">
            Income against spending
          </h2>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            {(['line', 'bar'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => handleChartType(type)}
                aria-pressed={chartType === type}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  chartType === type
                    ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {type === 'line' ? 'Line' : 'Bar'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {PERIOD_LABELS[picker.period]} — click a point, or any figure in the table, for the transactions behind it.
        </p>
        {trend.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No categorised transactions in this period</p>
        ) : (
          <div className="h-80" ref={chartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.2)" />
                <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 12 }} minTickGap={24} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={compactTick} width={70} />
                <Tooltip
                  formatter={(value: number | string) =>
                    formatCurrency(typeof value === 'number' ? value : Number(value))
                  }
                  contentStyle={{ borderRadius: '8px' }}
                />
                <Legend />
                {chartType === 'bar' ? (
                  <Bar dataKey="income" name="Income" fill="#10B981" radius={[3, 3, 0, 0]} cursor="pointer" isAnimationActive={false} onClick={handlePointClick('income')} />
                ) : (
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 6, cursor: 'pointer', onClick: handlePointClick('income') }}
                  />
                )}
                {chartType === 'bar' ? (
                  <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[3, 3, 0, 0]} cursor="pointer" isAnimationActive={false} onClick={handlePointClick('expenses')} />
                ) : (
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 6, cursor: 'pointer', onClick: handlePointClick('expenses') }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">Month by month</h2>
        </div>
        {trend.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No categorised transactions in this period</p>
        ) : (
          /* The table scrolls inside its own box; the page never scrolls sideways. */
          <div className="overflow-x-auto rounded-b-2xl">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Income, expenses and the balance for each month of the period</caption>
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th scope="col" className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[140px]">
                    Month
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Income
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Expenses
                  </th>
                  <th scope="col" className="px-6 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Left over
                  </th>
                </tr>
              </thead>
              <tbody>
                {trend.map(point => {
                  const net = netOf(point);
                  return (
                    <tr key={point.monthKey} className="border-t border-gray-50 dark:border-gray-700/50">
                      <th scope="row" className="px-6 py-2 text-left text-sm font-normal text-gray-900 dark:text-white">
                        {point.month}
                      </th>
                      <td className="px-3 py-2 text-sm text-right">
                        {figureButton(
                          `Income, ${point.month}`,
                          point.income,
                          () => drillIntoMonth(point.monthKey, point.month, 'income', point.income),
                          'text-green-700 dark:text-green-400'
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        {figureButton(
                          `Expenses, ${point.month}`,
                          point.expenses,
                          () => drillIntoMonth(point.monthKey, point.month, 'expense', point.expenses),
                          'text-red-600 dark:text-red-400'
                        )}
                      </td>
                      <td className={`px-6 py-2 text-sm text-right font-semibold tabular-nums ${
                        net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                      }`}>
                        {net < 0 ? `-${formatCurrency(Math.abs(net))}` : formatCurrency(net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <th scope="row" className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Total
                  </th>
                  <td className="px-3 py-3 text-sm text-right font-bold tabular-nums text-green-700 dark:text-green-400">
                    {formatCurrency(totals.income)}
                  </td>
                  <td className="px-3 py-3 text-sm text-right font-bold tabular-nums text-red-600 dark:text-red-400">
                    {formatCurrency(totals.expenses)}
                  </td>
                  <td className={`px-6 py-3 text-sm text-right font-bold tabular-nums ${
                    totals.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                  }`}>
                    {totals.net < 0 ? `-${formatCurrency(Math.abs(totals.net))}` : formatCurrency(totals.net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />
    </div>
  );
}
