import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import ReportDrillModal, { type ReportDrillTarget } from '../../components/reports/ReportDrillModal';
import { buildAccountBalanceReport, type AccountBalanceRow } from '../../utils/accountBalanceReport';
import { PERIOD_LABELS } from '../../hooks/usePeriod';
import type { ReportViewProps } from './types';

/**
 * "Account balances" — the Microsoft Money statement: what each account was
 * worth when the period opened, what moved through it, and what it is worth
 * now.
 *
 * Balances are computed from first principles (opening balance + every
 * transaction, Decimal throughout — see utils/accountBalanceReport), never
 * from the cached `account.balance`, so the figures reconcile with the
 * net-worth chart line for line.
 */
export default function AccountBalancesReport({ picker }: ReportViewProps): React.JSX.Element {
  const { accounts, transactions, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);

  const report = useMemo(
    () => buildAccountBalanceReport(accounts, transactions, picker.range),
    [accounts, transactions, picker.range]
  );

  const drillIntoAccount = (row: AccountBalanceRow): void => {
    const rows = transactions
      .filter(t => t.accountId === row.accountId && picker.inRange(t.date))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setDrill({
      title: `${row.name} — ${PERIOD_LABELS[picker.period]}`,
      // The account view: rows keep their own sign and the total is the net
      // movement, because this is not one side of the income/expense report.
      bucket: 'neutral',
      rows,
      total: row.change,
    });
  };

  const money = (value: number, currency?: string): string =>
    value < 0
      ? `-${formatCurrency(Math.abs(value), currency)}`
      : formatCurrency(value, currency);

  const signClass = (value: number): string =>
    value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white';

  const headCell = 'px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';
  const cell = 'px-3 py-2 text-sm text-right tabular-nums whitespace-nowrap';

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1a2332] dark:bg-gray-700 rounded-2xl p-6 text-white">
          <p className="text-xs text-white/60 uppercase tracking-wider font-medium">
            Total balance
          </p>
          <p className="text-2xl font-bold mt-1">{money(report.netWorth)}</p>
          <p className="text-xs text-white/60 mt-1">
            As at {report.asOf.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">In credit</p>
          <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
            {formatCurrency(report.assets)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Overdrawn / owed</p>
          <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {formatCurrency(report.liabilities)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-semibold text-theme-heading dark:text-white">
            Balances by account
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {PERIOD_LABELS[picker.period]} — click an account to see the transactions behind its movement.
          </p>
        </div>

        {report.rows.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No accounts yet</p>
        ) : (
          /* The table scrolls inside its own box; the page never scrolls sideways. */
          <div className="overflow-x-auto rounded-b-2xl">
            <table className="min-w-full text-sm">
              <caption className="sr-only">
                Opening balance, money in and out, and closing balance for every account
              </caption>
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th scope="col" className={`${headCell} text-left min-w-[180px]`}>Account</th>
                  <th scope="col" className={`${headCell} text-right`}>Opening</th>
                  <th scope="col" className={`${headCell} text-right`}>In</th>
                  <th scope="col" className={`${headCell} text-right`}>Out</th>
                  <th scope="col" className={`${headCell} text-right`}>Change</th>
                  <th scope="col" className={`${headCell} text-right`}>Closing</th>
                  <th scope="col" className={`${headCell} text-right`}>Transactions</th>
                </tr>
              </thead>
              {report.groups.map(group => (
                <tbody key={group.key} className="border-t border-gray-100 dark:border-gray-700">
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th
                      scope="row"
                      className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                    >
                      {group.label}
                    </th>
                    <td className={`${cell} text-gray-500 dark:text-gray-400`}>{money(group.opening)}</td>
                    <td className={cell} />
                    <td className={cell} />
                    <td className={`${cell} ${signClass(group.change)}`}>{money(group.change)}</td>
                    <td className={`${cell} font-semibold ${signClass(group.closing)}`}>{money(group.closing)}</td>
                    <td className={cell} />
                  </tr>
                  {group.rows.map(row => (
                    <tr key={row.accountId} className="border-t border-gray-50 dark:border-gray-700/50">
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        <button
                          type="button"
                          onClick={() => drillIntoAccount(row)}
                          className="text-sm text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          title={`${row.name} — view these transactions`}
                        >
                          {row.name}
                        </button>
                      </th>
                      <td className={`${cell} text-gray-500 dark:text-gray-400`}>
                        {money(row.opening, row.currency)}
                      </td>
                      <td className={`${cell} text-green-700 dark:text-green-400`}>
                        {row.moneyIn === 0 ? '—' : formatCurrency(row.moneyIn, row.currency)}
                      </td>
                      <td className={`${cell} text-red-600 dark:text-red-400`}>
                        {row.moneyOut === 0 ? '—' : formatCurrency(row.moneyOut, row.currency)}
                      </td>
                      <td className={`${cell} ${signClass(row.change)}`}>
                        {money(row.change, row.currency)}
                      </td>
                      <td className={`${cell} font-semibold ${signClass(row.closing)}`}>
                        {money(row.closing, row.currency)}
                      </td>
                      <td className={`${cell} text-gray-500 dark:text-gray-400`}>
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
              <tfoot className="border-t-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <th scope="row" className="px-3 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Total
                  </th>
                  <td className={`${cell} font-semibold ${signClass(report.openingNetWorth)}`}>
                    {money(report.openingNetWorth)}
                  </td>
                  <td className={cell} />
                  <td className={cell} />
                  <td className={`${cell} font-semibold ${signClass(report.change)}`}>
                    {money(report.change)}
                  </td>
                  <td className={`${cell} font-bold ${signClass(report.netWorth)}`}>
                    {money(report.netWorth)}
                  </td>
                  <td className={cell} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />
    </div>
  );
}
