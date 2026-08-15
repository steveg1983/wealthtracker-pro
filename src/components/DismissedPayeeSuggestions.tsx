import React, { useState } from 'react';
import type { PayeeDismissalKind, SuggestionDismissal } from '../types';
import { isPayeeDismissalKind, readPayeeDismissalKey } from '../utils/suggestionDismissals';
import { getDateLocale } from '../utils/dateFormatter';

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

/**
 * What the user answered, in the words of the button they pressed — and, since
 * the three refusals have three different consequences, in words that say which
 * one this was. Keyed by the payee kinds alone, so a fourth kind is a compile
 * error here rather than a blank column.
 */
const ANSWERS: Record<PayeeDismissalKind, string> = {
  'payee-merchant': 'Not one merchant',
  'payee-line': 'Not part of that merchant',
  'payee-hidden': 'Hidden from this page',
};

/** What restoring this entry will bring back, said before it is pressed. */
const RESTORES_TO: Record<PayeeDismissalKind, string> = {
  'payee-merchant': 'Restore offers the grouping again',
  'payee-line': 'Restore puts the payee back in that grouping',
  'payee-hidden': 'Restore puts the payee back in the list',
};

/**
 * A dismissal saved by a version that knew a kind this one does not is still
 * the user's decision and still theirs to undo, so it is described in the
 * vaguest words that stay true rather than dropped from the list.
 */
const answerFor = (kind: SuggestionDismissal['kind']): string =>
  isPayeeDismissalKind(kind) ? ANSWERS[kind] : 'Left out in future';

const restoresTo = (kind: SuggestionDismissal['kind']): string =>
  isPayeeDismissalKind(kind) ? RESTORES_TO[kind] : 'Restore offers it again';

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
    // Three shapes, three consequences: a merchant with no payee is the whole
    // grouping refused; a payee with no merchant is a payee struck off the
    // screen; both together is one payee kept out of one grouping.
    const scope = subject.payee === null
      ? ' — and every payee under it'
      : subject.merchant === null
        ? ' — hidden from this page and from every suggestion on it'
        : ` — kept out of ${subject.merchant}`;
    return (
      <>
        <span className="text-gray-900 dark:text-white break-words">
          {subject.payee ?? subject.merchant}
        </span>
        <span className="text-gray-500 dark:text-gray-400">{scope}</span>
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
        Suggestions you refused, and payees you asked this page to stop listing. Nothing was
        renamed and no transaction changed — restoring one brings it straight back above.
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
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                    {/* Which of the three refusals this was, and — because they
                        undo to three different things — what pressing Restore
                        beside it will bring back. */}
                    <span className="block whitespace-nowrap">{answerFor(dismissal.kind)}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {restoresTo(dismissal.kind)}
                    </span>
                  </td>
                  <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {dismissal.dismissedAt.toLocaleDateString(getDateLocale(), {
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
