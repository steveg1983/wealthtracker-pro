import React from 'react';
import { RefreshCwIcon } from './icons';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

/**
 * The mark that follows a pull-to-refresh gesture down the page.
 *
 * Renders NOTHING at rest, and nothing at all outside an installed app — see
 * hooks/usePullToRefresh for why the gesture exists and why it is confined to
 * one. A browser tab has Safari's own pull-to-refresh and needs no second one.
 *
 * ── WHY IT IS NOT THE `.pull-to-refresh-indicator` CSS THAT WAS ALREADY HERE ─
 *
 * `src/index.css` carried rules for this since long before today, orphaned:
 * nothing in the app has ever referenced them. They were also written against
 * an older design — `background: white` with no dark variant, which would have
 * put a white disc on a gray-900 page, and an ambient `box-shadow` of the kind
 * `styles/borders.css` was cut back to remove. Reviving them would have meant
 * shipping a bug the design pass had already ruled out. Deleted with this
 * commit rather than left for the next reader to wonder about.
 */
export default function PullToRefreshIndicator(): React.JSX.Element | null {
  const { distance, refreshing, ready } = usePullToRefresh();

  if (distance === 0 && !refreshing) return null;

  return (
    <div
      // `fixed`, so it hangs over the page rather than displacing it: a pull
      // that pushed the layout down would fight the scroll it is riding on.
      className="fixed left-1/2 z-50 -translate-x-1/2 pointer-events-none"
      style={{
        // The safe-area inset is what keeps it clear of the iOS clock — the
        // same reason Layout's own top chrome carries it. An indicator that
        // appears from under the status bar is the bug this app already had.
        top: `calc(env(safe-area-inset-top, 0px) + ${Math.round(distance)}px - 40px)`,
      }}
      // The gesture is a shortcut for reloading, and a screen reader user has
      // the browser's own reload. Announcing a decorative disc mid-drag would
      // be noise, so the whole thing is hidden from the tree.
      aria-hidden="true"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white shadow-overlay dark:border-gray-700 dark:bg-gray-800">
        <RefreshCwIcon
          size={18}
          className={`text-gray-500 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
          // Turns with the pull, so the gesture has a readout before it has a
          // result — and lands upright exactly as it becomes releasable.
          style={refreshing ? undefined : { transform: `rotate(${Math.round(distance * 2.5)}deg)` }}
        />
      </div>
      {/* Ready is said by WEIGHT, not colour: nothing here needs attention,
          it is a control reporting its own state (P3). */}
      <p className={`mt-1 whitespace-nowrap text-center text-label ${
        ready ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
      }`}>
        {refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}
      </p>
    </div>
  );
}
