import React, { useState } from 'react';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { CalendarIcon } from './icons';
import type { MatrixGroup, MonthlyCategoryMatrix } from '../utils/monthlyCategoryMatrix';

/**
 * "Monthly income and expenses" — the Microsoft Money report: every category
 * down the side, the months of the selected period across the top, group
 * subtotals, and Total Income / Total Expenses / Income less Expenses in the
 * footer.
 *
 * Unlike Money's version this follows the page's shared period picker rather
 * than demanding custom dates, and every figure is a drill-in: clicking a
 * cell opens the transactions behind it.
 *
 * The table scrolls inside its own box (both axes) with a sticky heading row
 * and a sticky category column, so the page itself never scrolls sideways.
 */

export interface MatrixDrillTarget {
  bucket: 'income' | 'expense';
  /** Categories behind the figure; null = the whole side. */
  categoryIds: string[] | null;
  /** YYYY-MM, or null for the whole-period Total column. */
  monthKey: string | null;
  label: string;
  total: number;
}

interface Props {
  matrix: MonthlyCategoryMatrix;
  onDrill: (target: MatrixDrillTarget) => void;
}

const DETAIL_KEY = 'reportsMatrixSubcategories';

const CELL = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap border-b border-gray-100 dark:border-gray-700';
const LABEL_CELL = 'sticky left-0 z-10 px-3 py-1.5 text-left whitespace-nowrap border-b border-r border-gray-100 dark:border-gray-700';
const HEAD_CELL = 'sticky top-0 bg-gray-100 dark:bg-gray-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600';

interface RowSpec {
  key: string;
  label: string;
  indent?: boolean;
  values: number[];
  total: number;
  bgClass: string;
  textClass: string;
  /** Colour each figure by its own sign (the net row). */
  signColour?: boolean;
  /** Absent for rows that mix both sides — there is nothing single to drill. */
  drill?: (monthKey: string | null, value: number) => void;
}

