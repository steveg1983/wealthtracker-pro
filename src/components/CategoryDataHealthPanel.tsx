import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { preserveDemoParam } from '../utils/navigation';
import type { CategoryHealth } from '../utils/categoryHealth';

/**
 * "Data health" for the Categories page: the amber panel that points at where
 * the user's category data is weak, so they can tighten it up. Each line shows
 * only when its count is non-zero, and the whole panel disappears when the data
 * is clean — a permanent "all good" box would just be noise once it is.
 *
 * The counts come from the shared classifier (see utils/categoryHealth), so the
 * uncategorised figure here matches what the Categorisation page offers to work
 * through, transaction for transaction. The link goes THERE — to the tools that
 * clear the backlog — not to a report that only restates the problem.
 *
 * ── THE RULE FOR EVERY LINE ADDED HERE, NOW AND LATER ─────────────────────
 * A line ships WITH its remedy attached. Naming a problem and leaving the user
 * to find the cure is how a health panel becomes wallpaper: read once, believed
 * once, then scrolled past for ever. So every `<li>` below ends in an action
 * that lands on the surface where those exact rows can be fixed — and the
 * remedy props are REQUIRED, not optional, so a new line cannot quietly ship
 * without one. If a measure has no reachable fix, it does not belong on this
 * panel; put it where the fix lives instead.
 *
 * Which surface each line points at is a measured choice, not a default:
 *  - uncategorised → the Categorisation page, the chore list built for exactly
 *    this backlog;
 *  - the import's Unassigned bucket → that bucket's own transaction list, right
 *    here on this page. Those rows are split LINES (the splits schema forbids a
 *    blank category, so the MS Money importer parks them in a bucket instead),
 *    and a split line's category lives on the line: the only thing that can
 *    change it is the parent's editor, which is precisely what a row in that
 *    list opens. The review band's inline picker cannot — it fills BLANKS only
 *    (apply_category_to_uncategorized), and these rows are not blank;
 *  - dangling references → the Categorisation page as well: they sit in the
 *    same review band, and each row opens the editor that can re-file it;
 *  - empty categories → the tree below, with those rows lit up and deletion
 *    reachable, because that is where a category is deleted;
 *  - transfer filings that are not transfers → a list of exactly those rows,
 *    each of which opens the full editor. NOT a "fix them all" button: every one
 *    of these rows is missing a fact only the user has — whether the other side
 *    already exists somewhere, or has to be created — so the cure is the
 *    editor's own match-or-create question, asked once per row. A bulk convert
 *    would invent movements between accounts nobody recorded.
 */
