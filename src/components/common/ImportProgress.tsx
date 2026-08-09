import React from 'react';

/**
 * What an import is doing, while it is doing it.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * Pressing "Import Transactions" on a 183-row statement used to leave the
 * dialog completely still for ten seconds: no count, no bar, nothing to say the
 * click had even been accepted. A person watching that has no way to tell a
 * slow import from a frozen one, and the only action available is to press the
 * button again.
 *
 * ── HONESTY OVER DECORATION ─────────────────────────────────────────────────
 * A percentage is only drawn from a number the writing path actually reported.
 * The cloud path posts in chunks and reports after each one
 * (transactionImportService.importInChunks → onProgress), so it can be
 * measured. A local write is ONE all-or-nothing IndexedDB transaction: there is
 * no honest fraction of it, so nothing pretends there is — the bar is
 * indeterminate and the text names the size of the job instead. A bar creeping
 * towards 90% on a timer is a lie, and the one time it matters it is the lie
 * that keeps somebody waiting on a write that already failed.
 *
 * Nothing has landed yet is also indeterminate: "0 of 183" beside an empty bar
 * reads as stuck, which is precisely the impression this exists to remove.
 */

interface ImportProgressProps {
  /** Rows written so far, or null when the writing path cannot say. */
  inserted: number | null;
  /** Rows this import is writing, when that is known before it starts. */
  total: number | null;
  /** What is being counted. Plural, lower case — "183 transactions". */
  noun?: string;
}

export default function ImportProgress({
  inserted,
  total,
  noun = 'transactions',
}: ImportProgressProps): React.JSX.Element {
  // Narrowed to values rather than flags, so the strings below cannot be
  // written against a number that might not be there.
  const jobSize = total !== null && total > 0 ? total : null;
  const written = jobSize !== null && inserted !== null && inserted > 0 ? inserted : null;
  const percent = jobSize !== null && written !== null
    ? Math.min(100, Math.round((written / jobSize) * 100))
    : null;

  const label = jobSize !== null && written !== null
    ? `Importing… ${written.toLocaleString()} of ${jobSize.toLocaleString()} ${noun}`
    : jobSize !== null
      ? `Importing ${jobSize.toLocaleString()} ${noun}…`
      : 'Importing…';

  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        {/* role="status" carries aria-live="polite" implicitly, so a screen
            reader hears each update without the page stealing focus. */}
        <p role="status" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
        </p>
        {percent !== null && (
          <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{percent}%</span>
        )}
      </div>
      <div
        className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden"
        role="progressbar"
        aria-label={label}
        // An indeterminate progressbar states no value: per ARIA, omitting
        // aria-valuenow is what tells assistive tech the progress is unknown.
        aria-valuemin={percent === null ? undefined : 0}
        aria-valuemax={percent === null ? undefined : 100}
        aria-valuenow={percent ?? undefined}
      >
        {percent === null ? (
          // Alive, but claiming nothing. Stilled for anyone who has asked the
          // system for less motion.
          <div className="h-full w-full bg-[#1a2332]/30 dark:bg-blue-500/30 animate-pulse motion-reduce:animate-none" />
        ) : (
          <div
            className="h-full bg-[#1a2332] dark:bg-blue-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Leave this window open until it finishes.
      </p>
    </div>
  );
}
