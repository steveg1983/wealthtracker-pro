import React, { useState } from 'react';
import type { SuggestionDismissal } from '../types';
import { readPayeeDismissalKey } from '../utils/suggestionDismissals';

/**
 * The way back from a refused payee suggestion.
 *
 * Same shape and the same promise as the sweeps' Dismissed suggestions list,
 * but it has to be its own component because a payee refusal names no rows: it
 * is about the payee TEXT, so it can only be described from the key it was
 * stored under. Sending it through the sweeps' section — which describes a
 * dismissal from the transactions it named — would render every entry as "the
 * transactions this was about are no longer in your register", which is both
 * meaningless here and untrue.
 *
 * Collapsed by default, and absent entirely when nothing has been refused: it
 * is a record of decisions already made and must not compete with the work
 * still to do above it.
 */

interface Props {
  /** Already narrowed to the payee kinds. */
  dismissals: SuggestionDismissal[];
  onRestore: (dismissal: SuggestionDismissal) => void;
  /** subjectKey of the row currently being restored, if any. */
  restoringKey: string | null;
  className?: string;
}

export default function DismissedPayeeSuggestions({
  dismissals,
  onRestore,
  restoringKey,
  className = '',
}: Props): React.JSX.Element | null {
  const [showing, setShowing] = useState(false);

  if (dismissals.length === 0) return null;

  const describe = (dismissal: SuggestionDismissal): React.JSX.Element => {
    const subject = readPayeeDismissalKey(dismissal.subjectKey);
    if (subject === null) {
      // Stored by a version that wrote a different format, or edited by hand.
      // Undoable regardless — which is the point of this list.
      return (
        <span className="text-gray-500 dark:text-gray-400">
          A suggestion this screen can no longer describe.
        </span>
      );
    }
    return (
      <>
        <span className="text-gray-900 dark:text-white break-words">
          {subject.payee ?? subject.merchant}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {subject.payee === null
            ? ' — and every payee under it'
            : ` — kept out of ${subject.merchant}`}
        </span>
      </>
    );
  };

  return (
    <section className={className}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Dismissed suggestions
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
            {dismissals.length.toLocaleString()}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => setShowing(s => !s)}
          aria-expanded={showing}
          className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {showing ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Suggestions you asked not to see again. No payee was renamed and none is hidden from the
        list above — restoring one simply offers it as a shortcut again.
      </p>
      {showing && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left pb-2 font-medium">What you left</th>
                <th className="text-left pb-2 font-medium">Your answer</th>
                <th className="text-left pb-2 font-medium">When</th>
                <th className="pb-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {dismissals.map(dismissal => (
                <tr
                  key={`${dismissal.kind}|${dismissal.subjectKey}`}
                  className="border-b border-gray-50 dark:border-gray-700/50 align-top"
                >
                  <td className="py-2 text-sm">{describe(dismissal)}</td>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {dismissal.kind === 'payee-merchant'
                      ? 'Not one merchant'
                      : 'Not part of that merchant'}
                  </td>
                  <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {dismissal.dismissedAt.toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: '2-digit',
                    })}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRestore(dismissal)}
                      disabled={restoringKey === dismissal.subjectKey}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      {restoringKey === dismissal.subjectKey ? 'Restoring…' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
