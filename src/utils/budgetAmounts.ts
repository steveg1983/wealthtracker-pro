import { toDecimal } from './decimal';
import type { DecimalInstance } from './decimal';

/**
 * The subset of a budget that decides how much may be spent in the current
 * period. Accepts both plain and decimalised budgets so the same helper works
 * either side of `toDecimalBudget`.
 */
export interface BudgetHeadroom {
  amount: number | string | DecimalInstance;
  rollover?: boolean;
  rolloverAmount?: number;
}

/**
 * A budget's spendable amount for the CURRENT period.
 *
 * `amount` is the recurring plan the user typed and must never be mutated by
 * automation — an earlier build folded each month's rollover straight into it,
 * so re-running "Apply Rollover" compounded the figure and there was no way to
 * tell the plan from the carry. The carry now lives in `rolloverAmount`
 * (already a column on `budgets`, mapped both ways in planningService) and is
 * added back here, which keeps the plan intact and the carry reversible.
 *
 * `rollover === false` means the user is not carrying anything forward, so any
 * stale `rolloverAmount` is ignored rather than silently spent.
 */
export function getEffectiveBudgetAmount(budget: BudgetHeadroom): DecimalInstance {
  const base = toDecimal(budget.amount);
  if (budget.rollover !== true) return base;
  return base.plus(toDecimal(budget.rolloverAmount ?? 0));
}

/** Sum of the carries currently funding the given budgets. */
export function sumBudgetCarry(budgets: BudgetHeadroom[]): DecimalInstance {
  return budgets.reduce(
    (sum, budget) => (budget.rollover === true ? sum.plus(toDecimal(budget.rolloverAmount ?? 0)) : sum),
    toDecimal(0)
  );
}
