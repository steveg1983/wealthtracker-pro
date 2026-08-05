/**
 * ONE budget-spending calculation, for every surface that quotes one.
 *
 * WHY this exists: the Budget card, the spending alerts and the budget
 * recommendations each summed spending themselves. The card expanded splits,
 * netted refunds and worked in Decimal; the other two summed raw floats over
 * expense rows only and never looked at splits — so a split Tesco row
 * contributed £0 to an alert while the card counted it, and the two screens
 * disagreed about the same budget on the same day.
 *
 * Everything here composes the pieces that already exist rather than adding a
 * second version of any of them:
 *   utils/transactionSplits  → split parents become their per-line rows
 *   utils/budgetPeriods      → which window the budget is being measured over
 *   utils/calculations-decimal → the netting/Decimal sum itself
 */

import type { Account, Transaction, TransactionSplit } from '../types';
import type { DecimalBudget } from '../types/decimal-types';
import { expandSplitTransactions } from './transactionSplits';
import { toDecimal } from './decimal';
import type { DecimalInstance } from './decimal';
import {
  calculateBudgetSpendingBreakdown,
  type DatedDecimalTransaction
} from './calculations-decimal';
import {
  getBudgetPeriodWindow,
  type BudgetPeriodSource,
  type BudgetPeriodWindow
} from './budgetPeriods';

/** What `calculateBudgetSpend` needs of a budget: its category and its period. */
export interface BudgetSpendable extends BudgetPeriodSource, Pick<DecimalBudget, 'categoryId'> {}

export interface BudgetSpendOptions {
  /** Evaluate the period as at this instant. Defaults to now. */
  now?: Date;
  /**
   * Category ids to count instead of the budget's own — a group budget's
   * category plus its descendants. See `collectBudgetCategoryIds`.
   */
  categoryIds?: ReadonlySet<string>;
  /**
   * Accounts held in another currency: their rows are excluded and counted so
   * the caller can say so. No FX conversion is attempted here.
   */
  foreignAccountIds?: ReadonlySet<string>;
}

export interface BudgetSpend {
  /** Net spend in the period — positive magnitude, refunds deducted. */
  spent: DecimalInstance;
  /** The window `spent` covers. */
  window: BudgetPeriodWindow;
  /** In-period rows left out because their account is in another currency. */
  excludedForeignCount: number;
}

/**
 * Expand splits and decimalise ONCE, for a whole page (or service pass) of
 * budgets. Doing this per budget would re-walk every transaction for every
 * budget on the screen.
 *
 * Split parents are REPLACED by their lines, so a £120 shop split £90 Food /
 * £30 Household spends against both budgets, exactly as Money files it.
 */
export function prepareBudgetTransactions(
  transactions: Transaction[],
  splits: TransactionSplit[] = []
): DatedDecimalTransaction[] {
  return expandSplitTransactions(transactions, splits).map(transaction => ({
    ...transaction,
    amount: toDecimal(transaction.amount)
  }));
}

/**
 * Accounts NOT held in the display currency.
 *
 * Budget spending is a single figure in one currency; a euro account's rows
 * cannot join a sterling total without a rate, and inventing one silently is
 * worse than leaving them out and saying so. An account with no currency
 * recorded is treated as being in the display currency — that is what the rest
 * of the app assumes of it.
 */
export function foreignCurrencyAccountIds(
  accounts: Account[],
  displayCurrency: string
): ReadonlySet<string> {
  const foreign = new Set<string>();
  for (const account of accounts) {
    if (account.currency && account.currency !== displayCurrency) {
      foreign.add(account.id);
    }
  }
  return foreign;
}

/**
 * A budget's category and every category beneath it.
 *
 * A budget on a GROUP ("Food") must count what its detail categories spend;
 * a budget on a detail category matches only itself, so the returned set is
 * that single id and the behaviour is unchanged.
 */
export function collectBudgetCategoryIds(
  categoryId: string,
  childrenByParent: ReadonlyMap<string, string[]>
): ReadonlySet<string> {
  const ids = new Set<string>([categoryId]);
  const queue = [categoryId];
  while (queue.length > 0) {
    const parentId = queue.pop();
    if (parentId === undefined) break;
    for (const childId of childrenByParent.get(parentId) ?? []) {
      // Guard against a cycle in stored parent links: without this a corrupt
      // tree would loop forever and hang the page.
      if (ids.has(childId)) continue;
      ids.add(childId);
      queue.push(childId);
    }
  }
  return ids;
}

/** Child ids by parent id — build once per category list, walk many times. */
export function buildCategoryChildIndex(
  categories: ReadonlyArray<{ id: string; parentId?: string | null }>
): ReadonlyMap<string, string[]> {
  const index = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = index.get(category.parentId);
    if (siblings) {
      siblings.push(category.id);
    } else {
      index.set(category.parentId, [category.id]);
    }
  }
  return index;
}

/** What one budget has spent in the period it is currently being measured over. */
export function calculateBudgetSpend(
  budget: BudgetSpendable,
  prepared: DatedDecimalTransaction[],
  options: BudgetSpendOptions = {}
): BudgetSpend {
  const window = getBudgetPeriodWindow(budget, options.now);
  const breakdown = calculateBudgetSpendingBreakdown(budget, prepared, window.start, window.end, {
    categoryIds: options.categoryIds,
    excludeAccountIds: options.foreignAccountIds
  });

  return {
    spent: breakdown.spent,
    window,
    excludedForeignCount: breakdown.excluded.length
  };
}
