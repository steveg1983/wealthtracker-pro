import React from 'react';
import { Building2Icon, ChevronRightIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
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

/** "3 accounts" / "1 account" — a sub-band's count, spoken as well as seen. */
const countLabel = (n: number): string => `${n} ${n === 1 ? 'account' : 'accounts'}`;

export default function ReconciliationAccountList({
  grouping,
  onSelectAccount,
}: ReconciliationAccountListProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();

  const total =
    grouping.mode === 'flat'
      ? grouping.summaries.length
      : grouping.groups.reduce((n, g) => n + g.summaries.length, 0);
  if (total === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">No accounts to reconcile</p>
        <p className="text-sm mt-1">All accounts are fully reconciled</p>
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
        className="hidden md:flex w-full items-center gap-4 border-2 border-transparent px-5 pb-1"
      >
        <div className="flex-1" />
        <p className={`${STRIP_LABEL_CLASS} ${COLUMN_WIDTH.bankBalance}`}>Bank Balance</p>
        <p className={`${STRIP_LABEL_CLASS} ${COLUMN_WIDTH.accountBalance}`}>Account Balance</p>
        <p className={`${STRIP_LABEL_CLASS} ${COLUMN_WIDTH.difference}`}>Difference</p>
        {/* The chevron's column, so the labels clear it. */}
        <div className="w-5 ml-2 flex-shrink-0" />
      </div>
      <div className="grid gap-3">
        {summaries.map(({ account, unreconciledCount, bankBalance, accountBalance, difference }) => {
          const hasDifference = difference != null && Math.abs(difference) > 0.005;

          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onSelectAccount(account.id)}
              className={`w-full text-left bg-white dark:bg-gray-800 rounded-xl border-2 transition-all hover:shadow-md ${
                hasDifference
                  ? 'border-amber-400 dark:border-amber-500'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary'
              } p-4 md:p-5`}
            >
              {/* w-full so the columns spread edge-to-edge and the icons
                  line up in a straight rail down the page */}
              {/* The min-widths below add up to 660px, which is what
                  kept this card off the edge of a phone. They only apply
                  from md up now; under that the row wraps. */}
              <div className="w-full flex flex-wrap items-end md:items-center gap-3 md:gap-4">
                <div className="flex items-center gap-3 min-w-0 basis-full md:basis-auto md:min-w-[200px]">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                    <Building2Icon size={20} className="text-gray-600 dark:text-gray-400" />
                  </div>
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
                    // "Reconciled", not "cleared": this badge is the answer
                    // to "is there anything left to do here?", and marks are
                    // not an answer to that — only a finished reconciliation
                    // is.
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
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
                  <p className={`text-sm font-bold tabular-nums ${
                    difference == null
                      ? 'text-gray-400 dark:text-gray-500'
                      : Math.abs(difference) < 0.005
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-red-600 dark:text-red-400'
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            {group.title}
            <span className="ml-2 font-normal normal-case text-gray-400 dark:text-gray-500">
              ({group.summaries.length})
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
                      that happened to have an institution. */}
                  <p className="mb-2 flex items-baseline gap-2 border-b border-line dark:border-gray-700 pb-1.5 text-label uppercase font-semibold text-gray-500 dark:text-gray-400">
                    <span className="truncate">{sub.title}</span>
                    <span className="shrink-0 font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
                      ({sub.summaries.length})
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
