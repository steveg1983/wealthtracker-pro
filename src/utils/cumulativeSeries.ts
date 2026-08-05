import { toDecimal } from './decimal';
import type { MonthlyTrendPoint } from './monthlyTrend';
import type { MatrixGroup, MatrixRow, MonthlyCategoryMatrix } from './monthlyCategoryMatrix';

/**
 * "Cumulative" — the running-total reading of a month-by-month report: every
 * period shows itself plus every period before it.
 *
 * Two rules hold everywhere the toggle appears, so no two reports can mean
 * different things by the same word:
 *
 *  - the running total starts at ZERO on the first column of the report and is
 *    never seeded from history outside it — "cumulative" is always cumulative
 *    WITHIN the selected period;
 *  - whole-period totals are left exactly as they were, because a total is
 *    already the sum of the lot (and on a capped window it covers months the
 *    columns do not show — see MonthlyCategoryMatrix.omittedMonths).
 *
 * The accumulation itself is Decimal throughout: a year of float additions
 * drifts, and these are people's figures.
 */

/** Running totals of a series, accumulated in Decimal. */
export function runningTotals(values: readonly number[]): number[] {
  let total = toDecimal(0);
  return values.map(value => {
    total = total.plus(toDecimal(value));
    return total.toNumber();
  });
}

const cumulativeRow = (row: MatrixRow): MatrixRow => ({
  ...row,
  values: runningTotals(row.values),
});

const cumulativeGroup = (group: MatrixGroup): MatrixGroup => ({
  ...group,
  values: runningTotals(group.values),
  rows: group.rows.map(cumulativeRow),
});

/**
 * The category × month matrix as running totals — every category row, every
 * group subtotal and all three footer rows.
 */
export function toCumulativeMatrix(matrix: MonthlyCategoryMatrix): MonthlyCategoryMatrix {
  return {
    ...matrix,
    incomeGroups: matrix.incomeGroups.map(cumulativeGroup),
    expenseGroups: matrix.expenseGroups.map(cumulativeGroup),
    incomeValues: runningTotals(matrix.incomeValues),
    expenseValues: runningTotals(matrix.expenseValues),
    netValues: runningTotals(matrix.netValues),
  };
}

/** The income/expenses time series as running totals, month labels untouched. */
export function toCumulativeTrend(points: readonly MonthlyTrendPoint[]): MonthlyTrendPoint[] {
  const income = runningTotals(points.map(point => point.income));
  const expenses = runningTotals(points.map(point => point.expenses));
  return points.map((point, index) => ({
    ...point,
    income: income[index],
    expenses: expenses[index],
  }));
}
