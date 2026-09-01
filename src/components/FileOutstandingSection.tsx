import React from 'react';
import { Link } from 'react-router-dom';
import FilterAndFileList, { type FilterAndFileCopy } from './FilterAndFileList';
import { awaitsFiling } from '../utils/transactionReview';

/**
 * Filter and file — the first-filing mount of the shared list.
 *
 * ── WHAT IT REPLACED, AND WHY (owner, 1 Sep 2026) ───────────────────────────
 *
 * "Review one by one" opened the whole backlog in the report drill and asked
 * the reader to work down it a row at a time. For a handful of rows that is
 * fine; for the backlog people actually arrive here with it is the drudgery
 * every other card on this page exists to avoid. The owner approved the same
 * filter-and-tick list the housekeeping end already had, pointed at THIS
 * page's population instead — so the third way through is "find the ones that
 * belong together and file the lot", which is what a person was doing by hand.
 *
 * Its two neighbours stay exactly as they are, and the reasoning is his: Match
 * transfers works in equal-and-opposite PAIRS across two accounts, which a
 * one-row-at-a-time list cannot see; Categorise by payee arrives already
 * grouped by merchant and teaches future imports as it files. Neither is a
 * filter list wearing a different hat.
 *
 * ── THE POPULATION ──────────────────────────────────────────────────────────
 *
 * Every row that still wants somebody's eyes, by the app's ONE definition of
 * that (utils/transactionReview): unfiled, or flagged on arrival and never
 * saved since. So a feed's guess sits here beside a blank row — a guess is not
 * a filing, and the picker starts on the guess so agreeing with it is one
 * press. Both exclusions are the same as the register's, for the same reasons:
 * a TRANSFER takes no category, and a SPLIT PARENT files through its lines, so
 * a single category written to it is a category the database refuses.
 *
 * That last exclusion is the one a reader can count for themselves — the
 * backlog figure above this list expands splits into their lines — so it is
 * said out loud whenever there are any, with where the work actually is.
 */

/** A row nobody has filed yet, and the words for filing it. */
const FILING_FOR_THE_FIRST_TIME: FilterAndFileCopy = {
  bulkVerb: 'File',
  bulkGerund: 'Filing',
  // The consequence in full: these rows are not all blank — some carry a guess
  // the press is about to overrule — and filing is what ends their review.
  bulkConsequence: (count, categoryName) => (
    <>
      This files {count.toLocaleString()} transaction{count === 1 ? '' : 's'} under{' '}
      <strong>{categoryName}</strong> and ends {count === 1 ? 'its' : 'their'} review, replacing
      any category the app had guessed for {count === 1 ? 'it' : 'them'}.
    </>
  ),
  bulkFailed: count =>
    `${count.toLocaleString()} could not be filed and ${count === 1 ? 'is' : 'are'} still waiting.`,
  undone: count => (
    <>
      <strong>{count.toLocaleString()}</strong> transaction{count === 1 ? ' is' : 's are'} back as
      {count === 1 ? ' it was' : ' they were'}, still waiting to be filed.
    </>
  ),
  savedTitle: 'Transaction filed',
  nothingMatched: activeFilters =>
    `${activeFilters === 1
      ? 'No outstanding transaction matches that filter.'
      : `No outstanding transaction matches all ${activeFilters} of those filters at once.`
    } Transactions you have already filed are not searched here, and neither are transfers.`,
  transfersExcluded: count =>
    `${count.toLocaleString()} transfer${count === 1 ? '' : 's'} matched and ${count === 1 ? 'is' : 'are'} not shown — money moved between your own accounts takes no category. Match transfers, above, is where those are paired up.`,
  footnote: (
    <>
      Filed something in the wrong place? Change it under{' '}
      <Link to="/settings/categories" className="underline hover:no-underline">
        Manage&nbsp;→&nbsp;Categories
      </Link>, which searches the rows this list has already dealt with.
    </>
  ),
  // Agreeing with the app's guess IS a decision here, and it writes the same
  // three fields as changing it — so Save stands ready on a row whose category
  // nobody has touched.
  filesUnchangedRows: true,
};

interface FileOutstandingSectionProps {
  /** Drawn when the card above it is pressed; mounted either way. */
  open: boolean;
  onHide: () => void;
  /**
   * How many of the backlog counted above are split LINES, which this list
   * cannot file — see the note at the top. Zero says nothing at all.
   */
  splitLines: number;
}

export default function FileOutstandingSection({
  open,
  onHide,
  splitLines,
}: FileOutstandingSectionProps): React.JSX.Element {
  return (
    <FilterAndFileList
      open={open}
      population={awaitsFiling}
      copy={FILING_FOR_THE_FIRST_TIME}
      className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4"
      header={
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Filter and file
            </h2>
            <button
              type="button"
              onClick={onHide}
              className="ml-auto px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Hide
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Everything still waiting: rows with no category, and rows the app filled in that
            nobody has agreed with yet. Filing one here ends its review.
          </p>
          {/* The shortfall between the count above and what this list can
              show, named rather than left to be noticed (house rule). */}
          {splitLines > 0 && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {splitLines.toLocaleString()} of those{' '}
              {splitLines === 1 ? 'is a line inside a split' : 'are lines inside splits'} and{' '}
              {splitLines === 1 ? 'is' : 'are'} not listed here — a split line is filed inside its
              parent, from the register.
            </p>
          )}
        </>
      }
    />
  );
}
