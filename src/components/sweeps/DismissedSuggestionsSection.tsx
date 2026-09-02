import React, { useState } from 'react';
import type { DismissalKind, SuggestionDismissal, Transaction } from '../../types';
import { getDateLocale } from '../../utils/dateFormatter';
import { formatCount } from '../../utils/localeFormat';

/**
 * The way back. Every persistent refusal is listed here with a Restore beside
 * it, so telling a sweep "never again" is never a one-way door — the user can
 * see exactly what they have hidden, and un-hide any of it.
 *
 * Collapsed by default and absent entirely when nothing is dismissed: this is a
 * record of decisions already made, and it must not compete with the work still
 * to do above it.
 *
 * A dismissal is described from the transactions it named. When those rows have
 * since been deleted the entry says so plainly rather than showing a blank: it
 * is spent — the suggestion can never be offered again — and restoring it just
 * clears the record away.
 */

const KIND_LABELS: Record<DismissalKind, string> = {
  'transfer-pair': 'Not a transfer pair',
  'transfer-leg': 'Not a match for that split line',
  stranded: 'Left as it is',
  duplicate: 'Not a duplicate',
  // Payee cleanup owns its own list (DismissedPayeeSuggestions): these are
  // refusals about payee TEXT and carry no rows, so this section — which
  // describes a dismissal from the transactions it named — cannot show them.
  // Labelled all the same, so the three kinds can never reach a sweep unnamed.
  'payee-merchant': 'Not one merchant',
  'payee-line': 'Not part of that merchant',
  'payee-hidden': 'Hidden from payee cleanup',
  // The recurring verdicts likewise live on their own surface — the "What
  // I'm committed to" report shows Confirmed in place and Not-recurring in
  // its own restorable band — and, like the payee kinds, they name no rows.
  'recurring-confirmed': 'Confirmed as recurring',
  'recurring-not': 'Not recurring',
  'forecast-excluded': 'Excluded from the forecast base',
};

interface Props {
  /** Already narrowed to the kinds this surface owns. */
  dismissals: SuggestionDismissal[];
  transactionsById: Map<string, Transaction>;
  accountName: (id: string) => string;
  formatCurrency: (amount: number) => string;
  onRestore: (dismissal: SuggestionDismissal) => void;
  /** subjectKey of the row currently being restored, if any. */
  restoringKey: string | null;
  className?: string;
}

export default function DismissedSuggestionsSection({
  dismissals,
  transactionsById,
  accountName,
  formatCurrency,
  onRestore,
  restoringKey,
  className = '',
}: Props): React.JSX.Element | null {
  const [showing, setShowing] = useState(false);

  if (dismissals.length === 0) return null;

  const describe = (dismissal: SuggestionDismissal): React.JSX.Element => {
    const rows = dismissal.subjectIds
      .map(id => transactionsById.get(id))
      .filter((row): row is Transaction => row !== undefined);

    if (rows.length === 0) {
      return (
        <span className="text-gray-500 dark:text-gray-400">
          The transactions this was about are no longer in your register.
        </span>
      );
    }

    const [first] = rows;
    return (
      <>
        <span className="text-gray-900 dark:text-white">{first.description}</span>
        <span className="text-gray-500 dark:text-gray-400">
          {' — '}
          {formatCurrency(Math.abs(first.amount))}
          {', '}
          {accountName(first.accountId)}
          {', '}
          {new Date(first.date).toLocaleDateString(getDateLocale(), {
            day: '2-digit', month: 'short', year: '2-digit',
          })}
          {rows.length > 1 && ` and ${rows.length - 1} other row${rows.length > 2 ? 's' : ''}`}
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
            {formatCount(dismissals.length)}
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
        Suggestions you asked not to see again. Nothing here was deleted or changed — restoring
        one simply puts it back in the list above the next time this runs.
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
                    {KIND_LABELS[dismissal.kind]}
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
