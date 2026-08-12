import React from 'react';
import EmptyState from './EmptyState';

interface FilteredEmptyStateProps {
  /** How many rows exist here that the filters are currently hiding. */
  hiddenCount: number;
  /**
   * The filters responsible, named the way the user set them
   * ("Category: Travel", "This month"). One phrase each — this is the list
   * that turns "gone" back into "hidden".
   */
  filters: string[];
  /** Puts every one of them away. */
  onClear: () => void;
  /** Where the hidden rows are, for the sentence. */
  scope?: string;
  className?: string;
}

/** "A, B and C" — the filters read as a sentence, not a comma-separated dump. */
function joinFilters(names: string[]): React.ReactNode {
  return names.map((name, index) => (
    <React.Fragment key={name}>
      {index > 0 && (index === names.length - 1 ? ' and ' : ', ')}
      <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
    </React.Fragment>
  ));
}

/**
 * FILTERED-EMPTY IS NOT EMPTY (DESIGN_PASS §4).
 *
 * The most alarming bug a finance app can fake is "my transactions are gone",
 * and a filter that hides every row fakes it perfectly: the register goes
 * white and says nothing about why. So this state always names the two facts
 * that make it survivable — HOW MANY are hidden, and WHICH FILTERS are hiding
 * them — and then offers the one control that undoes it.
 *
 *   No transactions match these filters
 *   1,284 in this account are hidden by Category: Travel and This month.
 *   [Clear filters]
 *
 * The count is deliberately of rows that EXIST: it is the sentence that says
 * the data is still there.
 */
export default function FilteredEmptyState({
  hiddenCount,
  filters,
  onClear,
  scope = 'in this account',
  className = ''
}: FilteredEmptyStateProps): React.JSX.Element {
  return (
    <EmptyState
      className={className}
      title="No transactions match these filters"
      description={
        <>
          <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
            {hiddenCount.toLocaleString()}
          </span>
          {` ${scope} ${hiddenCount === 1 ? 'is' : 'are'} hidden by `}
          {filters.length > 0 ? joinFilters(filters) : 'the filters you have set'}.
        </>
      }
      action={{
        label: 'Clear filters',
        onClick: onClear,
        // No plus: this remedy takes something away.
        icon: null
      }}
    />
  );
}
