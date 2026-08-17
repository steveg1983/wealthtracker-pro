import React, { useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { PieChart, ResponsiveContainer } from '../../components/charts/DashboardCharts';
import { categoricalColor, useCategoricalRamp } from '../../components/charts/chartColors';
import { computeAccountBalances } from '../../utils/accountBalances';
import {
  ACCOUNT_DISTRIBUTION_REMAINDER_ID,
  buildAccountDistribution,
  type AccountDistributionEntry,
} from '../../utils/accountDistribution';
import { formatDecimal } from '../../utils/decimal-format';
import { preserveDemoParam } from '../../utils/navigation';

/**
 * "Account distribution" — where the money actually sits, account by account.
 *
 * The full page behind the Dashboard's card. Both read one implementation
 * (utils/accountDistribution) over one balance map
 * (utils/accountBalances.computeAccountBalances), so the glance and the page
 * can never disagree about a figure or a ranking. The card shows the five
 * largest; this lists EVERY account.
 *
 * No period picker, deliberately (usesPeriod: false in the registry): these are
 * the balances the accounts hold now, and there is no "distribution last March"
 * to draw. Said on screen rather than left to be inferred.
 *
 * Zero balances are listed — an account holding nothing is part of the answer.
 * Closed accounts are not, because they are never loaded.
 */

export default function AccountDistributionReport(): React.JSX.Element {
  const { accounts, transactions, serverBalances } = useApp();
  const { formatCurrency, displayCurrency } = useCurrencyDecimal();
  const location = useLocation();
  const navigate = useNavigate();
  // Where a click on the remainder slice lands: the table that lists every
  // account the slice folded. It has no single register to open.
  const everyAccountRef = useRef<HTMLDivElement>(null);
  // The shared ramp. This file used to carry its own copy of the recharts demo
  // palette with a comment promising it matched the Dashboard's — a promise
  // nothing checked, and exactly the drift the one-module rule removes.
  const ramp = useCategoricalRamp();

  const distribution = useMemo(() => {
    const balances = computeAccountBalances(accounts, transactions, serverBalances);
    return buildAccountDistribution(accounts, id => balances.get(id) ?? 0);
  }, [accounts, transactions, serverBalances]);

  /** Which colour each drawn slice got, so the table's swatches match the donut. */
  const sliceColours = useMemo(
    () => new Map(distribution.slices.map((entry, index) => [entry.id, categoricalColor(ramp, index)])),
    [distribution.slices, ramp]
  );

  // The account's register, not the retired global list filtered to it.
  const transactionsHref = (accountId: string): string =>
    preserveDemoParam(`/accounts/${accountId}`, location.search);

  const money = (value: number): string =>
    formatCurrency(value, displayCurrency);

  const shareOf = (entry: AccountDistributionEntry): string =>
    entry.share ? `${formatDecimal(entry.share, 1)}%` : '—';

  const headCell = 'px-4 py-2 text-dense font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-line dark:border-gray-700">
          <p className="text-label uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400">Held in credit</p>
          <p className="text-page font-bold mt-1">{money(distribution.inCreditTotal.toNumber())}</p>
          {/* What every share below is a share OF, said once. */}
          <p className="text-dense text-gray-500 dark:text-gray-400 mt-1">Current balances — every share below is of this total</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-line dark:border-gray-700">
          <p className="text-dense text-gray-500 uppercase tracking-wider font-medium">Accounts</p>
          <p className="text-page font-bold mt-1 text-gray-900 dark:text-white">
            {distribution.entries.length.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-line dark:border-gray-700">
          <p className="text-dense text-gray-500 uppercase tracking-wider font-medium">Largest holding</p>
          <p className="text-page font-bold mt-1 text-gray-900 dark:text-white truncate">
            {distribution.slices.length > 0 ? shareOf(distribution.slices[0]) : '—'}
          </p>
          <p className="text-dense text-gray-500 dark:text-gray-400 mt-1 truncate">
            {distribution.slices.length > 0 ? distribution.slices[0].name : 'Nothing in credit'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 className="text-card font-semibold text-theme-heading dark:text-white">
            Where the money sits
          </h2>
          <span className="text-dense text-gray-400 dark:text-gray-500">Current balances</span>
        </div>
        {/* The count comes from the slices themselves, never the cap: with
            three accounts in credit this must not claim five. And when the
            ring folds a remainder (Design, 17 Aug §2.1 — a closed ring is a
            claim about the whole), the sentence says what was folded. */}
        <p className="text-body text-gray-500 dark:text-gray-400 mb-4">
          {distribution.slices.length === 1
            ? 'The one account in credit'
            : distribution.foldedCount > 0
              ? `The ${distribution.slices.length - 1} largest accounts in credit, with the other ${distribution.foldedCount} gathered into one slice`
              : `The ${distribution.slices.length} largest accounts in credit`}
          {' '}— the same slices the Dashboard shows. Every account is listed below.
          Click a slice for its transactions.
        </p>
        {distribution.slices.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No account is in credit</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart
                data={distribution.slices}
                innerRadius={true}
                colors={ramp}
                onClick={(entry: AccountDistributionEntry) => {
                  if (entry.id === ACCOUNT_DISTRIBUTION_REMAINDER_ID) {
                    everyAccountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    navigate(transactionsHref(entry.id));
                  }
                }}
                formatter={(value: number) => money(value)}
                aria-label="Pie chart showing distribution of account balances"
              />
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div ref={everyAccountRef} className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700">
        <div className="p-6 pb-3">
          <h2 className="text-card font-semibold text-theme-heading dark:text-white">Every account</h2>
          <p className="text-body text-gray-500 dark:text-gray-400 mt-1">
            Ranked by what it holds now. Click an account to see its transactions.
          </p>
        </div>

        {distribution.entries.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No accounts yet</p>
        ) : (
          /* The table scrolls inside its own box; the page never scrolls sideways. */
          <div className="overflow-x-auto rounded-b-2xl">
            <table className="min-w-full text-body">
              <caption className="sr-only">
                Every account ranked by its current balance, with each account&apos;s share of the total held in credit
              </caption>
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th scope="col" className={`${headCell} text-left min-w-[220px]`}>Account</th>
                  <th scope="col" className={`${headCell} text-right`}>Balance</th>
                  <th scope="col" className={`${headCell} text-right`}>Share</th>
                </tr>
              </thead>
              <tbody>
                {distribution.entries.map(entry => (
                  <tr key={entry.id} className="border-t border-gray-50 dark:border-gray-700/50">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <span className="flex items-center gap-2">
                        {/* Only the NAMED slices carry a colour. The folded
                            accounts are in the ring collectively, but ninety
                            rows all wearing the remainder's colour would claim
                            each was drawn individually — so they stay bare. */}
                        <span
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: sliceColours.get(entry.id) ?? 'transparent' }}
                          aria-hidden="true"
                        />
                        <Link
                          to={transactionsHref(entry.id)}
                          className="text-body text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 hover:underline rounded"
                          title={`${entry.name} — view these transactions`}
                        >
                          {entry.name}
                        </Link>
                      </span>
                    </th>
                    <td
                      className={`px-4 py-2 text-body text-right font-semibold tabular-nums whitespace-nowrap ${
                        entry.value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {money(entry.value)}
                    </td>
                    <td className="px-4 py-2 text-body text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {shareOf(entry)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <th scope="row" className="px-4 py-3 text-left text-body font-semibold text-gray-900 dark:text-white">
                    Held in credit
                  </th>
                  <td className="px-4 py-3 text-body text-right font-bold tabular-nums text-gray-900 dark:text-white">
                    {money(distribution.inCreditTotal.toNumber())}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* An overdrawn account has no share of a positive total, and saying so
            is better than printing a negative percentage nobody can read. */}
        {distribution.entries.some(entry => entry.value <= 0) && (
          <p className="px-6 pb-6 pt-3 text-dense text-gray-500 dark:text-gray-400">
            Accounts holding nothing, or overdrawn, are listed with no share: a share of the money
            held is only meaningful for money held. The total above is what is in credit, so it is
            not your net worth — see the Net worth report for what you own less what you owe.
          </p>
        )}
      </div>
    </div>
  );
}
