import type { ReactNode } from 'react';

/**
 * The ONE column definition the Accounts list's rows share.
 *
 * ─ WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The list draws two kinds of row: a top-level account card, and — for an
 * investment↔cash pair (the Microsoft Money model) — a nested cash row inside
 * it. They showed the same figures under the same headings, and each laid them
 * out its own way: the card on a nine-column grid, the cash row on a flex line
 * with three hand-matched widths. So the two lines of figures did not line up,
 * and every later change to one of them had to be remembered into the other.
 *
 * Matching the numbers up again would have fixed today's misalignment and left
 * tomorrow's in place. What stops them drifting is that neither row owns a
 * column definition any more: both render <AccountRowColumns>, which is the
 * only place the template lives, and both fill it with the cells below in the
 * same order. A figure can only move for one row by moving for the other.
 *
 * ─ THE COLUMNS, LEFT TO RIGHT ──────────────────────────────────────────────
 *   1 Bank Bal      what the bank last said (empty for a row with no feed)
 *   2 Account Bal   what the ledger says
 *   3 Unreconciled  how many rows have not been agreed with the bank
 *   4 To Review     how many freshly-imported rows nobody has dealt with
 *   5–9             five action slots, always all five, so the buttons in
 *                   them land at the same x on every card whether or not a
 *                   given account has that action (portfolio, bank feed,
 *                   settings, reconcile, close).
 *
 * A row that has nothing for a column renders <AccountRowEmptyCell /> rather
 * than dropping the column: an omitted cell pulls everything to its right one
 * place along, which is precisely the alignment this file exists to keep.
 *
 * ─ PHONES ──────────────────────────────────────────────────────────────────
 * Below sm the grid gives way to a wrapping row: the stat columns need about
 * 490px and a phone card offers ~330, so the figures take one line and the
 * buttons the next. The balance is shown beside the account NAME at that width
 * instead (where a banking app puts it), which is why AccountBalanceCell can be
 * asked to keep itself off small screens rather than saying it twice.
 */

/**
 * The template itself. Fixed widths, not fractions: a column that sized itself
 * to its content would be a different width on every card, and lining the cards
 * up with each other is the whole point.
 */
export const ACCOUNT_ROW_COLUMNS_CLASS =
  'flex flex-wrap items-center justify-end gap-x-4 gap-y-1 sm:grid ' +
  'sm:grid-cols-[6.5rem_7.5rem_5.5rem_5.5rem_repeat(5,3rem)] ' +
  'sm:justify-items-end sm:items-center sm:gap-x-2 sm:gap-y-0';

/**
 * The look of a row the user has picked out, echoing the register's own active
 * row (.selected-transaction-row in index.css): the same blue wash, the same
 * #6B86B3 ring, the same two-layer elevation that lifts the row off the page.
 *
 * Echoed in utilities rather than by wearing that class, because three of its
 * declarations belong to a table row and not to a card: a forced `margin: 4px 0`
 * would fight the list's own spacing (and make a card twitch as it is selected),
 * `border-radius: 12px` would square off the card's 16px corners, and
 * `font-weight: 600` would embolden every word on the card rather than mark it.
 * What is left — colour, ring, lift — is the part that means "this one", and it
 * is what is copied here.
 */
export const ACCOUNT_ROW_SELECTED_CLASS =
  'relative z-10 bg-blue-50/80 dark:bg-blue-900/30 ' +
  'ring-1 ring-[#6B86B3]/50 dark:ring-[#6B86B3]/70 ' +
  'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] ' +
  'dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3),0_10px_15px_-3px_rgba(0,0,0,0.3)]';

/** The column heading over a figure — small, quiet, and the same for every row. */
const CELL_LABEL_CLASS = 'text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500';

/** The figures themselves: tabular so the digits line up down the column. */
const CELL_FIGURE_CLASS = 'text-sm font-semibold tabular-nums';

/**
 * The columns of one row.
 *
 * Its children ARE the nine slots, in order — there is no way to render this
 * grid without going through here, which is what keeps the two row types in
 * step.
 */
export function AccountRowColumns({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div data-account-columns className={ACCOUNT_ROW_COLUMNS_CLASS}>
      {children}
    </div>
  );
}

/**
 * A money figure in its column.
 *
 * `smOnly` keeps the cell off phones, where the same figure is shown beside the
 * account name; the cell still exists in the grid at every other width.
 */
export function AccountBalanceCell({
  label,
  value,
  smOnly = false,
}: {
  label: string;
  value: string;
  smOnly?: boolean;
}): React.JSX.Element {
  return (
    <div className={smOnly ? 'hidden sm:block text-right' : 'text-right'}>
      <p className={CELL_LABEL_CLASS}>{label}</p>
      <p className={`${CELL_FIGURE_CLASS} text-gray-900 dark:text-white`}>{value}</p>
    </div>
  );
}

/**
 * A count of outstanding work: amber while there is some, blue when there is
 * none.
 *
 * A QUIET 0 RATHER THAN A BLANK, unlike the register's own counters, and the
 * difference is the surface rather than an inconsistency: this is a COLUMN, and
 * a column of figures with a hole in it reads as "not known" — the eye has to
 * stop and work out which. The register's counters are chrome, and there it is
 * absence that means "nothing to do".
 */
export function AccountCountCell({
  label,
  count,
}: {
  label: string;
  count: number;
}): React.JSX.Element {
  return (
    <div className="text-right">
      <p className={CELL_LABEL_CLASS}>{label}</p>
      <p
        className={`${CELL_FIGURE_CLASS} ${
          count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
        }`}
      >
        {count}
      </p>
    </div>
  );
}

/**
 * A column this row has nothing for.
 *
 * Rendered from sm up only: that is where the grid is, and where a missing cell
 * would shunt everything after it out of line. Below sm the columns are a
 * wrapping flex row, and an invisible item there would only add a gap.
 */
export function AccountRowEmptyCell(): React.JSX.Element {
  return <div className="hidden sm:block" aria-hidden="true" />;
}

/**
 * One of the five action slots.
 *
 * Rendered whether or not this row has that action — an account with no bank
 * feed keeps an empty feed slot rather than letting the buttons after it
 * shuffle left, because muscle memory is the point. A row that has no such
 * action AT ALL (a cash sleeve has no portfolio and no feed) uses
 * AccountRowEmptyCell instead, which costs nothing on a phone.
 */
export function AccountRowActionSlot({ children }: { children?: ReactNode }): React.JSX.Element {
  return <div className="flex items-center justify-end">{children}</div>;
}