export default function MonthlyIncomeExpenseMatrix({ matrix, onDrill }: Props): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  // Group subtotals only, or every category beneath them — persisted like the
  // page's other view preferences. Groups-only keeps a deep tree readable.
  const [showDetail, setShowDetail] = useState<boolean>(
    () => localStorage.getItem(DETAIL_KEY) !== '0'
  );
  const toggleDetail = (): void => {
    setShowDetail(prev => {
      localStorage.setItem(DETAIL_KEY, prev ? '0' : '1');
      return !prev;
    });
  };

  const { months } = matrix;
  // A Total column that repeats the single month it sums is just noise, so it
  // only earns its place once there is more than one period to add up.
  const showTotal = months.length > 1;

  const money = (value: number): string =>
    value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value);

  const labelOfMonth = (monthKey: string | null): string =>
    monthKey === null
      ? 'whole period'
      : months.find(m => m.key === monthKey)?.label ?? monthKey;

  const sideRowSpecs = (bucket: 'income' | 'expense', groups: MatrixGroup[]): RowSpec[] => {
    const specs: RowSpec[] = [];
    for (const group of groups) {
      specs.push({
        key: `${bucket}-group-${group.groupId}`,
        label: group.name,
        values: group.values,
        total: group.total,
        bgClass: 'bg-gray-50 dark:bg-gray-700',
        textClass: 'font-semibold text-gray-900 dark:text-white',
        drill: (monthKey, value) => onDrill({
          bucket,
          categoryIds: group.categoryIds,
          monthKey,
          label: `${group.name} — ${labelOfMonth(monthKey)}`,
          total: value,
        }),
      });
      if (!showDetail) continue;
      // A group that only ever carries its own postings needs no repeat row.
      if (group.rows.length === 1 && group.rows[0].categoryId === group.groupId) continue;
      for (const row of group.rows) {
        specs.push({
          key: `${bucket}-row-${row.categoryId}`,
          label: row.name,
          indent: true,
          values: row.values,
          total: row.total,
          bgClass: 'bg-white dark:bg-gray-800',
          textClass: 'text-gray-700 dark:text-gray-300',
          drill: (monthKey, value) => onDrill({
            bucket,
            categoryIds: [row.categoryId],
            monthKey,
            label: `${group.name} : ${row.name} — ${labelOfMonth(monthKey)}`,
            total: value,
          }),
        });
      }
    }
    return specs;
  };

  const totalRowSpec = (
    key: string,
    label: string,
    values: number[],
    total: number,
    textClass: string,
    extras: Pick<RowSpec, 'drill' | 'signColour'> = {}
  ): RowSpec => ({
    key,
    label,
    values,
    total,
    bgClass: 'bg-gray-100 dark:bg-gray-900',
    textClass: `font-bold ${textClass}`,
    ...extras,
  });

  const renderRow = (row: RowSpec): React.JSX.Element => {
    const valueClass = (value: number): string => {
      if (!row.signColour) return row.textClass;
      return `${row.textClass} ${value < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`;
    };

    const figure = (value: number, monthKey: string | null): React.JSX.Element => {
      if (value === 0) {
        return <span className="text-gray-300 dark:text-gray-600">&mdash;</span>;
      }
      if (!row.drill) return <>{money(value)}</>;
      const drill = row.drill;
      return (
        <button
          type="button"
          onClick={() => drill(monthKey, value)}
          className="w-full text-right rounded px-1 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title={`${row.label} · ${labelOfMonth(monthKey)} — view these transactions`}
        >
          {money(value)}
        </button>
      );
    };

    return (
      <tr key={row.key} className={row.bgClass}>
        <th
          scope="row"
          className={`${LABEL_CELL} ${row.bgClass} ${row.textClass} ${row.indent ? 'pl-8 font-normal' : ''}`}
        >
          {row.label}
        </th>
        {row.values.map((value, index) => (
          <td key={months[index].key} className={`${CELL} ${valueClass(value)}`}>
            {figure(value, months[index].key)}
          </td>
        ))}
        {showTotal && (
          <td className={`${CELL} ${valueClass(row.total)} border-l border-gray-200 dark:border-gray-600`}>
            {figure(row.total, null)}
          </td>
        )}
      </tr>
    );
  };

  const sectionRow = (label: string): React.JSX.Element => (
    <tr className="bg-[#1a2332] dark:bg-gray-900">
      <th
        scope="colgroup"
        colSpan={months.length + (showTotal ? 2 : 1)}
        className="sticky left-0 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-white"
      >
        {label}
      </th>
    </tr>
  );

  const hasData = months.length > 0
    && (matrix.incomeGroups.length > 0 || matrix.expenseGroups.length > 0);

  return (
    <div className="min-w-0 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
      <div className="flex flex-wrap items-start justify-between gap-2 p-6 pb-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-theme-heading dark:text-white">
            <CalendarIcon size={20} className="text-gray-500" />
            Monthly Income and Expenses
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Every category by month for the selected period. Click any figure to see the transactions behind it.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleDetail}
          aria-pressed={showDetail}
          title={showDetail ? 'Show group subtotals only' : 'Show every category under each group'}
          className={`px-3 py-1 text-sm font-medium rounded-lg border transition-colors ${
            showDetail
              ? 'border-[#1a2332] dark:border-blue-500 bg-[#1a2332] dark:bg-blue-600 text-white'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Subcategories
        </button>
      </div>

      {matrix.omittedMonths > 0 && (
        <p className="px-6 pb-3 text-xs text-amber-700 dark:text-amber-400">
          This period spans {matrix.omittedMonths + months.length} months — the most recent {months.length} are shown
          as columns, and the Total column still covers all of it. Choose a shorter period to see the earlier months.
        </p>
      )}

      {!hasData ? (
        <p className="text-center py-16 text-gray-400">No categorised transactions in this period</p>
      ) : (
        <div className="overflow-auto max-h-[70vh] rounded-b-2xl">
          <table className="min-w-max text-sm border-separate border-spacing-0">
            <caption className="sr-only">
              Income and expenses by category and month for the selected period
            </caption>
            <thead>
              <tr>
                <th scope="col" className={`${HEAD_CELL} left-0 z-30 text-left border-r min-w-[220px]`}>
                  Category
                </th>
                {months.map(month => (
                  <th key={month.key} scope="col" className={`${HEAD_CELL} z-20 text-right min-w-[96px]`}>
                    {month.label}
                  </th>
                ))}
                {showTotal && (
                  <th scope="col" className={`${HEAD_CELL} z-20 text-right border-l min-w-[110px]`}>
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sectionRow('Income')}
              {sideRowSpecs('income', matrix.incomeGroups).map(renderRow)}
              {renderRow(totalRowSpec(
                'total-income',
                'Total Income',
                matrix.incomeValues,
                matrix.incomeTotal,
                'text-green-700 dark:text-green-400',
                {
                  drill: (monthKey, value) => onDrill({
                    bucket: 'income',
                    categoryIds: null,
                    monthKey,
                    label: `Income — ${labelOfMonth(monthKey)}`,
                    total: value,
                  }),
                }
              ))}
              {sectionRow('Expenses')}
              {sideRowSpecs('expense', matrix.expenseGroups).map(renderRow)}
              {renderRow(totalRowSpec(
                'total-expenses',
                'Total Expenses',
                matrix.expenseValues,
                matrix.expenseTotal,
                'text-red-600 dark:text-red-400',
                {
                  drill: (monthKey, value) => onDrill({
                    bucket: 'expense',
                    categoryIds: null,
                    monthKey,
                    label: `Expenses — ${labelOfMonth(monthKey)}`,
                    total: value,
                  }),
                }
              ))}
              {renderRow(totalRowSpec(
                'net',
                'Income less Expenses',
                matrix.netValues,
                matrix.netTotal,
                'text-gray-900 dark:text-white',
                { signColour: true }
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
