import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal, type DecimalInstance } from '../../utils/decimal';
import { getDateLocale } from '../../utils/dateFormatter';
import { preserveDemoParam } from '../../utils/navigation';
import {
  detectRecurring,
  MIN_PAYMENTS,
  type RecurringCadence,
  type RecurringDetection,
} from '../../utils/recurringDetection';

/**
 * "What I'm committed to" — recurring payments, detected from the register.
 *
 * A FINDING, not a dashboard (Claude Design handover, 17 Aug §1): the app
 * noticing something in the ledger the user hasn't. Two audiences in one —
 * the subscription audit ("what am I signed up to?") and the schedule read
 * ("what is due next?") — designed for the first, with the second falling
 * out of it.
 *
 * The design rules this page lives under, all from the handover:
 *
 * - A detection is an INFERENCE and carries its evidence in its resting
 *   state (§2): the payment count, the span, the most recent date and the
 *   next expected ARE the confidence. No percentages, ever.
 * - The number that lands is the ANNUAL equivalent (§3) — £14.99 a month is
 *   invisible; £179.88 a year is a decision.
 * - Grouped by CADENCE, not category (§4): cadence is what determines
 *   commitment. One annualisation provenance line under the headline.
 * - A price change is a DIRECTION and may wear the hues; the magnitudes
 *   stay neutral (§3.1).
 * - Stopped patterns are a band, never a silent deletion (§3.2).
 * - Read-only: this surface reads the register and never writes to it.
 *   Confirm / Not-recurring is the next slice (§5, §8 step 2).
 *
 * No period picker (usesPeriod: false in the registry): a rhythm needs the
 * whole history to be seen, and a window that hides half the payments would
 * weaken every evidence line on the page. Said on screen.
 */

const CADENCE_BANDS: ReadonlyArray<{ cadence: RecurringCadence; title: string }> = [
  { cadence: 'monthly', title: 'Monthly' },
  { cadence: 'weekly', title: 'Weekly' },
  { cadence: 'annual', title: 'Annual' },
  { cadence: 'irregular', title: 'Irregular' },
];

const monthYear = (date: Date): string =>
  date.toLocaleDateString(getDateLocale(), { month: 'short', year: 'numeric' });

const dayMonth = (date: Date): string =>
  date.toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' });

