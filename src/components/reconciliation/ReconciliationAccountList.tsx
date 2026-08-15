import React from 'react';
import { ChevronRightIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import EmptyState from '../EmptyState';
import FilteredEmptyState from '../FilteredEmptyState';
import type { ReconciliationSummary } from '../../hooks/useReconciliation';
import type { ReconciliationGrouping } from './reconciliationGrouping';

interface ReconciliationAccountListProps {
  /**
   * The banded list, decided by the shared grouper (see `reconciliationGrouping`)
   * — flat, one level of bands, or type sections with institution sub-bands
   * inside them, which is what both switches on means on the Accounts page too.
   */
  grouping: ReconciliationGrouping;
  onSelectAccount: (accountId: string) => void;
  /**
   * The filter that is hiding rows, when one is on — and the way out of it.
   *
   * Present or absent is what decides which of the two empty states this list
   * draws, and they are NOT the same state: an empty list with no filter means
   * there is nothing here, while an empty list with a filter on means the rows
   * exist and something is covering them. Conflating the two is the failure
   * mode a shared component makes easy (design ruling 2026-08-12 §2, the gate
   * condition on batch 7 pass 2), so the caller has to say which it is.
   */
  filter?: {
    /** The filter's name, as the user set it. */
    label: string;
    /** Accounts that exist on this page and are currently hidden by it. */
    hiddenCount: number;
    /** Puts it away. */
    onClear: () => void;
  };
  /** Where a user with no accounts at all goes to make one. */
  onGoToAccounts?: () => void;
}

/**
 * The figure that is absent, rather than a word claiming it is unavailable.
 *
 * "N/A" reads as a refusal — as though the app could not work the number out.
 * It can: there is simply no statement balance entered yet, and the row says so
 * underneath in the one place the remedy belongs (P6 — say the consequence,
 * then the remedy).
 */
const ABSENT_FIGURE = '—';

/**
 * The per-row metric labels, printed only where the columns wrap.
 *
 * Below `md` the row's cells wrap under the account name and each figure needs
 * its own label, because there is no column above it to inherit one from. From
 * `md` up the group's header strip carries the labels once and these go
 * `sr-only` — visually silent, still announced, so a screen reader on a desktop
 * hears "Bank Balance £220.00" rather than three unlabelled numbers. Deleting
 * them outright would have made the strip a sighted-only affordance.
 */
const ROW_LABEL_CLASS =
  'text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 md:sr-only';

/** The column heading over each figure, once per group, from `md` up. */
const STRIP_LABEL_CLASS =
  'flex-none text-right text-label uppercase font-medium text-gray-500 dark:text-gray-400';

/**
 * The three figure columns' widths from `md` up — ONE definition, worn by both
 * the header strip and the row cells beneath it.
 *
 * Shared rather than repeated because a strip whose columns are a different
 * width from the rows' is a strip that labels the wrong figure, and two
 * matching literals in two places is exactly the drift that produces one.
 *
 * 132px is not arbitrary: "Account Balance" sets 128px at `text-label`, and a
 * column narrower than its own heading grows to fit the heading — which pushed
 * the neighbouring column 2px out of true, measured in the browser. The widest
 * heading plus a little air is the floor.
 */
const COLUMN_WIDTH = {
  bankBalance: 'md:min-w-[132px]',
  accountBalance: 'md:min-w-[132px]',
  difference: 'md:min-w-[100px]',
} as const;

/**
 * The horizontal box metrics of a row — worn by the rows AND by the strip that
 * heads them, for the same reason `COLUMN_WIDTH` is shared.
 *
 * Column WIDTHS were already shared; padding is the second alignment axis and
 * was two literals that happened to agree (`px-5` over a `p-5` card). Un-nesting
 * changed the row's padding, and a strip that kept the old number would have
 * labelled columns 3px out of true down the whole page.
 *
 * The 3px left border is geometry, not decoration: it is on every row at every
 * moment and only its COLOUR changes, so a row that gains the attention mark
 * does not shove its own contents sideways relative to its neighbours. (The
 * same trick the Accounts row plays with its 1px border.) The colour is
 * supplied per state rather than defaulted here, because two `border-l-*`
 * colour utilities in one class list are resolved by stylesheet order, not by
 * the order they are written in — the transparent one could win.
 */
const ROW_INSET_CLASS = 'border-l-[3px] px-3 sm:px-4';

/** "3 accounts" / "1 account" — a band's count, spoken as well as seen. */
const countLabel = (n: number): string => `${n} ${n === 1 ? 'account' : 'accounts'}`;

export default function ReconciliationAccountList({
  grouping,
  onSelectAccount,
  filter,
  onGoToAccounts,
}: ReconciliationAccountListProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();

  const total =
    grouping.mode === 'flat'
      ? grouping.summaries.length
      : grouping.groups.reduce((n, g) => n + g.summaries.length, 0);
  if (total === 0) {
    /**
     * FILTERED-EMPTY IS NOT EMPTY (DESIGN_PASS §4).
     *
     * This page used to answer both with one centred block reading "No accounts
     * to reconcile / All accounts are fully reconciled" — which is empty-state
     * copy, asserts something nobody asked it to assert, and offers no way
     * back. With `Needs attention only` on it was also the more alarming of the
     * two readings: the accounts had not gone anywhere, they were behind a
     * switch the user could not see from here.
     */
    if (filter && filter.hiddenCount > 0) {
      return (
        <div className="bg-white dark:bg-gray-800">
          <FilteredEmptyState
            // What is TRUE once the headline counts what the rows count: if no
            // account needs attention then no listed account has an
            // unreconciled row, so there is no second figure to report and the
            // design's example sentence about transactions still outstanding
            // would be a number this page can no longer produce.
            title="Nothing needs attention right now"
            hiddenCount={filter.hiddenCount}
            scope="accounts"
            filters={[filter.label]}
            clearLabel="Show all accounts"
            onClear={filter.onClear}
          />
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800">
        <EmptyState
          title="No accounts to reconcile"
          description="Reconciliation works from your open accounts, and there are none here. A closed account keeps its history but has no statement left to agree, so it is never listed on this page."
          action={onGoToAccounts ? { label: 'Go to accounts', onClick: onGoToAccounts, icon: null } : undefined}
        />
      </div>
    );
  }

  /**
   * A run of rows and the strip that heads it — ONE unit, always drawn together.
   *
   * That pairing is the whole reason this is a function rather than two pieces
   * of the section markup. The strip labels the columns of the rows directly
   * beneath it, so it belongs to the ROW GROUP, not to the section: with both
   * switches on the rows live inside the institution sub-bands, and a strip
   * left up at section level would head the first sub-band's heading instead of
   * any rows at all, with every later sub-band's columns unlabelled.
   */
  const renderRowGroup = (summaries: readonly ReconciliationSummary[]): React.JSX.Element => (
    <>
      {/* ONE label strip per row group instead of three labels per row.
          BANK BALANCE / ACCOUNT BALANCE / DIFFERENCE printed on every card
          was six words repeated down the page, competing with the figures
          they name (P1 — the figure is the interface).

          It mirrors the row card's box metrics exactly — the same 2px
          border (transparent here), the same md padding, the same gap and
          the same column widths — so the headings sit over the columns they
          name. The rows' three cells are flex-none and the chevron cannot
          shrink, which leaves the flex-1 spacer as the only elastic part of
          a row: the right-hand columns stay pinned to the right edge no
          matter how long an account name runs, and this strip pins to the
          same edge the same way.

          aria-hidden because it is a second voice for labels the rows still
          carry themselves (see ROW_LABEL_CLASS) — announced twice, it would
          read as six columns rather than three. */}
      <div
        aria-hidden="true"
        // Named so a test can count strips against row groups. There must be
        // exactly one per run of rows at every nesting level — the invariant
        // this helper exists to hold.
        data-testid="reconciliation-column-labels"
        className={`hidden md:flex w-full items-center gap-4 border-l-transparent pb-1 ${ROW_INSET_CLASS}`}
      >
        <div className="flex-1" />
        <p className={`${STRIP_LABEL_CLASS} ${COLUMN_WIDTH.bankBalance}`}>Bank Balance</p>
        <p className={`${STRIP_LABEL_CLASS} ${COLUMN_WIDTH.accountBalance}`}>Account Balance</p>
        <p className={`${STRIP_LABEL_CLASS} ${COLUMN_WIDTH.difference}`}>Difference</p>
        {/* The chevron's column, so the labels clear it. */}
        <div className="w-5 ml-2 flex-shrink-0" />
      </div>
      {/* ROWS, NOT CARDS (DESIGN_PASS §3.3, ruled for Accounts and applied here
          verbatim). Twenty-nine bordered, shadowed ~96px boxes made a list you
          scroll out of a list you scan; per P4 a row is separated from the next
          one by a hairline, and the group above it by weight and space. The
          white is on the run of rows, so the band reads as one surface rather
          than as twenty-nine floating ones. */}
      <div className="bg-white dark:bg-gray-800">
        {summaries.map(({ account, unreconciledCount, bankBalance, accountBalance, difference }) => {
          const hasDifference = difference != null && Math.abs(difference) > 0.005;

          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onSelectAccount(account.id)}
              /* No focus ring of its own: the app-wide `outline` in
                 accessibility-colors.css carries `!important`, and a private
                 ring on top of it is what produced the double border the
                 Accounts rows had to have removed. */
              className={`w-full text-left bg-white dark:bg-gray-800 py-3 sm:py-4 border-b border-b-line dark:border-b-gray-700 last:border-b-transparent dark:last:border-b-transparent transition-colors duration-state ${ROW_INSET_CLASS} ${
                hasDifference
                  ? // THE ATTENTION SIGNAL, WITHOUT A CARD TO PUT IT ON.
                    // It was a 2px amber ring around the whole box; a box is
                    // exactly what the un-nesting removes, and a ring is the
                    // one thing that cannot survive losing it. So the amber
                    // becomes a mark down the row's leading edge — the same
                    // idiom §3.4 reaches for when it asks the demo banner to
                    // stop being a full-bleed gold bar and become a navy one
                    // with a gold mark. It reads as a rail down the page at
                    // the rows that need work, which is stronger at a glance
                    // than 29 outlines of which a few were amber, and it
                    // spends less amber, not more (P3).
                    'border-l-amber-400 dark:border-l-amber-500 hover:bg-amber-50/40 dark:hover:bg-amber-900/10'
                  : 'border-l-transparent hover:bg-surface-secondary dark:hover:bg-gray-700/40'
              }`}
            >
              {/* w-full so the columns spread edge-to-edge and the icons
                  line up in a straight rail down the page */}
              {/* The min-widths below add up to 660px, which is what
                  kept this row off the edge of a phone. They only apply
                  from md up now; under that the row wraps. */}
              <div className="w-full flex flex-wrap items-end md:items-center gap-3 md:gap-4">
                <div className="flex items-center gap-3 min-w-0 basis-full md:basis-auto md:min-w-[200px]">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{account.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {account.institution ?? account.type}
                    </p>
                  </div>
                </div>

                <div className="basis-full md:basis-auto md:min-w-[120px]">
                  {unreconciledCount > 0 ? (
                    // Neutral, deliberately: this is a COUNT, not an
                    // action. It wore amber until the design pass pointed
                    // out that four amber chips on this page competed with
                    // the one amber that means "your next move" — the
                    // travelling yellow on the balance bar. The thread
                    // works because amber is otherwise absent (P3).
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-surface-tertiary text-slate-600 dark:bg-gray-700 dark:text-gray-300">
                      {unreconciledCount} unreconciled
                    </span>
                  ) : (
                    // "Reconciled", not "cleared": this is the answer to "is
                    // there anything left to do here?", and marks are not an
                    // answer to that — only a finished reconciliation is.
                    //
                    // NO PILL, AND NO COLOUR. It wore a filled badge in the
                    // app's LINK blue, on up to twenty-nine rows at once, for
                    // the state that is the ABSENCE of work — which spent
                    // blue on "row" and "figure" as well as "link", and gave
                    // the unremarkable rows a shape as loud as the ones
                    // asking for something. Colour on this page belongs to
                    // the rows that need attention (P2), and the pill stays
                    // with the state that carries a figure.
                    //
                    // The words stay, though, because the Difference column
                    // cannot say this: on every account with no closing
                    // balance entered that column reads "—", so delegating
                    // the answer to it would leave the question unanswered on
                    // exactly the rows this page exists for.
                    <span className="inline-flex items-center py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                      All reconciled
                    </span>
                  )}
                </div>

                <div className="hidden md:block flex-1" />

                <div className={`text-right flex-1 min-w-[84px] md:flex-none ${COLUMN_WIDTH.bankBalance}`}>
                  <p className={ROW_LABEL_CLASS}>Bank Balance</p>
                  {bankBalance != null ? (
                    <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(bankBalance, account.currency)}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-gray-400 dark:text-gray-500 tabular-nums">
                        {ABSENT_FIGURE}
                      </p>
                      {/* The remedy, on the row that needs it.
                          A span rather than a nested control, and that is
                          not a compromise: the whole card already opens
                          this account's reconciliation view, which is where
                          the closing balance is typed, so a button here
                          would be a second tab stop to the identical
                          destination — and a button inside a button is
                          invalid markup besides. It wears the quiet-text
                          role the balance bar's own "Enter balance"
                          affordance wears (P7), never amber: on this page
                          amber belongs to the travelling thread alone
                          (P3). */}
                      {/* "Closing balance", not "bank balance": a link
                          names its DESTINATION, and the screen it opens
                          deliberately says Closing Balance — the number
                          you agree to, not a live feed figure. The column
                          above stays Bank Balance because it really is
                          the feed's number; the two names mark two
                          different figures, and the gap between them is
                          the Difference column — the thing reconciliation
                          exists to close. (Design ruling, 2026-08-12.) */}
                      <span className="block text-[11px] font-medium text-primary dark:text-blue-400">
                        Enter closing balance
                      </span>
                    </>
                  )}
                </div>
                <div className={`text-right flex-1 min-w-[84px] md:flex-none ${COLUMN_WIDTH.accountBalance}`}>
                  <p className={ROW_LABEL_CLASS}>Account Balance</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(accountBalance, account.currency)}
                  </p>
                </div>
                <div className={`text-right flex-1 min-w-[84px] md:flex-none ${COLUMN_WIDTH.difference}`}>
                  <p className={ROW_LABEL_CLASS}>Difference</p>
                  {/* No second remedy here. The difference is missing for
                      exactly the reason the bank balance is, and the row
                      has already said what to do about it once. */}
                  {/* £0.00 IS NOT A LINK. It was set in the same blue the
                      app's links wear, so a page carrying no links at all
                      spent link-blue on its most repeated figure. A closed
                      difference is the quiet confirmation that two numbers
                      agree; weight and colour are held back for the one that
                      does not (P4 — weight before boxes, and the register's
                      own rule that weight says "this is the line"). */}
                  <p className={`text-sm tabular-nums ${
                    difference == null
                      ? 'font-semibold text-gray-400 dark:text-gray-500'
                      : Math.abs(difference) < 0.005
                      ? 'font-semibold text-gray-500 dark:text-gray-400'
                      : 'font-bold text-red-600 dark:text-red-400'
                  }`}>
                    {difference != null
                      ? formatCurrency(difference, account.currency)
                      : ABSENT_FIGURE}
                  </p>
                </div>
                <ChevronRightIcon size={20} className="text-gray-400 flex-shrink-0 ml-2" />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  // Neither switch on: one list, no headings and no counts — the same answer
  // `groupAccountsForDisplay` gives the Accounts page for the same combination
  // (a flat mode carrying no band chrome at all, rather than one nameless
  // group the caller might head by accident).
  if (grouping.mode === 'flat') {
    return <div>{renderRowGroup(grouping.summaries)}</div>;
  }

  return (
    <div className="space-y-6">
      {grouping.groups.map(group => (
        <section key={group.label}>
          {/* THE COUNT NAMES ITS UNIT. This page puts two different units on
              one screen — the headline counts TRANSACTIONS, a band counts
              ACCOUNTS — and a bare "(29)" under a headline reading 2,447 left
              the reader to work out that the two were not the same kind of
              thing. Naming it costs one word and matches both the Accounts
              page's bands and the label this band already announces to a
              screen reader. */}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            {group.title}
            <span className="ml-2 font-normal normal-case text-gray-400 dark:text-gray-500">
              ({countLabel(group.summaries.length)})
            </span>
          </h2>
          {group.subGroups ? (
            <div className="space-y-5">
              {group.subGroups.map(sub => (
                // A sub-band is a GROUP, not a heading. The page's outline stays
                // section (h2) → account name (h3), which is what a screen
                // reader walks; the institution, and how many accounts are under
                // it, arrive as this container's label instead. Exactly the
                // treatment the Accounts page gives its own institution
                // sub-bands, for exactly that reason.
                <div
                  key={sub.label}
                  role="group"
                  aria-label={`${sub.title}, ${countLabel(sub.summaries.length)}`}
                >
                  {/* The section heading above, one step quieter and separated
                      by a hairline rather than by a box of its own (P4: weight
                      and space before borders). Deliberately NOT indented: the
                      rows below it carry three right-aligned figure columns that
                      run in a straight rail down the whole page, and indenting
                      the band would bend that rail out of true for every account
                      that happened to have an institution.

                      A COUNT AND NO TOTAL, BY DECISION — not for want of a
                      converter. The Accounts page's group headings DO carry a
                      converted total (design ruling C), and the machinery to
                      convert one is a hook away, so the asymmetry looks like an
                      omission and is not. Ruling, 2026-08-13: "a total is
                      earned by a question, not by the availability of numbers."
                      Net worth is a question people ask in one currency — what
                      am I worth — while a summed balance across an
                      institution's accounts answers nothing anyone came to this
                      page for. This page has one job: how much work is left,
                      and where. The count IS the total here; a money figure
                      beside it would be a second, louder number that no reader
                      acts on. Apply that test before reaching for consistency
                      with the Accounts page. */}
                  <p className="mb-2 flex items-baseline gap-2 border-b border-line dark:border-gray-700 pb-1.5 text-label uppercase font-semibold text-gray-500 dark:text-gray-400">
                    <span className="truncate">{sub.title}</span>
                    <span className="shrink-0 font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
                      ({countLabel(sub.summaries.length)})
                    </span>
                  </p>
                  {renderRowGroup(sub.summaries)}
                </div>
              ))}
            </div>
          ) : (
            renderRowGroup(group.summaries)
          )}
        </section>
      ))}
    </div>
  );
}
