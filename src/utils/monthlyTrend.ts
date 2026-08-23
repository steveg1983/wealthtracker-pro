import type { Category, Transaction } from '../types';
import { toDecimal, type DecimalInstance } from './decimal';
import { bucketByCategoryDirection } from './categoryNetting';
import type { FlowFactorResolver } from './incomeExpense';
import { getDateLocale } from '../utils/dateFormatter';

export interface MonthlyTrendPoint {
  /** Raw YYYY-MM — drives click-to-drill filters. */
  monthKey: string;
  /** Display label, e.g. "Jul 2026". */
  month: string;
  income: number;
  expenses: number;
}

/**
 * Month-by-month income/expenses under the app's category semantics (shared
 * classifier; transfers and uncategorised rows never count). Used by the
 * Reports trend chart and the Dashboard's pinned trend widget — one
 * implementation so the two can never disagree.
 *
 * `rows` must already be split-expanded (each split line lands in ITS
 * category's month).
 */
export function buildMonthlyTrend(
  rows: Transaction[],
  categories: Category[],
  /** The flows seam: per-row factor into the display currency (see incomeExpense). */
  convert?: FlowFactorResolver
): MonthlyTrendPoint[] {
  const monthlyData: Record<string, { income: DecimalInstance; expenses: DecimalInstance }> = {};
  const categoryById = new Map(categories.map(c => [c.id, c]));

  rows.forEach(t => {
    const bucket = bucketByCategoryDirection(t, categoryById);
    if (bucket !== 'income' && bucket !== 'expense') return;
    const monthKey = new Date(t.date).toISOString().slice(0, 7);
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: toDecimal(0), expenses: toDecimal(0) };
    }

    const factor = convert?.(t) ?? null;
    const amount = factor !== null ? toDecimal(t.amount).times(factor) : toDecimal(t.amount);
    if (bucket === 'income') {
      monthlyData[monthKey].income = monthlyData[monthKey].income.plus(amount);
    } else {
      // Spending is negative; negate so refunds net the month down.
      monthlyData[monthKey].expenses = monthlyData[monthKey].expenses.minus(amount);
    }
  });

  return Object.keys(monthlyData).sort().map(month => ({
    monthKey: month,
    month: new Date(month + '-01').toLocaleDateString(getDateLocale(), { month: 'short', year: 'numeric' }),
    income: monthlyData[month].income.toNumber(),
    expenses: monthlyData[month].expenses.toNumber(),
  }));
}
