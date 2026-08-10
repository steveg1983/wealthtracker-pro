import type { Category, Transaction } from '../types';
import { categoryKindOf } from './incomeExpense';

/**
 * ─ THE RULE, WRITTEN DOWN ONCE ─────────────────────────────────────────────
 *
 * A TRANSFER CATEGORY AND A TRANSFER TYPE MUST NEVER DISAGREE.
 *
 * Two facts on a row say "this money moved between your own accounts": the
 * `type` field ('transfer') and the CATEGORY ("To/From <account>", or the two
 * legacy sentinels under the Transfer type root). Every report in this app
 * reads the CATEGORY — `classifyFlow` returns 'transfer' the moment the
 * category says so, whatever the type field claims — so a row can be typed
 * 'income' and still be treated as a transfer everywhere it is counted.
 *
 * That combination is not a harmless inconsistency. It is a row that:
 *
 *   - MOVES the account balance (balances sum stored amounts, and never look
 *     at the category);
 *   - counts as NEITHER income NOR spending in any report built on
 *     `computeIncomeExpense` — the dashboard, the income/expense breakdown,
 *     custom reports, top transactions, the payee groups, the spreadsheet
 *     export. `classifyFlow` says 'transfer' and every one of those drops it;
 *   - never appears in the UNCATEGORISED review band either, because it has a
 *     real category id. Nothing anywhere asks the user about it;
 *   - has no OTHER SIDE. A real transfer is two rows that cancel; this is one
 *     row that has been removed from the reports without anything balancing
 *     it.
 *
 * feedCategoryBackfill.ts reached the same conclusion from the other end and
 * refused to write one: "a transfer category … would hide it more thoroughly
 * than leaving it uncategorised does."
 *
 * ─ THE CONSEQUENCE FOR EVERY WRITER ────────────────────────────────────────
 * A path that can put a transfer category on a row must either make the row a
 * REAL transfer (both legs, linked, crossover-categorised — see
 * transferRepoint.ts for that filing and createTransferCounterpart for the
 * write) or refuse, saying why. There is no third option, and in particular
 * there is no BULK option: each transfer needs its target account resolved
 * individually, and a bulk filing that guessed would invent movements between
 * accounts that never happened.
 *
 * Everything below is pure. The writers import from here so the question "is
 * this a transfer filing?" has exactly one answer in the app.
 */

/**
 * Does this category file a row as a TRANSFER?
 *
 * Asked of the shared classifier rather than of `isTransferCategory` alone,
 * because the reports do: `categoryKindOf` also returns 'transfer' for the
 * legacy `transfer-in`/`transfer-out` sentinels hanging off the Transfer type
 * root. Those carry no `accountId`, so they are transfer filings whose target
 * cannot be resolved — see `transferTargetAccountFor`, and the refusals that
 * depend on the difference.
 */
export function isTransferFiling(category: Category | undefined): boolean {
  return categoryKindOf(category) === 'transfer';
}

/** As above, by id, against the category list the caller already holds. */
export function categoryIdIsTransferFiling(
  categories: readonly Category[],
  categoryId: string | undefined | null
): boolean {
  if (!categoryId) return false;
  return isTransferFiling(categories.find(c => c.id === categoryId));
}

/**
 * The account a transfer category NAMES, or undefined when it names none.
 *
 * Undefined has one meaning and it matters: the filing says "transfer" but not
 * "to where", so no counterpart can be created from it and the user has to say
 * which account the money moved to. The account-managed "To/From <account>"
 * categories always answer; the legacy sentinels never do.
 */
export function transferTargetAccountFor(
  categories: readonly Category[],
  categoryId: string | undefined | null
): string | undefined {
  if (!categoryId) return undefined;
  const category = categories.find(c => c.id === categoryId);
  if (!isTransferFiling(category)) return undefined;
  return category?.accountId;
}

/**
 * What a writer says when it will not file a transfer category in bulk.
 *
 * One sentence, shared, because the user meets this rule from four different
 * screens (the review band, Categorise by payee, a report drill-down, payee
 * memory) and four different wordings would read as four different rules.
 */
export const BULK_TRANSFER_FILING_REFUSAL =
  'Transfers can’t be filed in bulk — each one needs the account it moved to, and its other side created. Open the transaction and use the Transfer type.';

/**
 * A transfer category chosen where a plain category was expected: what the
 * surface should do about it.
 *
 * The three answers are the three real cases, and every calling surface owes
 * the user one of them:
 *
 *   'convert'  — the category names another account, so the row can become a
 *                real transfer to it. `targetAccountId` is that account.
 *   'refuse'   — the category names THIS account (a transfer to itself moves
 *                nothing), or names no account at all (a legacy sentinel, so
 *                there is nothing to create the other side in). `message` says
 *                which, in the user's terms.
 *   'not-a-transfer' — an ordinary category. Carry on.
 */
export type TransferCategoryChoice =
  | { kind: 'not-a-transfer' }
  | { kind: 'convert'; targetAccountId: string }
  | { kind: 'refuse'; message: string };

export function classifyTransferCategoryChoice(
  categories: readonly Category[],
  categoryId: string | undefined | null,
  sourceAccountId: string
): TransferCategoryChoice {
  if (!categoryIdIsTransferFiling(categories, categoryId)) {
    return { kind: 'not-a-transfer' };
  }
  const targetAccountId = transferTargetAccountFor(categories, categoryId);
  if (targetAccountId === undefined) {
    return {
      kind: 'refuse',
      message:
        'That transfer category doesn’t name an account, so there’s nothing to create the other side in — switch the type to Transfer and pick the account the money moved to.',
    };
  }
  if (targetAccountId === sourceAccountId) {
    return {
      kind: 'refuse',
      message:
        'That’s this account’s own transfer category — pick the OTHER account’s To/From category.',
    };
  }
  return { kind: 'convert', targetAccountId };
}

/**
 * The rows the rule has already been broken on: a transfer category on a row
 * that is not a transfer and has no other side.
 *
 * ─ WHY EACH EXCLUSION IS HERE ──────────────────────────────────────────────
 *  - `type === 'transfer'` rows agree with their category. Nothing to fix.
 *  - `linkedTransferId` rows HAVE their other side. The pair exists, the money
 *    is balanced, and every report treating them as transfers is right to; the
 *    stale type field is cosmetic, and the cure offered below (create or link
 *    the other side) would be a lie about them.
 *  - SPLIT PARENTS are excluded because a split's filing lives in its lines,
 *    not in the parent's category field; and split LINES are never examined
 *    here at all, because a transfer line inside a split is a first-class
 *    Microsoft Money construct with its own linkage
 *    (TransactionSplit.transferAccountId / linkedTransferId). Expanding splits
 *    and testing the projected rows — which inherit an income/expense type from
 *    their line's sign — would report every legitimate split transfer leg as
 *    broken. That is why this measure reads the STORED transactions and the
 *    other four in categoryHealth read the expanded ones.
 *
 * Returned as rows rather than a count because the remedy needs them: each one
 * has to be opened and given a target account individually, and a list that
 * disagreed with the number beside it would be worse than no list.
 */
export function findMismatchedTransferFilings(
  transactions: readonly Transaction[],
  categories: readonly Category[]
): Transaction[] {
  const transferCategoryIds = new Set(
    categories.filter(c => isTransferFiling(c)).map(c => c.id)
  );
  if (transferCategoryIds.size === 0) return [];
  return transactions.filter(t =>
    (t.type === 'income' || t.type === 'expense') &&
    !t.isSplit &&
    !t.linkedTransferId &&
    t.category !== undefined &&
    transferCategoryIds.has(t.category)
  );
}
