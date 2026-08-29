import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { computeIncomeExpense } from '../../utils/incomeExpense';
import { preserveDemoParam } from '../../utils/navigation';
import { preferences } from '../../services/preferencesService';
import { CheckCircleIcon, XIcon } from '../icons';

/**
 * FIRST STEPS — the thread between the empty states (owner, 26 Aug: "more
 * of a walk through?").
 *
 * Each page already handles its own emptiness well: an empty Accounts page
 * says what is absent, the consequence, and carries the Add Account button
 * in the message. What nothing did was walk the JOURNEY — account →
 * transactions → categories → reports — so a new user finished each remedy
 * with no pointer to the next.
 *
 * This is a checklist, not a tour. The house rulings would not wear coach
 * marks (floating pointers are attention-demands, and motion answers to the
 * same rule as colour), and a tour narrates the app instead of letting the
 * app speak. A checklist states the three things a ledger needs before its
 * reports mean anything, and links each to the page where it is done.
 *
 * ─ EVERY TICK IS DERIVED, NEVER STORED ─────────────────────────────────
 * A step is complete when the DATA says so — an account exists, a
 * transaction exists, nothing is left unfiled — the same rule as the
 * save-as-default tick and for the same reason: stored progress can lie,
 * derived progress cannot. It also means no "new user" flag exists
 * anywhere: a seasoned ledger derives all three ticks and the card stands
 * down by itself, and restoring a backup onto a fresh browser is
 * recognised as the seasoned ledger it is.
 *
 * The one stored bit is the DISMISSAL, because a dismissal is a choice,
 * not a fact about the ledger (the PageTip rule). In preferences rather
 * than localStorage so the choice travels with the user.
 *
 * The categorise step reads `uncategorizedRows.length` and no money figure
 * — the census's 'counts-only' state, recorded in its ledger.
 */

const DISMISSED_KEY = 'firstStepsDismissed';

export default function FirstSteps(): React.JSX.Element | null {
  const { accounts, transactions, transactionSplits, categories } = useApp();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(
    () => preferences.getItem(DISMISSED_KEY) === 'true'
  );

  const hasAccount = accounts.length > 0;
  const hasTransactions = transactions.length > 0;

  // Counts only — see the header. Skipped entirely until there is anything
  // to count, so an empty ledger pays nothing for this.
  const allFiled = useMemo(() => {
    if (!hasTransactions) return false;
    return computeIncomeExpense(transactions, transactionSplits, categories)
      .uncategorizedRows.length === 0;
  }, [hasTransactions, transactions, transactionSplits, categories]);

  const steps = [
    {
      done: hasAccount,
      label: 'Add your first account',
      detail: 'Everything is built up from accounts.',
      to: '/accounts?action=add',
    },
    {
      done: hasTransactions,
      label: 'Add or import transactions',
      detail: 'Type them in, or bring history from Microsoft Money, CSV, QIF or OFX.',
      to: '/import',
    },
    {
      done: allFiled,
      label: 'Categorise them',
      detail: 'A transaction with no category is left out of every total.',
      to: '/categorisation',
    },
  ];

  // Stands down by itself the moment the ledger is under way — no flag,
  // no memory, just the data. Hidden while dismissed, obviously.
  if (dismissed || steps.every(step => step.done)) return null;

  const handleDismiss = (): void => {
    preferences.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <section
      aria-labelledby="first-steps-heading"
      data-testid="first-steps"
      className="bg-white dark:bg-gray-800 rounded-2xl border border-line dark:border-gray-700 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="first-steps-heading" className="text-card font-semibold text-gray-900 dark:text-white">
          First steps
        </h2>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss first steps"
          className="p-1 -m-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <XIcon size={16} />
        </button>
      </div>

      <ol className="mt-3 space-y-2.5">
        {steps.map(step => (
          <li key={step.label} className="flex items-start gap-2.5">
            {/* A settled step is settled, not celebrated: the tick is quiet
                (colour marks what needs attention, and a done step needs
                none). The NEXT undone step carries the link. */}
            <CheckCircleIcon
              size={18}
              aria-hidden="true"
              className={`mt-0.5 shrink-0 ${
                step.done ? 'text-gray-400 dark:text-gray-500' : 'text-gray-200 dark:text-gray-600'
              }`}
            />
            <div className="min-w-0">
              {step.done ? (
                <span className="text-body text-gray-400 dark:text-gray-500 line-through decoration-1">
                  {step.label}
                </span>
              ) : (
                <>
                  {/* The underline is the whole hover: this link declines a
                      resting colour on purpose (the step's ink is the page's),
                      and an underline IS the link — see
                      ACCOUNT_ROW_NAME_LINK_CLASS, which reached the same
                      answer under the same ruling, 28 Aug 2026. */}
                  <Link
                    to={preserveDemoParam(step.to, location.search)}
                    className="text-body font-medium text-gray-900 dark:text-white hover:underline rounded"
                  >
                    {step.label}
                  </Link>
                  <span className="block text-dense text-gray-500 dark:text-gray-400">
                    {step.detail}
                  </span>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-3 pt-3 border-t border-line dark:border-gray-700 text-dense text-gray-500 dark:text-gray-400">
        Then the{' '}
        <Link
          to={preserveDemoParam('/reports', location.search)}
          className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200 rounded"
        >
          reports
        </Link>{' '}
        are yours — every figure traceable to a line you entered.
      </p>
    </section>
  );
}
