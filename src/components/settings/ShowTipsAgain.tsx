import React, { useState } from 'react';
import { resetDismissedPageTips } from '../../utils/pageTips';

/**
 * The way back from "don't show this again".
 *
 * Dismissing a page tip is permanent per browser, which is fine until the tip
 * is corrected — so the dismissals have to be forgettable. Deliberately small:
 * this is a preference, not a feature.
 */
export default function ShowTipsAgain(): React.JSX.Element {
  // null = not pressed yet. A number, including 0, means we have something
  // honest to report back.
  const [restoredCount, setRestoredCount] = useState<number | null>(null);

  const handleShowAgain = (): void => {
    setRestoredCount(resetDismissedPageTips());
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Page Tips</h3>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white">Show tips again</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Brings back the short guidance panels you have dismissed.
          </p>
        </div>
        <button
          type="button"
          onClick={handleShowAgain}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Show tips again
        </button>
      </div>

      {/* Confirms what actually happened — a count, not a cheerful "Done!"
          over a no-op. role=status so it is announced, not just seen. */}
      {restoredCount !== null && (
        <p role="status" className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {restoredCount === 0
            ? 'No tips were hidden — every page tip already shows.'
            : restoredCount === 1
              ? '1 tip will show again the next time you open its page.'
              : `${restoredCount} tips will show again the next time you open their pages.`}
        </p>
      )}
    </div>
  );
}
