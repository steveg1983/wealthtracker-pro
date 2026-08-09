import type { Transaction } from '../types';
import { toDateMs } from './dateBoundary';

export type TransactionSortField =
  | 'date' | 'description' | 'amount' | 'category' | 'tags' | 'payment' | 'deposit' | 'notes';

/**
 * What the Category column SAYS for a row — supplied by whoever draws that
 * column, because a column has to sort by the text in front of the user.
 *
 * Handing in a function rather than the category list is the point of it. The
 * comparator used to take `Category[]` and resolve the name itself, which meant
 * it resolved a DIFFERENT string from the one on screen: the leaf name only
 * ("Groceries" where the column read "Food > Groceries"), and nothing at all
 * for a transfer entered by hand (their category is the literal 'transfer-out',
 * which is no category's id, while the column reads "Transfer > Savings").
 * Every transfer therefore scored exactly what an uncategorised row scores —
 * the empty string — the two kinds tied, and the chronological tie-break below
 * laid the whole block out by date. A register sorted by Category came back in
 * date order.
 *
 * The register hands in the very function its Category cell renders with (see
 * createCategoryLabeller), so the two cannot drift apart again.
 */
export type CategoryLabelFor = (transaction: Transaction) => string;

/**
 * A transaction's day as a sortable instant, with an unreadable one sorting
 * oldest. NaN would be worse than wrong: `NaN - NaN` is NaN, a comparator that
 * returns NaN is neither `< 0` nor `> 0`, and Array.prototype.sort is then free
 * to leave the rows in any order it likes — which is exactly the kind of
 * order-by-accident this module exists to remove. Two -Infinity dates never
 * reach the subtraction (the equality test above it stops them).
 */
const sortableTime = (value: unknown): number => {
  const ms = toDateMs(value);
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
};

/**
 * The bank's own position for this row within its statement, or +Infinity when
 * it has none.
 *
 * UNKNOWN SORTS LAST, and that is a decision worth stating. A row with no
 * sequence is either hand-entered or imported before the column existed; either
 * way nothing places it among rows that DO know their place. Sorting it last
 * within its day keeps the imported statement's own run intact and contiguous —
 * which is the run the user is checking line by line against the bank — and
 * puts the unknown row at the end where the day's closing balance still lands
 * on the account's true balance. Interleaving them by guesswork would corrupt
 * the one sequence we actually know.
 *
 * +Infinity rather than a fall-through, because every value here must be
 * comparable against every other or the composed order stops being transitive:
 * a "compare sequence only when both have one" rule can order A before B, B
 * before C and C before A.
 */
const statementPosition = (transaction: Transaction): number => {
  const sequence = transaction.statementSequence;
  return typeof sequence === 'number' && Number.isFinite(sequence)
    ? sequence
    : Number.POSITIVE_INFINITY;
};

/**
 * When a transaction was ENTERED — the tie-break below the bank's own order.
 *
 * Its reach is narrow and worth knowing. `create_transaction_atomic` lets
 * Postgres default `created_at` to now(), and now() is TRANSACTION start time,
 * so rows written one awaited RPC at a time (hand entry) come out strictly
 * increasing. It is NOT reliable for imports: `import_transactions_atomic`
 * writes a whole file inside ONE transaction, giving every row of that file the
 * same created_at, and the OFX modal's own loop fires its writes without
 * awaiting them, so their arrival order is a race. That is precisely why
 * statementSequence above exists — created_at cannot stand in for it.
 *
 * Rows with no creation time sort after those that have one, for the same
 * transitivity reason as statementPosition.
 *
 * Read through toDateMs because `createdAt` is declared a Date but arrives from
 * PostgREST as an ISO string — it is not one of the fields the date boundary
 * converts. toDateMs takes `unknown` and reads either shape, so no cast.
 */
