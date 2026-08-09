import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { PieChart, ResponsiveContainer } from '../../components/charts/DashboardCharts';
import { computeAccountBalances } from '../../utils/accountBalances';
import {
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

/** The same five colours the Dashboard card uses, in the same order. */
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AccountDistributionReport(): React.JSX.Element {
  const { accounts, transactions, serverBalances } = useApp();
  const { formatCurrency, displayCurrency } = useCurrencyDecimal();
  const location = useLocation();
  const navigate = useNavigate();

  const distribution = useMemo(() => {
    const balances = computeAccountBalances(accounts, transactions, serverBalances);
    return buildAccountDistribution(accounts, id => balances.get(id) ?? 0);
  }, [accounts, transactions, serverBalances]);

  /** Which colour each drawn slice got, so the table's swatches match the donut. */
  const sliceColours = useMemo(
    () => new Map(distribution.slices.map((entry, index) => [entry.id, COLORS[index % COLORS.length]])),
    [distribution.slices]
  );

  const transactionsHref = (accountId: string): string =>
    preserveDemoParam(`/transactions?account=${accountId}`, location.search);

  const money = (value: number): string =>
    formatCurrency(value, displayCurrency);

  const shareOf = (entry: AccountDistributionEntry): string =>
    entry.share ? `${formatDecimal(entry.share, 1)}%` : '—';

  const headCell = 'px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1a2332] dark:bg-gray-700 rounded-2xl p-6 text-white">
          <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Held in credit</p>
          <p className="text-2xl font-bold mt-1">{money(distribution.inCreditTotal.toNumber())}</p>
          {/* What every share below is a share OF, said once. */}
          <p className="text-xs text-white/60 mt-1">Current balances — every share below is of this total</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Accounts</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {distribution.entries.length.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Largest holding</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white truncate">
            {distribution.slices.length > 0 ? shareOf(distribution.slices[0]) : '—'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
            {distribution.slices.length > 0 ? distribution.slices[0].name : 'Nothing in credit'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">
            Where the money sits
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">Current balances</span>
        </div>
        {/* The count comes from the slices themselves, never the cap: with
            three accounts in credit this must not claim five. */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {distribution.slices.length === 1
            ? 'The one account in credit'
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
                colors={COLORS}
                onClick={(entry: AccountDistributionEntry) => navigate(transactionsHref(entry.id))}
                formatter={(value: number) => money(value)}
                aria-label="Pie chart showing distribution of account balances"
              />
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">Every account</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ranked by what it holds now. Click an account to see its transactions.
          </p>
        </div>

        {distribution.entries.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No accounts yet</p>
        ) : (
          /* The table scrolls inside its own box; the page never scrolls sideways. */
          <div className="overflow-x-auto rounded-b-2xl">
            <table className="min-w-full text-sm">
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
                        {/* Only the drawn slices carry a colour — a swatch for a
                            row the chart does not show would point at nothing. */}
                        <span
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: sliceColours.get(entry.id) ?? 'transparent' }}
                          aria-hidden="true"
                        />
                        <Link
                          to={transactionsHref(entry.id)}
                          className="text-sm text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          title={`${entry.name} — view these transactions`}
                        >
                          {entry.name}
                        </Link>
                      </span>
                    </th>
                    <td
                      className={`px-4 py-2 text-sm text-right font-semibold tabular-nums whitespace-nowrap ${
                        entry.value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {money(entry.value)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {shareOf(entry)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <th scope="row" className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Held in credit
                  </th>
                  <td className="px-4 py-3 text-sm text-right font-bold tabular-nums text-gray-900 dark:text-white">
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
          <p className="px-6 pb-6 pt-3 text-xs text-gray-500 dark:text-gray-400">
            Accounts holding nothing, or overdrawn, are listed with no share: a share of the money
            held is only meaningful for money held. The total above is what is in credit, so it is
            not your net worth — see the Net worth report for what you own less what you owe.
          </p>
        )}
      </div>
    </div>
  );
}
