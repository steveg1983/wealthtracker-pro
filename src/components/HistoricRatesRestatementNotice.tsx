import React, { useState } from 'react';
import { preferences } from '../services/preferencesService';
import { XIcon } from './icons';

/**
 * The one-time restatement statement (the ruling, 22 Aug §6.4).
 *
 * When per-day reference rates arrived, figures readers had already seen
 * CHANGED — a 2017 balance re-valued at 2017's rate is a different number
 * from one valued at today's. Silently restating history is precisely what
 * an app built on provability cannot do, so the affected surfaces say it
 * once, dismissibly, with the sentence that matters most last: the ledger
 * did not move, only the valuation did.
 *
 * Renders nothing for a single-currency ledger (nothing changed for them)
 * and nothing once dismissed — the dismissal is a preference, so it follows
 * the person, not the browser tab.
 */

const DISMISSAL_KEY = 'money_management_fx_history_restatement_dismissed';

export default function HistoricRatesRestatementNotice({
  visible,
  storageKey = DISMISSAL_KEY,
  children,
}: {
  /** The surface's own gate: spans currencies AND the history is in force. */
  visible: boolean;
  /**
   * A restatement is an EVENT, and each event says itself once: the balances'
   * restatement and the report flows' restatement are different changes a
   * reader met at different times, so each carries its own dismissal key.
   */
  storageKey?: string;
  /** The statement itself; the default is the balances' wording. */
  children?: React.ReactNode;
}): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return preferences.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  if (!visible || dismissed) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4">
      <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
        {children ?? (
          <>
            <span className="font-semibold text-gray-900 dark:text-white">
              Historic figures have been recalculated.
            </span>{' '}
            Balances in other currencies are now converted at the reference rate for each
            date, rather than today&rsquo;s rate, so figures may differ from what you saw
            previously. Your recorded transactions are unchanged.
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          try {
            preferences.setItem(storageKey, 'true');
          } catch {
            // The notice still leaves this render; it may reappear next
            // session, which errs on the side of saying it again.
          }
        }}
        aria-label="Dismiss this notice"
        className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}
