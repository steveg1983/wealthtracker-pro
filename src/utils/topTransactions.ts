import type { Category } from '../types';
import { buildCategoryKindLookup, classifyFlow } from './incomeExpense';
import type { SplitExpandedTransaction } from './transactionSplits';

/**
 * "Top Transactions" — the biggest REAL money movements of a period, and the
 * one definition of that list: the report on screen and the same list printed
 * in the PDF must never disagree.
 *
 * REAL means money the household actually received or spent. A transfer leg
 * ("To/From Savings") moves money the household already had from one pocket to
 * another, and a revaluation ("Market Value Change", "Account Adjustment") is a
 * change in what something is WORTH — neither is income and neither is
 * spending, so neither belongs in a list of the biggest ones. They are ruled
 * out through the shared classifier (utils/incomeExpense), by category
 * SEMANTICS resolved from the id — never by matching a name, which would break
 * the moment a user renamed a category or typed the same words in a payee.
 *
 * Rows with no usable category stay: an unfiled £900 to a builder is a real
 * payment the user should see (and can file on the spot by clicking it). The
 * report's review band is where the count of those lives.
 */

/** How many rows "Top Transactions" shows, on screen and in the PDF. */
const TOP_TRANSACTIONS_LIMIT = 10;

export function selectTopTransactions(
  rows: readonly SplitExpandedTransaction[],
  categories: Category[],
  limit: number = TOP_TRANSACTIONS_LIMIT
): SplitExpandedTransaction[] {
  const kinds = buildCategoryKindLookup(categories);
  return rows
    // filter() already copies, so the sort below cannot mutate the caller's
    // memoised array.
    .filter(row => {
      const kind = classifyFlow(row, kinds);
      return kind !== 'transfer' && kind !== 'revaluation';
    })
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, limit);
}