export default function CategoryDataHealthPanel({
  health,
  onFileUnassignedBucket,
  onShowEmptyCategories,
  onFixTransferFilings,
}: {
  health: CategoryHealth;
  /** Open the import bucket's rows for filing (the id is the one measured). */
  onFileUnassignedBucket: (categoryId: string) => void;
  /** Show the empty categories in the tree, with deletion reachable. */
  onShowEmptyCategories: () => void;
  /** Open the mismatched rows, one editor per row (the ids are the measured ones). */
  onFixTransferFilings: (transactionIds: readonly string[]) => void;
}): React.JSX.Element | null {
  const { formatCurrency } = useCurrencyDecimal();
  const location = useLocation();

  if (!health.hasWarnings) return null;

  const plural = (count: number): string => (count === 1 ? '' : 's');

  // Actions read as the links beside them, because they do the same job: the
  // difference between "go to that page" and "open that list here" is an
  // implementation detail the user should not have to see.
  const actionClass = 'text-blue-700 dark:text-blue-400 hover:underline';

  // Bound to a const so the null check below narrows it for the handler too —
  // the model promises an id whenever the bucket count is non-zero, and this is
  // how that promise is kept without a cast.
  const bucketId = health.unassignedBucketCategoryId;

  return (
    <section
      aria-labelledby="category-data-health-heading"
      className="lg:shrink-0 rounded-2xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 mb-6"
    >
      <h3
        id="category-data-health-heading"
        className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2"
      >
        Data health
      </h3>
      <ul className="space-y-1.5 text-sm text-amber-800 dark:text-amber-200">
        {health.uncategorizedCount > 0 && (
          <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span>
              <strong className="tabular-nums">{health.uncategorizedCount.toLocaleString()}</strong>{' '}
              uncategorised transaction{plural(health.uncategorizedCount)} sit outside every report
            </span>
            <span className="text-amber-700 dark:text-amber-400 tabular-nums">
              ({formatCurrency(health.uncategorizedIn)} in · {formatCurrency(health.uncategorizedOut)} out)
            </span>
            <Link
              to={preserveDemoParam('/categorisation', location.search)}
              className={actionClass}
            >
              Review and categorise
            </Link>
          </li>
        )}
        {health.unassignedBucketCount > 0 && bucketId !== null && (
          <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span>
              <strong className="tabular-nums">{health.unassignedBucketCount.toLocaleString()}</strong>{' '}
              row{plural(health.unassignedBucketCount)} still park in the import’s “Unassigned” bucket —
              file {health.unassignedBucketCount === 1 ? 'it' : 'them'} to a real category to count in reports
            </span>
            <button
              type="button"
              onClick={() => onFileUnassignedBucket(bucketId)}
              className={actionClass}
            >
              File {health.unassignedBucketCount === 1 ? 'it' : 'them'} now
            </button>
          </li>
        )}
        {health.danglingCount > 0 && (
          <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span>
              <strong className="tabular-nums">{health.danglingCount.toLocaleString()}</strong>{' '}
              row{plural(health.danglingCount)} point at a category that no longer exists — re-file{' '}
              {health.danglingCount === 1 ? 'it' : 'them'} so nothing is silently dropped
            </span>
            <Link
              to={preserveDemoParam('/categorisation', location.search)}
              className={actionClass}
            >
              Review and re-file
            </Link>
          </li>
        )}
        {health.transferFilingMismatchCount > 0 && (
          <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {/* THE CONSEQUENCE, NOT THE SYMPTOM.
                "Type and category disagree" is a fact about two fields and
                means nothing to anyone. What actually happens is that the
                category wins everywhere it counts: `classifyFlow` reads it,
                calls the row a transfer, and every report built on it — the
                dashboard, the income/expense breakdown, custom reports, top
                transactions, the export — leaves the row out of BOTH totals.
                It is not in the uncategorised review band either, because it
                has a real category id, so nothing ever asks about it. And it
                has no other side, so nothing balances it. The balance moved;
                the reports never heard. That is the sentence. */}
            <span>
              <strong className="tabular-nums">{health.transferFilingMismatchCount.toLocaleString()}</strong>{' '}
              transaction{plural(health.transferFilingMismatchCount)} carr
              {health.transferFilingMismatchCount === 1 ? 'ies' : 'y'} a transfer category with no other
              side — {health.transferFilingMismatchCount === 1 ? 'it moves' : 'they move'} the account
              balance but count as neither income nor spending in any report, and never appear in the
              review band
            </span>
            <button
              type="button"
              onClick={() => onFixTransferFilings(health.transferFilingMismatchIds)}
              className={actionClass}
            >
              Fix {health.transferFilingMismatchCount === 1 ? 'it' : 'them'} one by one
            </button>
          </li>
        )}
        {health.emptyCategoryCount > 0 && (
          <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span>
              <strong className="tabular-nums">{health.emptyCategoryCount.toLocaleString()}</strong>{' '}
              categor{health.emptyCategoryCount === 1 ? 'y has' : 'ies have'} no transactions —
              candidate{plural(health.emptyCategoryCount)} to delete and simplify your list
            </span>
            <button
              type="button"
              onClick={onShowEmptyCategories}
              className={actionClass}
            >
              Show {health.emptyCategoryCount === 1 ? 'it' : 'them'} in the tree
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