const enteredTime = (transaction: Transaction): number => {
  const ms = toDateMs(transaction.createdAt);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

/**
 * THE chronological order of a register: the order a running balance is
 * accumulated in, and the order every Date sort displays — forwards when
 * ascending, exactly reversed when descending.
 *
 * WHY IT IS SHARED. A running balance only means anything against the order it
 * was accumulated in. The register used to compute balances with one local sort
 * and display rows with another, so two transactions on the same day made the
 * Balance column read as nonsense and, newest-first, the TOP row showed the
 * balance from before the day's last transaction instead of the account's
 * current balance. There can only be one order.
 *
 * WHY IT IS TOTAL. Same-day transactions carry no order of their own in this
 * database, so the tie-break is a convention — and a convention only works if
 * it is complete. Anything left equal here is settled by Array.prototype.sort's
 * stability, i.e. by whichever order the array happened to arrive in; the
 * balances are built from the account's full history and the rows from a
 * filtered view, so "whichever order it arrived in" is not the same answer
 * twice.
 *
 * WHY THERE IS NO SEMANTIC TIE-BREAK. This used to order a day income →
 * transfer → expense, on the theory that a day's pay must land before the
 * payments it funds. A real bank statement disproves it, twice over. On an
 * account that runs an automated two-way sweep with a linked savings account,
 * the day's spending happens first and ONE sweep in the evening returns the
 * balance to exactly zero — so a credit follows the debits, not the other way
 * round. And on such a day the standing order and the sweep are BOTH transfers,
 * with a real order between them that type cannot express at all.
 *
 * The invented order therefore showed intermediate balances the account never
 * held: arithmetically self-consistent, and a description of a day that did not
 * happen — on the screen whose entire job is agreeing with the statement line by
 * line.
 *
 * "Transfers last" is the same mistake in a new coat: a transfer can equally
 * fund a day's spending at its start. The fix is not a better guess, it is to
 * record what the bank said — statementSequence.
 *
 * The convention, in order:
 *  1. the day — the only ordering fact `transactions.date` can carry;
 *  2. the bank's own position within its statement (statementPosition);
 *  3. when the row was entered (enteredTime), which is real for hand entry and
 *     meaningless within an imported file;
 *  4. its id — arbitrary, but stable, and already what the data layer
 *     tie-breaks on (see mergeTransactionDelta in api/transactionService).
 *
 * Step 2 needs `transactions.statement_sequence`, added by
 * supabase/migrations/20260808090000_transaction_statement_sequence.sql — which
 * is DRAFTED AND UNAPPLIED. Until it is applied every row answers +Infinity
 * there, the step is inert, and the order falls through to 3 and 4 exactly as
 * it does today. Nothing here needs changing when it lands.
 */
export function compareChronological(a: Transaction, b: Transaction): number {
  const dateA = sortableTime(a.date);
  const dateB = sortableTime(b.date);
  if (dateA !== dateB) return dateA - dateB;

  const positionA = statementPosition(a);
  const positionB = statementPosition(b);
  if (positionA !== positionB) return positionA - positionB;

  const enteredA = enteredTime(a);
  const enteredB = enteredTime(b);
  if (enteredA !== enteredB) return enteredA - enteredB;

  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * Comparable value for a transaction under a given sort field. Payment/Deposit
 * both order by the signed amount (they're two views of the same number);
 * category/tags order by their display text.
 */
export function transactionSortValue(
  t: Transaction,
  field: TransactionSortField,
  categoryLabel: CategoryLabelFor
): string | number {
  switch (field) {
    case 'amount':
    case 'payment':
    case 'deposit':
      return t.amount;
    case 'category':
      return categoryLabel(t).toLowerCase();
    case 'tags':
      return (t.tags ?? []).join(', ').toLowerCase();
    case 'notes':
      return (t.notes ?? '').toLowerCase();
    case 'description':
      return t.description.toLowerCase();
    case 'date':
      return new Date(t.date).getTime();
    default:
      return '';
  }
}

/**
 * Account-register sort comparator. Every column sorts through here EXCEPT the
 * running Balance, which is never sorted — it is accumulated in
 * compareChronological order and mapped back per transaction, so each row's
 * figure stays true under any sort.
 *
 * Date IS compareChronological, negated for descending: the whole order flips,
 * tie-break included, so newest-first reads as the exact reverse of the order
 * the balances were accumulated in and the top row carries the account's
 * current balance.
 */
export function compareTransactions(
  a: Transaction,
  b: Transaction,
  field: TransactionSortField,
  direction: 'asc' | 'desc',
  categoryLabel: CategoryLabelFor
): number {
  if (field === 'date') {
    // Negating the WHOLE comparator, not just the day. Reversing the day while
    // leaving the same-day tie-break forwards is what put a day's deposit above
    // its payments under a newest-first sort while the balances had it below
    // them — every same-day balance out by that day's other transactions.
    const chronological = compareChronological(a, b);
    return direction === 'asc' ? chronological : -chronological;
  }

  const aValue = transactionSortValue(a, field, categoryLabel);
  const bValue = transactionSortValue(b, field, categoryLabel);

  if (field === 'category') {
    const aIsUncategorised = aValue === '';
    const bIsUncategorised = bValue === '';
    if (aIsUncategorised !== bIsUncategorised) {
      // ─ WHERE THE UNCATEGORISED ROWS GO ─────────────────────────────────
      // Together, always — one block, never two — and at the FOOT under
      // ascending, the head under descending.
      //
      // Which end is not a toss-up. "I sort by category to work through the
      // uncategorised" is what the column is for on this screen, and the
      // register OPENS AT THE FOOT (Money's own habit: oldest at the top,
      // newest on the last line, and that last line is what you land on). A
      // re-sort keeps the scroll position it was already in, so clicking
      // Category on a freshly-opened register puts the work queue under the
      // eyes that asked for it, with no scroll at all. Ascending would
      // otherwise be the one arrangement that buries it eleven thousand rows
      // above the fold.
      //
      // It flips with the direction rather than pinning to one end, so the
      // other end of the queue is one further click away either way — and so
      // that descending is the exact reverse of ascending, which is the least
      // a second click on a header can promise.
      //
      // Blank means blank as the COLUMN means it: a row whose Category cell is
      // empty. A row filed in a named bucket ("Unassigned (MS Money import)")
      // shows that name, so it groups under that name — visibly, where it can
      // be worked through as its own run.
      const uncategorisedGoLast = direction === 'asc';
      if (aIsUncategorised) return uncategorisedGoLast ? 1 : -1;
      return uncategorisedGoLast ? -1 : 1;
    }
  }

  if (aValue < bValue) return direction === 'asc' ? -1 : 1;
  if (aValue > bValue) return direction === 'asc' ? 1 : -1;

  // Equal on the chosen column: tie-break chronologically, oldest first, in the
  // same order the balances run. Sorting by Description therefore lists a
  // payee's rows together in date order instead of leaving their relative order
  // to chance.
  return compareChronological(a, b);
}
