/**
 * ONE evaluation of a budget — allowance, spend, window, and the rows behind
 * the figure — for every surface that quotes one.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * utils/budgetSpending already made the SUM one calculation. What was still
 * done twice was everything around the sum: which category a budget means
 * (a budget saved by the old picker carries a category NAME where the id
 * belongs), whether a group budget rolls its children up, what the allowance
 * is once a rollover is carried in, and above all WHICH WINDOW the budget is
 * measured over. The Budget page did all of that; the Dashboard's Budget
 * Status card did none of it — it summed the budget's own category over a
 * rolling thirty days against the base amount, so the same budget read one
 * figure on the Dashboard and another on the Budget page, and the Dashboard's
 * could not say what period it was for because it was not any period a
 * budget has (the owner, 15 Oct 2026: "I cannot easily see what period that
 * is for").
 *
 * So the whole evaluation is here, once. Both surfaces call it with the same
 * inputs and show the same numbers under the same caption, and the Dashboard
 * can open the rows behind a figure because this returns them.
 *
 * ── WHAT COMES BACK ─────────────────────────────────────────────────────────
 * Decimal throughout — callers convert at the edge, as the Budget page always
 * did. `remaining` is SIGNED: an overspent budget reads "over by £155", not
 * "£0 remaining" (see calculateBudgetRemaining for the floored figure and who
 * it is for). `countedRowIds` names the expanded rows the sum was taken over
 * — split lines by their synthetic id — so a drill shows exactly what was
 * counted and nothing a second filter might have chosen differently.
 */

import type { Budget, Category, Transaction, TransactionSplit } from '../types';
import type { DecimalInstance } from './decimal';
import { getEffectiveBudgetAmount } from './budgetAmounts';
import { calculateBudgetPercentage } from './calculations-decimal';
import type { BudgetPeriodWindow } from './budgetPeriods';
import {
  buildCategoryChildIndex,
  calculateBudgetSpend,
  collectBudgetCategoryIds,
  prepareBudgetTransactions,
} from './budgetSpending';

/** Enough of a category to resolve a budget's target and walk its children. */
export type BudgetCategoryRef = Pick<Category, 'id' | 'name' | 'parentId'>;

/**
 * The category a budget means, by id.
 *
 * Legacy healing on the SPEND path, not just in the modal: budgets saved by the
 * old picker carry a category NAME where the id belongs (some under a legacy
 * `category` field), and matched nothing until each was opened and re-saved. A
 * name that resolves to a current category is read as that category; anything
 * else is left as stored, so an unknown id still matches nothing rather than
 * something else.
 */
export function buildBudgetCategoryResolver(
  categories: readonly BudgetCategoryRef[]
): (budget: Pick<Budget, 'categoryId'>) => string {
  const ids = new Set<string>();
  const idByName = new Map<string, string>();
  for (const category of categories) {
    if (!category?.id) continue;
    ids.add(category.id);
    if (category.name) idByName.set(category.name, category.id);
  }
  return (budget) => {
    if (budget.categoryId && ids.has(budget.categoryId)) return budget.categoryId;
    const legacy = (budget as Pick<Budget, 'categoryId'> & { category?: string }).category ?? budget.categoryId;
    return (legacy && idByName.get(legacy)) || budget.categoryId;
  };
}

export interface EvaluatedBudget<B extends Budget = Budget> {
  /** The budget as stored. */
  budget: B;
  /** The category the budget means — healed, see buildBudgetCategoryResolver. */
  categoryId: string;
  /** The allowance for the window: the amount plus any rollover carried in. */
  effectiveAmount: DecimalInstance;
  /** Net spend in the window — positive magnitude, refunds deducted. */
  spent: DecimalInstance;
  /** Allowance less spend, SIGNED: negative is how far over. */
  remaining: DecimalInstance;
  /** Spend as a percentage of the allowance; 0 for a zero allowance. */
  percentage: number;
  /** The period the budget is being measured over right now. */
  window: BudgetPeriodWindow;
  /** The expanded rows the spend was summed from, by id — what a drill shows. */
  countedRowIds: ReadonlySet<string>;
  /** In-window rows left out because their account is in another currency. */
  excludedForeignCount: number;
}

export interface EvaluateBudgetsInput {
  transactions: Transaction[];
  transactionSplits?: TransactionSplit[];
  categories: readonly BudgetCategoryRef[];
  /** Accounts held in another currency — see foreignCurrencyAccountIds. */
  foreignAccountIds?: ReadonlySet<string>;
  /** One evaluation instant for the whole set. Defaults to now. */
  now?: Date;
}

/**
 * Evaluate every budget given, in the order given, as at one instant.
 *
 * Splits are expanded and amounts decimalised ONCE for the whole set; a group
 * budget counts every category beneath its own; a detail budget keeps the
 * plain equality match it always had (a single-id set is the same thing).
 */
export function evaluateBudgets<B extends Budget>(
  budgets: readonly B[],
  input: EvaluateBudgetsInput
): EvaluatedBudget<B>[] {
  const prepared = prepareBudgetTransactions(input.transactions, input.transactionSplits ?? []);
  const childIndex = buildCategoryChildIndex(input.categories);
  const resolveCategoryId = buildBudgetCategoryResolver(input.categories);
  const now = input.now ?? new Date();

  return budgets.map(budget => {
    const categoryId = resolveCategoryId(budget);
    const categoryIds = collectBudgetCategoryIds(categoryId, childIndex);
    const { spent, window, counted, excludedForeignCount } = calculateBudgetSpend(
      { ...budget, categoryId },
      prepared,
      {
        now,
        categoryIds: categoryIds.size > 1 ? categoryIds : undefined,
        foreignAccountIds: input.foreignAccountIds,
      }
    );
    const effectiveAmount = getEffectiveBudgetAmount(budget);

    return {
      budget,
      categoryId,
      effectiveAmount,
      spent,
      remaining: effectiveAmount.minus(spent),
      percentage: calculateBudgetPercentage({ amount: effectiveAmount }, spent),
      window,
      countedRowIds: new Set(counted.map(row => row.id)),
      excludedForeignCount,
    };
  });
}