export default function RecurringCommitmentsReport(): React.JSX.Element {
  const { accounts, transactions, isLoading } = useApp();
  const { formatCurrency, displayCurrency } = useCurrencyDecimal();
  const location = useLocation();

  const accountName = useMemo(
    () => new Map(accounts.map(a => [a.id, a.name])),
    [accounts]
  );

  /**
   * Outgoing only: this page answers "what am I committed to", and a
   * commitment is money out. Recurring income (a salary) is detected too,
   * but belongs to the calendar and the forecast, not the audit.
   */
  const detections = useMemo(
    () => detectRecurring(transactions, new Date()).filter(d => d.direction === 'out'),
    [transactions]
  );

  const active = detections.filter(d => !d.stopped);
  const stopped = detections.filter(d => d.stopped);

  // Decimal throughout — these are money sums read against each other.
  const annualTotal = active.reduce(
    (sum, d) => sum.plus(d.annualEquivalent), toDecimal(0)
  );

  const bandFor = (cadence: RecurringCadence): RecurringDetection[] =>
    active.filter(d => d.cadence === cadence);

  const bandTotal = (band: RecurringDetection[]): DecimalInstance =>
    band.reduce((sum, d) => sum.plus(d.annualEquivalent), toDecimal(0));

  /** One detection, with its evidence in its resting state. */
  const DetectionRow = ({ detection }: { detection: RecurringDetection }): React.JSX.Element => {
    const account = accountName.get(detection.accountId);
    return (
      <li className="py-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-gray-50 dark:border-gray-700/50 first:border-0">
        <div className="min-w-0">
          <p className="text-body text-gray-900 dark:text-white truncate">
            {/* Into the account's register, where the payments themselves are —
                the same door every other report row opens. */}
            <Link
              to={preserveDemoParam(`/accounts/${detection.accountId}`, location.search)}
              className="hover:text-blue-700 dark:hover:text-blue-400 hover:underline rounded"
              title={account ? `${account} — open this account's register` : 'Open this account’s register'}
            >
              {detection.description}
            </Link>
          </p>
          {/* THE EVIDENCE LINE (§2) — not a tooltip, not a hover: what the
              claim rests on, where the claim is made. */}
          <p className="text-dense text-gray-500 dark:text-gray-400">
            {detection.count} payments since {monthYear(detection.firstDate)}, most
            recent {dayMonth(detection.lastDate)}
            {detection.nextExpected && <> · next expected {dayMonth(detection.nextExpected)}</>}
            {account && <> · {account}</>}
          </p>
          {detection.priceChange && (
            <p className="text-dense text-gray-500 dark:text-gray-400">
              {formatCurrency(detection.priceChange.from, displayCurrency)} →{' '}
              {formatCurrency(detection.priceChange.to, displayCurrency)} in{' '}
              {monthYear(detection.priceChange.when)} ·{' '}
              {/* The DELTA is a direction and wears the hue — costlier is
                  red, cheaper is green. The magnitudes around it stay
                  neutral (§3.1). */}
              <span className={detection.priceChange.annualDelta.greaterThan(0)
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'}>
                {detection.priceChange.annualDelta.greaterThan(0) ? '+' : '−'}
                {formatCurrency(detection.priceChange.annualDelta.abs(), displayCurrency)} a year
              </span>
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          {/* The annual figure lands; the per-payment figure explains it. */}
          <p className="text-body font-semibold tabular-nums text-gray-900 dark:text-white">
            {formatCurrency(detection.annualEquivalent, displayCurrency)} a year
          </p>
          <p className="text-dense tabular-nums text-gray-500 dark:text-gray-400">
            {formatCurrency(detection.amount, displayCurrency)} {detection.cadenceLabel}
          </p>
        </div>
      </li>
    );
  };

  // Skeleton at the real row height, three rows, no pulse (§6) — detection
  // over a long history is one of the few loads that will actually be seen.
  if (isLoading && transactions.length === 0) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-[72px] bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-line dark:border-gray-700">
        <h2 className="text-label uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400">
          Committed each year
        </h2>
        {/* The page's one earned total: "how much of my year is already
            spoken for?" is a question people genuinely ask (§3). */}
        <p className="text-page font-bold mt-1 tabular-nums">
          {formatCurrency(annualTotal, displayCurrency)}
        </p>
        <p className="text-dense text-gray-500 dark:text-gray-400 mt-1">
          {active.length === 1 ? '1 recurring payment' : `${active.length} recurring payments`}
          {' '}— weekly and monthly items annualised, read from your whole history.
          These are patterns the app has noticed, not entries you made: each one
          shows the payments it rests on.
        </p>
      </div>

      {transactions.length === 0 ? (
        /* CONSEQUENCE, THEN REMEDY (§6): a fresh ledger cannot show rhythm. */
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <p className="text-body text-gray-500 dark:text-gray-400">
            Recurring payments are found by looking for the same amount arriving
            on the same rhythm, so this needs a few months of history before it
            can tell you anything.{' '}
            <Link
              to={preserveDemoParam('/enhanced-import', location.search)}
              className="text-primary hover:underline"
            >
              Import a statement →
            </Link>
          </p>
        </div>
      ) : detections.length === 0 ? (
        /* History, nothing found — a genuine finding, not a failure (§6),
           said with what it looked for. */
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <p className="text-body text-gray-500 dark:text-gray-400">
            Nothing here repeats. The app looked for {MIN_PAYMENTS} or more
            payments of the same amount to the same payee on a steady rhythm,
            and found none — which may be exactly right.
          </p>
        </div>
      ) : (
        <>
          {CADENCE_BANDS.map(({ cadence, title }) => {
            const band = bandFor(cadence);
            if (band.length === 0) return null;
            return (
              <div key={cadence} className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h2 className="text-card font-semibold text-theme-heading dark:text-white">
                    {title}
                    <span className="ml-2 text-dense font-normal text-gray-400 dark:text-gray-500">
                      {band.length}
                    </span>
                  </h2>
                  <span className="text-body font-semibold tabular-nums text-gray-900 dark:text-white">
                    {formatCurrency(bandTotal(band), displayCurrency)} a year
                  </span>
                </div>
                <ul>
                  {band.map(d => <DetectionRow key={d.key} detection={d} />)}
                </ul>
              </div>
            );
          })}

          {stopped.length > 0 && (
            /* Ran, and then didn't (§3.2) — either cancelled (good to know)
               or failed (good to look at). Never silently deleted. */
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <h2 className="text-card font-semibold text-theme-heading dark:text-white">
                  Stopped
                  <span className="ml-2 text-dense font-normal text-gray-400 dark:text-gray-500">
                    {stopped.length}
                  </span>
                </h2>
                <span className="text-dense text-gray-500 dark:text-gray-400">
                  Ran on a rhythm, then didn't — cancelled, or worth a look
                </span>
              </div>
              <ul>
                {stopped.map(d => (
                  <li key={d.key} className="py-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-gray-50 dark:border-gray-700/50 first:border-0">
                    <div className="min-w-0">
                      <p className="text-body text-gray-900 dark:text-white truncate">
                        <Link
                          to={preserveDemoParam(`/accounts/${d.accountId}`, location.search)}
                          className="hover:text-blue-700 dark:hover:text-blue-400 hover:underline rounded"
                        >
                          {d.description}
                        </Link>
                      </p>
                      <p className="text-dense text-gray-500 dark:text-gray-400">
                        {d.count} payments, {d.cadenceLabel} · last seen {dayMonth(d.lastDate)} {d.lastDate.getFullYear()}
                        {accountName.get(d.accountId) && <> · {accountName.get(d.accountId)}</>}
                      </p>
                    </div>
                    <p className="text-dense tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                      was {formatCurrency(d.amount, displayCurrency)} {d.cadenceLabel}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
