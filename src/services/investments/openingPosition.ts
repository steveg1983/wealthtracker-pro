/**
 * The register row an UNFUNDED holding writes — the fix for a position that
 * was worth nothing anywhere.
 *
 * The valuation model (investmentValuation.ts) is
 *
 *     value(account, D) = ledger(D) + [market value − pooled cost]
 *
 * and its stated assumption is that the ledger carries buys at cost. A funded
 * buy satisfies it: the transfer puts the cost into the register, the delta
 * adds the gain, and the account is worth market by construction. A holding
 * added with "no money moves" satisfied neither half — the cost never entered
 * the register — so the position contributed only its GAIN, and a portfolio
 * recorded retrospectively read £0.00 on the Accounts page, in net worth and
 * on the Overview tab while the Portfolio tab priced it at market. The owner,
 * 30 Aug 2026: "they are an asset / investment that is held and should hold a
 * value throughout the app."
 *
 * So an unfunded add now writes ONE register row: the position's cost, dated
 * the day it was bought, filed under the system Account Adjustment category.
 * That category is the revaluation kind — the row moves the balance without
 * ever counting as income (classifyFlow files revaluation rows as neither),
 * exactly like a reconciliation adjustment, which is the same shape: value
 * arriving from outside the ledger's world. With the cost in the ledger the
 * model's assumption is true again and every surface agrees at market.
 *
 * Deliberately NOT written:
 *  - a funded buy (the transfer already carries the cost);
 *  - a foreign-priced unfunded holding (its cost is in the instrument's
 *    currency; the event lane skips those for the same reason, and a register
 *    row must be account money — it stays on the gain-only path until the FX
 *    story is built end to end);
 *  - a holding in an account with no revaluation category to file under
 *    (cannot happen with the system tree, but stated rather than assumed).
 */

import type { DecimalInstance } from '../../utils/decimal';

/** The slice of Category this decision reads — structural, not the app type,
 *  so the desktop edition can hand it the same shape. */
export interface CategoryForOpeningPosition {
  id: string;
  name: string;
  level?: string;
  isRevaluationCategory?: boolean;
}

export interface OpeningPositionRow {
  /** Positive — the cost arrives in the account. */
  amount: DecimalInstance;
  categoryId: string;
  description: string;
  date: Date;
}

/**
 * The category an opening position files under: the system Account
 * Adjustment, by its revaluation property first and its name second — a
 * renamed tree still yields A revaluation detail category rather than
 * nothing, because the property is what the classifiers read.
 */
export function adjustmentCategoryIdFor(
  categories: readonly CategoryForOpeningPosition[]
): string | null {
  const revaluationDetails = categories.filter(
    (category) => category.isRevaluationCategory === true && category.level === 'detail'
  );
  const named = revaluationDetails.find((category) => category.name === 'Account Adjustment');
  return named?.id ?? revaluationDetails[0]?.id ?? null;
}

/**
 * The row to write, or null with the reason it must not be.
 *
 * `costInAccountMoney` is the event lane's own figure (quantity × all-in
 * average cost) and null in exactly the cases the event is not written — the
 * two lanes make one decision, so the register and the valuation can never
 * disagree about whether a position is ledger-backed.
 */
export function openingPositionRow(args: {
  fundingAccountId: string | null;
  costInAccountMoney: DecimalInstance | null;
  quantity: DecimalInstance;
  symbol: string;
  date: Date;
  categories: readonly CategoryForOpeningPosition[];
}): { row: OpeningPositionRow | null; skipped: 'funded' | 'foreign' | 'no_category' | null } {
  if (args.fundingAccountId !== null) return { row: null, skipped: 'funded' };
  if (args.costInAccountMoney === null) return { row: null, skipped: 'foreign' };
  const categoryId = adjustmentCategoryIdFor(args.categories);
  if (categoryId === null) return { row: null, skipped: 'no_category' };
  return {
    row: {
      amount: args.costInAccountMoney,
      categoryId,
      description: `Opening position — ${args.quantity.toString()} ${args.symbol}`,
      date: args.date
    },
    skipped: null
  };
}
