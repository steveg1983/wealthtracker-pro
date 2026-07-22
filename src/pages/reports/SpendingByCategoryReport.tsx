import React, { useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { useReportDataset } from '../../hooks/useReportDataset';
import { useReportAccountFilter } from '../../hooks/useReportAccountFilter';
import ReportAccountFilter from '../../components/reports/ReportAccountFilter';
import ReportDrillModal, { type ReportDrillTarget } from '../../components/reports/ReportDrillModal';
import ReportExportBar from '../../components/reports/ReportExportBar';
import UncategorisedReviewBand from '../../components/reports/UncategorisedReviewBand';
import { computeExpenseCategoryNetTotals } from '../../utils/categoryNetting';
import { toDecimal } from '../../utils/decimal';
import { formatDecimal } from '../../utils/decimal-format';
import { PERIOD_LABELS } from '../../hooks/usePeriod';
import type { ReportViewProps } from './types';

/**
 * "Spending by category" — where the money went, ranked.
 *
 * Money's netting semantics throughout (utils/categoryNetting): a row belongs
 * to a category's spend because of the CATEGORY's direction, never the
 * money's, so a refund filed against an expense category reduces that
 * category instead of appearing as income. Every slice and every row clicks
 * through to the transactions behind it.
 */

const CATEGORY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6',
];

/** Slices beyond this become hard to tell apart; the table still lists all. */
const PIE_SLICES = 8;

export default function SpendingByCategoryReport({ picker }: ReportViewProps): React.JSX.Element {
  const filter = useReportAccountFilter();
  const { accounts, categories, rows, flows } = useReportDataset(picker, filter.accountId);
  const { formatCurrency } = useCurrencyDecimal();
  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Shared implementation — the same totals the Dashboard widget and the PDF
  // export use, so the three can never drift.
  const totals = useMemo(
    () => computeExpenseCategoryNetTotals(rows, categories),
    [rows, categories]
  );

  const counts = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const row of flows.expenseRows) {
      byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + 1);
    }
    return byCategory;
  }, [flows.expenseRows]);

  const listedTotal = useMemo(
    () => totals.reduce((sum, entry) => sum.plus(toDecimal(entry.value)), toDecimal(0)),
    [totals]
  );

  // The datum field is `categoryId`, NOT `key`: recharts spreads datum fields
  // onto React elements and a `key` field collides with React's reserved prop,
  // silently breaking sector rendering.
  const pieData = useMemo(
    () => totals.slice(0, PIE_SLICES).map(({ key, name, value }) => ({ categoryId: key, name, value })),
    [totals]
  );

  const drillIntoCategory = (categoryId: string, name: string, value: number): void => {
    setDrill({
      title: `${name} — ${PERIOD_LABELS[picker.period]}`,
      bucket: 'expense',
      rows: flows.expenseRows.filter(t => t.category === categoryId),
      total: value,
    });
  };

  const shareOf = (value: number): string =>
    listedTotal.isZero() ? '—' : `${formatDecimal(toDecimal(value).dividedBy(listedTotal).times(100), 1)}%`;

  // Categories whose refunds cancelled their spending net to zero or less and
  // cannot be listed — say so rather than let the reader assume the rows add
  // up to the period's total.
  const netted = flows.expenses.greaterThan(0) && !listedTotal.equals(flows.expenses);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportAccountFilter accounts={accounts} filter={filter} />
        <ReportExportBar
          title="Spending by category"
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
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">
            Where the money went
          </h2>
          <span className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
            {formatCurrency(flows.expenses)}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {PERIOD_LABELS[picker.period]} — click a slice for the transactions behind it.
        </p>
        {pieData.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No categorised spending in this period</p>
        ) : (
          <div className="h-80" ref={chartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  strokeWidth={0}
                  isAnimationActive={false}
                  cursor="pointer"
                  onClick={(entry) => {
                    const datum = ((entry as { payload?: typeof pieData[number] })?.payload ?? entry) as typeof pieData[number];
                    if (datum?.categoryId) drillIntoCategory(datum.categoryId, datum.name, datum.value);
                  }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.categoryId} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | string) =>
                    formatCurrency(typeof value === 'number' ? value : Number(value))
                  }
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">Every category</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ranked by spend. Click any category to see its transactions.
          </p>
        </div>
        {totals.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No categorised spending in this period</p>
        ) : (
          /* The table scrolls inside its own box; the page never scrolls sideways. */
          <div className="overflow-x-auto rounded-b-2xl">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Spending by category for the selected period</caption>
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th scope="col" className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[220px]">
                    Category
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Transactions
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Share
                  </th>
                  <th scope="col" className="px-6 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Spent
                  </th>
                </tr>
              </thead>
              <tbody>
                {totals.map(entry => (
                  <tr key={entry.key} className="border-t border-gray-50 dark:border-gray-700/50">
                    <th scope="row" className="px-6 py-2 text-left font-normal">
                      <button
                        type="button"
                        onClick={() => drillIntoCategory(entry.key, entry.name, entry.value)}
                        className="text-sm text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        title={`${entry.name} — view these transactions`}
                      >
                        {entry.name}
                      </button>
                    </th>
                    <td className="px-3 py-2 text-sm text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {(counts.get(entry.key) ?? 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {shareOf(entry.value)}
                    </td>
                    <td className="px-6 py-2 text-sm text-right font-semibold tabular-nums text-gray-900 dark:text-white">
                      {formatCurrency(entry.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <th scope="row" className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Total listed
                  </th>
                  <td />
                  <td />
                  <td className="px-6 py-3 text-sm text-right font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatCurrency(listedTotal.toNumber())}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {netted && (
          <p className="px-6 pb-6 pt-3 text-xs text-gray-500 dark:text-gray-400">
            Total spending for the period is {formatCurrency(flows.expenses)}. The difference is categories whose
            refunds cancelled their spending — they net to zero or less, so they are not listed above.
          </p>
        )}
      </div>

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />
    </div>
  );
}
