import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import ReportDrillModal, { type ReportDrillTarget } from '../../components/reports/ReportDrillModal';
import { buildAccountBalanceReport, type AccountBalanceRow } from '../../utils/accountBalanceReport';
import { PERIOD_LABELS } from '../../hooks/usePeriod';
import type { ReportViewProps } from './types';

/**
 * "Net worth" — the Microsoft Money statement: everything you own set
 * against everything you owe, at the end of the selected period, with the
 * move since the period opened.
 *
 * Shares its figures with the Account balances report and the net-worth chart
 * (utils/accountBalanceReport): opening balance + every transaction, Decimal
 * throughout, and an account counts as a liability when its BALANCE is
 * negative — an overdrawn current account is money owed, whatever its type
 * says.
 */
export default function NetWorthStatementReport({ picker }: ReportViewProps): React.JSX.Element {
  const { accounts, transactions, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);

  const report = useMemo(
    () => buildAccountBalanceReport(accounts, transactions, picker.range),
    [accounts, transactions, picker.range]
  );

  /** Which statement section each account sits under, e.g. "Savings". */
  const groupLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const group of report.groups) {
      for (const row of group.rows) labels.set(row.accountId, group.label);
    }
    return labels;
  }, [report.groups]);

  const sides = useMemo(() => {
    const byMagnitude = (a: AccountBalanceRow, b: AccountBalanceRow): number =>
      Math.abs(b.closing) - Math.abs(a.closing) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return {
      owned: report.rows.filter(row => row.closing > 0).sort(byMagnitude),
      owed: report.rows.filter(row => row.closing < 0).sort(byMagnitude),
    };
  }, [report.rows]);

  const drillIntoAccount = (row: AccountBalanceRow): void => {
    const rows = transactions
      .filter(t => t.accountId === row.accountId && picker.inRange(t.date))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setDrill({
      title: `${row.name} — ${PERIOD_LABELS[picker.period]}`,
      bucket: 'neutral',
      rows,
      total: row.change,
    });
  };

  const money = (value: number, currency?: string): string =>
    value < 0 ? `-${formatCurrency(Math.abs(value), currency)}` : formatCurrency(value, currency);

  const section = (
    title: string,
    rows: AccountBalanceRow[],
    total: number,
    emptyText: string
  ): React.JSX.Element => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-baseline justify-between gap-3 p-6 pb-3">
        <h2 className="text-lg font-semibold text-theme-heading dark:text-white">{title}</h2>
        <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
          {formatCurrency(total)}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto rounded-b-2xl">
          <table className="min-w-full text-sm">
            <caption className="sr-only">{title} by account</caption>
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th scope="col" className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[200px]">
                  Account
                </th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Change this period
                </th>
                <th scope="col" className="px-6 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.accountId} className="border-t border-gray-50 dark:border-gray-700/50">
                  <th scope="row" className="px-6 py-2.5 text-left font-normal">
                    <button
                      type="button"
                      onClick={() => drillIntoAccount(row)}
                      className="text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      title={`${row.name} — view these transactions`}
                    >
                      <span className="block text-sm text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 hover:underline">
                        {row.name}
                      </span>
                      <span className="block text-xs text-gray-400 dark:text-gray-500">
                        {groupLabels.get(row.accountId) ?? 'Other'}
                      </span>
                    </button>
                  </th>
                  <td className={`px-3 py-2.5 text-sm text-right tabular-nums whitespace-nowrap ${
                    row.change < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                  }`}>
                    {row.change === 0 ? '—' : `${row.change > 0 ? '+' : ''}${money(row.change, row.currency)}`}
                  </td>
                  <td className="px-6 py-2.5 text-sm text-right font-semibold tabular-nums whitespace-nowrap text-gray-900 dark:text-white">
                    {money(Math.abs(row.closing), row.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1a2332] dark:bg-gray-700 rounded-2xl p-6 text-white">
          <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Net worth</p>
          <p className="text-2xl font-bold mt-1">{money(report.netWorth)}</p>
          <p className="text-xs text-white/60 mt-1">
            As at {report.asOf.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">What you own</p>
          <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
            {formatCurrency(report.assets)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">What you owe</p>
          <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {formatCurrency(report.liabilities)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            Change — {PERIOD_LABELS[picker.period]}
          </p>
          <p className={`text-2xl font-bold mt-1 ${
            report.change < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          }`}>
            {report.change > 0 ? '+' : ''}{money(report.change)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            From {money(report.openingNetWorth)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {section('What you own', sides.owned, report.assets, 'No account is in credit in this period')}
        {section('What you owe', sides.owed, report.liabilities, 'Nothing owed — no account is overdrawn')}
      </div>

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />
    </div>
  );
}
