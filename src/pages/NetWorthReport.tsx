import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { Modal, ModalBody } from '../components/common/Modal';
import { toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { preserveDemoParam } from '../utils/navigation';
import { buildNetWorthSnapshots } from '../utils/netWorthSeries';
import { resolveEffectiveOpeningDates } from '../utils/openingDates';
import { TrendingUpIcon, ChevronRightIcon } from '../components/icons';
import type { ReportViewProps } from './reports/types';

/**
 * Net worth over time — the Microsoft Money report, rebuilt on real data.
 *
 * Every point is computed from first principles: per-account running balance
 * (opening balance + cumulative transactions, Decimal throughout) snapshotted
 * at each point in the selected period. Nothing is stored or estimated — the
 * full transaction history IS the time series.
 *
 * Drill-in: click a point to see every account's balance on that date;
 * click an account to open its register.
 */


const compactTick = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${formatDecimal(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${sign}${formatDecimal(abs / 1_000, 0)}K`;
  return formatDecimal(value, 0);
};

export default function NetWorthReport({ picker }: ReportViewProps): React.JSX.Element {
  const { accounts, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();
  const [drillDate, setDrillDate] = useState<Date | null>(null);
  // Line or bar presentation — same data, same drill-in; persisted.
  const [chartType, setChartType] = useState<'line' | 'bar'>(() =>
    localStorage.getItem('netWorthChartType') === 'bar' ? 'bar' : 'line'
  );
  const handleChartType = (type: 'line' | 'bar'): void => {
    setChartType(type);
    localStorage.setItem('netWorthChartType', type);
  };
  // Assets/liabilities context series are OFF by default — the chart is the
  // net worth line; the detail is an opt-in (persisted).
  const [showDetail, setShowDetail] = useState<boolean>(() =>
    localStorage.getItem('netWorthShowDetail') === '1'
  );
  const toggleDetail = (): void => {
    setShowDetail(prev => {
      localStorage.setItem('netWorthShowDetail', prev ? '0' : '1');
      return !prev;
    });
  };

  // Transactions sorted once; the series walk and the drill both consume it.
  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions]
  );

  const snapshots = useMemo(
    () => buildNetWorthSnapshots(accounts, sortedTransactions, picker.range),
    [accounts, sortedTransactions, picker.range]
  );

  // One resolver drives both the drill and the warning note, so the "balances
  // on a date" figures and the caveat about them can never disagree.
  const openingDates = useMemo(
    () => resolveEffectiveOpeningDates(accounts, sortedTransactions),
    [accounts, sortedTransactions]
  );

  // Per-account balances at the drilled date (same cumulative rule as the
  // series walk: an opening balance counts only once its effective date has
  // arrived; a dateless lump behaves as today).
  const drillBalances = useMemo(() => {
    if (!drillDate) return [];
    const cutoff = new Date(drillDate);
    cutoff.setHours(23, 59, 59, 999);
    const cutoffTime = cutoff.getTime();
    const balances = new Map(accounts.map(a => {
      const opening = toDecimal(a.openingBalance ?? 0);
      const eff = openingDates.get(a.id);
      if (eff === undefined) return [a.id, opening] as const;
      return [a.id, eff.getTime() <= cutoffTime ? opening : toDecimal(0)] as const;
    }));
    for (const t of sortedTransactions) {
      if (new Date(t.date) > cutoff) break;
      const bal = balances.get(t.accountId);
      if (bal !== undefined) balances.set(t.accountId, bal.plus(toDecimal(t.amount)));
    }
    // A zero balance with no activity yet (opening date not reached) drops out,
    // exactly as an empty account always has.
    return accounts
      .map(a => ({ account: a, balance: balances.get(a.id) ?? toDecimal(0) }))
      .filter(e => !e.balance.isZero())
      .sort((a, b) => b.balance.comparedTo(a.balance));
  }, [drillDate, accounts, sortedTransactions, openingDates]);

  // Opening balances whose date the chart cannot trust: undated lumps count
  // from the beginning of time (net worth before their real opening date is
  // overstated), and inferred dates are a guess from first activity. Only
  // NONZERO opening balances matter — a zero opening contributes nothing to
  // overstate. Both lists are empty in the common case, so the note renders
  // nothing at all.
  const openingDateWarnings = useMemo(() => {
    const undated: string[] = [];
    const inferred: string[] = [];
    for (const a of accounts) {
      if (toDecimal(a.openingBalance ?? 0).isZero()) continue;
      const eff = openingDates.get(a.id);
      if (eff === undefined) undated.push(a.name);
      else if (!a.openingBalanceDate) inferred.push(a.name);
    }
    return { undated, inferred };
  }, [accounts, openingDates]);

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const earliest = snapshots.length > 0 ? snapshots[0] : null;
  const change = latest && earliest
    ? toDecimal(latest.netWorth).minus(toDecimal(earliest.netWorth))
    : toDecimal(0);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* The period comes from the hub, so it persists between reports. */}
      {/* Headline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1a2332] dark:bg-gray-700 rounded-2xl p-6 text-white">
          <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Net Worth {latest ? `— ${latest.label}` : ''}</p>
          <p className="text-2xl font-bold mt-1">{latest ? formatCurrency(latest.netWorth) : '—'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Change over period</p>
          <p className={`text-2xl font-bold mt-1 ${change.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
            {change.greaterThanOrEqualTo(0) ? '+' : ''}{formatCurrency(change.toNumber())}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Assets / Liabilities {latest ? `— ${latest.label}` : ''}</p>
          <p className="text-lg font-semibold mt-1">
            <span className="text-green-600 dark:text-green-400">{latest ? formatCurrency(latest.assets) : '—'}</span>
            <span className="text-gray-400 mx-2">/</span>
            <span className="text-red-600">{latest ? formatCurrency(latest.liabilities) : '—'}</span>
          </p>
        </div>
      </div>

      {/* Opening-date caveat — shown right above the chart it qualifies, and
          only when there is something to qualify. */}
      {(openingDateWarnings.undated.length > 0 || openingDateWarnings.inferred.length > 0) && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-5 py-3 mb-6 space-y-1.5">
          {openingDateWarnings.undated.length > 0 && (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">
                {openingDateWarnings.undated.length} account{openingDateWarnings.undated.length === 1 ? "'s" : "s'"} opening balance{openingDateWarnings.undated.length === 1 ? ' counts' : 's count'} from the beginning of time — net worth before {openingDateWarnings.undated.length === 1 ? 'its' : 'their'} real opening date is overstated. Set the date in Account Settings.
              </span>{' '}
              <span className="text-amber-700 dark:text-amber-400">{openingDateWarnings.undated.join(', ')}</span>
            </p>
          )}
          {openingDateWarnings.inferred.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {openingDateWarnings.inferred.length} account{openingDateWarnings.inferred.length === 1 ? "'s" : "s'"} opening date{openingDateWarnings.inferred.length === 1 ? ' is' : 's are'} inferred from {openingDateWarnings.inferred.length === 1 ? 'its' : 'their'} first activity — set the real date to be exact.{' '}
              <span className="text-amber-600 dark:text-amber-500">{openingDateWarnings.inferred.join(', ')}</span>
            </p>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <TrendingUpIcon size={20} className="text-gray-500" />
            Net Worth Over Time
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDetail}
              aria-pressed={showDetail}
              title={showDetail ? 'Hide the assets and liabilities series' : 'Also show assets and liabilities'}
              className={`px-3 py-1 text-sm font-medium rounded-lg border transition-colors ${
                showDetail
                  ? 'border-[#1a2332] dark:border-blue-500 bg-[#1a2332] dark:bg-blue-600 text-white'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Assets &amp; Liabilities
            </button>
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
              {(['line', 'bar'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleChartType(type)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    chartType === type
                      ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {type === 'line' ? 'Line' : 'Bar'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Computed from your full transaction history. Click any point to see every account's balance on that date.
        </p>
        {snapshots.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No data in this period</p>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={snapshots}
                onClick={(state) => {
                  const label = state?.activeLabel;
                  const snap = snapshots.find(s => s.label === label);
                  if (snap) setDrillDate(snap.date);
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.2)" />
                <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 12 }} minTickGap={24} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={compactTick} width={70} />
                <Tooltip
                  formatter={(value: number | string) => formatCurrency(typeof value === 'number' ? value : Number(value))}
                  contentStyle={{ borderRadius: '8px' }}
                />
                <Legend />
                {chartType === 'bar' ? (
                  // Money-style bar view: net worth as bars, assets/liabilities
                  // as context lines. Same data, same click-to-drill.
                  <Bar dataKey="netWorth" name="Net Worth" fill="#1a2332" radius={[3, 3, 0, 0]} cursor="pointer" />
                ) : (
                  <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke="#1a2332" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                )}
                {showDetail && (
                  <Line type="monotone" dataKey="assets" name="Assets" stroke="#10B981" strokeWidth={1.5} dot={false} />
                )}
                {showDetail && (
                  <Line type="monotone" dataKey="liabilities" name="Liabilities" stroke="#EF4444" strokeWidth={1.5} dot={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Drill-in: balances by account on the clicked date */}
      <Modal
        isOpen={drillDate !== null}
        onClose={() => setDrillDate(null)}
        title={drillDate ? `Balances on ${drillDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        size="md"
      >
        <ModalBody>
          {drillBalances.length === 0 ? (
            <p className="text-center py-8 text-gray-400">No account balances on this date</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {drillBalances.map(({ account, balance }) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => navigate(preserveDemoParam(`/accounts/${account.id}`, location.search))}
                  className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors rounded-lg px-2 -mx-2"
                  title="Open this account's register"
                >
                  <span className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-200">{account.name}</span>
                  <span className={`text-sm font-semibold tabular-nums ${
                    balance.greaterThanOrEqualTo(0) ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(balance.toNumber(), account.currency)}
                  </span>
                  <ChevronRightIcon size={16} className="text-gray-400 flex-shrink-0" />
                </button>
              ))}
              <div className="flex items-center justify-between pt-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Net worth</span>
                <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(
                    drillBalances.reduce((sum, e) => sum.plus(e.balance), toDecimal(0)).toNumber()
                  )}
                </span>
              </div>
            </div>
          )}
        </ModalBody>
      </Modal>
    </div>
  );
}
