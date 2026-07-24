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
 * uncategorised figure here matches the review band on the report its link goes
 * to, transaction for transaction.
 */
export default function CategoryDataHealthPanel({
  health,
}: {
  health: CategoryHealth;
}): React.JSX.Element | null {
  const { formatCurrency } = useCurrencyDecimal();
  const location = useLocation();

  if (!health.hasWarnings) return null;

  const plural = (count: number): string => (count === 1 ? '' : 's');

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
              to={preserveDemoParam('/reports/monthly-income-expenses', location.search)}
              className="text-blue-700 dark:text-blue-400 hover:underline"
            >
              Review and categorise
            </Link>
          </li>
        )}
        {health.unassignedBucketCount > 0 && (
          <li>
            <strong className="tabular-nums">{health.unassignedBucketCount.toLocaleString()}</strong>{' '}
            row{plural(health.unassignedBucketCount)} still park in the import’s “Unassigned” bucket —
            file {health.unassignedBucketCount === 1 ? 'it' : 'them'} to a real category to count in reports
          </li>
        )}
        {health.danglingCount > 0 && (
          <li>
            <strong className="tabular-nums">{health.danglingCount.toLocaleString()}</strong>{' '}
            row{plural(health.danglingCount)} point at a category that no longer exists — re-file{' '}
            {health.danglingCount === 1 ? 'it' : 'them'} so nothing is silently dropped
          </li>
        )}
        {health.emptyCategoryCount > 0 && (
          <li>
            <strong className="tabular-nums">{health.emptyCategoryCount.toLocaleString()}</strong>{' '}
            categor{health.emptyCategoryCount === 1 ? 'y has' : 'ies have'} no transactions —
            candidate{plural(health.emptyCategoryCount)} to delete and simplify your list
          </li>
        )}
      </ul>
    </section>
  );
}
