import React, { useEffect, useState } from 'react';
import FilterAndFileList, {
  type FilterAndFileCopy,
  type FilterAndFilePreset,
} from './FilterAndFileList';
import { useArrivalRowFocus } from '../hooks/useArrivalFocus';
import type { Transaction } from '../types';

/**
 * Re-categorise past transactions — the housekeeping mount of the filter list.
 *
 * ── WHY THIS ONE SEARCHES FILED ROWS (owner, 1 Sep 2026) ────────────────────
 *
 * The tool is shared with Accounts → Categorisation and the two mounts split
 * by POPULATION: that page gives a transaction its FIRST category, and this
 * one changes what has already been filed. The case that asked for it is the
 * commonest one in a real ledger — a category was created this month, and
 * three years of rows that belong in it are sitting in "Personal spending"
 * because that is where everything went before it existed.
 *
 * So the population here is the exact complement of the review page's:
 * transactions that HAVE a category. Rows still waiting to be filed are out of
 * scope by design — the two lists would otherwise be a second, competing way
 * to do one job, and would disagree about what had been dealt with. Split
 * parents carry a blank category and fall out of the population on their own;
 * a split LINE is filed inside its parent and is edited there.
 *
 * Everything the list DOES — the stacking filters, the house pickers, the cap,
 * the three fields a filing writes, the one shot back — lives in
 * FilterAndFileList, which is the file to read and the file to change. What is
 * here is this page's half: its population, and the words that are only true
 * of a re-filing.
 *
 * ── IT CAN BE ASKED FOR FROM ABOVE (owner, 1 Sep 2026) ──────────────────────
 *
 * The data-health panel at the top of this page, and a link that arrives from
 * Accounts → Categorisation, both need to end at ROWS: the rows filed under a
 * category that no longer exists. So the section takes a request, and answering
 * it is one act — reveal, apply the search, scroll here. A nudge, not a lock:
 * whoever asked cannot hold the section open, and the reader's next filter is
 * their own.
 */

/** A transaction the tree can be corrected on, and the words for correcting it. */
const CORRECTING_A_FILING: FilterAndFileCopy = {
  bulkVerb: 'Change',
  bulkGerund: 'Changing',
  // "Replacing whatever category each currently has" is the part a count alone
  // cannot say: these rows are not blank, and a bulk re-filing overwrites work
  // somebody already did.
  bulkConsequence: (count, categoryName) => (
    <>
      This files {count.toLocaleString()} transaction{count === 1 ? '' : 's'} under{' '}
      <strong>{categoryName}</strong>, replacing whatever category each currently has.
    </>
  ),
  bulkFailed: count =>
    `${count.toLocaleString()} could not be changed and keep their current categories.`,
  undone: count => (
    <>
      <strong>{count.toLocaleString()}</strong> transaction{count === 1 ? ' is' : 's are'} back
      under the categor{count === 1 ? 'y it' : 'ies they'} had before.
    </>
  ),
  savedTitle: 'Category changed',
  nothingMatched: activeFilters =>
    `${activeFilters === 1
      ? 'No categorised transaction matches that filter.'
      : `No categorised transaction matches all ${activeFilters} of those filters at once.`
    } Rows with no category yet are never searched here, and neither are transfers.`,
  transfersExcluded: count =>
    `${count.toLocaleString()} transfer${count === 1 ? '' : 's'} matched and ${count === 1 ? 'is' : 'are'} not shown — transfers move money between your accounts and don’t take a category.`,
  footnote:
    'Changing history doesn’t change future guesses — suggestions keep learning from everything you file, and bank-feed rules are unaffected.',
};

/**
 * THE POPULATION: rows that already carry a category, transfers excluded.
 *
 * Blank-categoried rows are Categorisation's work, and a transfer takes no
 * category at all — it is money moving between the user's own accounts, and
 * both sides of it are already accounted for.
 */
const isFiled = (transaction: Transaction): boolean =>
  transaction.type !== 'transfer' && (transaction.category ?? '').trim() !== '';

interface RecategoriseSectionProps {
  /**
   * A search the page has asked this section to run, and a token that changes
   * on every ask. Null — the ordinary case — and nothing about the section
   * changes for anyone who never asks.
   */
  openWith?: FilterAndFilePreset | null;
}

export default function RecategoriseSection({
  openWith = null,
}: RecategoriseSectionProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  /**
   * Revealed when it is asked for. Deliberately one-way: the Hide button still
   * works afterwards, because a request opens a door rather than holding it.
   */
  useEffect((): void => {
    if (openWith !== null) setOpen(true);
  }, [openWith]);

  /**
   * …and brought into view, because this section is at the FOOT of a page whose
   * tree runs to hundreds of rows. Revealing a list a reader cannot see is the
   * same failure as the loop this path replaced. The house arrival hook, so
   * being sent somewhere always behaves the same way: once per request, and
   * never dragging the view back afterwards.
   */
  const { focusRef } = useArrivalRowFocus(
    openWith === null ? null : `refile-${openWith.kind}-${openWith.token}`
  );

  return (
    <section
      ref={focusRef}
      className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4 sm:p-6"
      aria-labelledby="recategorise-heading"
    >
      <div className="flex items-center gap-2">
        <h3 id="recategorise-heading" className="text-sm font-semibold text-gray-900 dark:text-white">
          Re-categorise past transactions
        </h3>
        <button
          type="button"
          onClick={() => setOpen(showing => !showing)}
          aria-expanded={open}
          className="ml-auto px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Change what is already filed — move an old category&rsquo;s rows into one you have just
        made, or correct a run of them. Transactions with no category yet belong in
        Accounts&nbsp;→&nbsp;Categorisation, and are not searched here.
      </p>

      <FilterAndFileList
        open={open}
        population={isFiled}
        copy={CORRECTING_A_FILING}
        preset={openWith}
      />
    </section>
  );
}
