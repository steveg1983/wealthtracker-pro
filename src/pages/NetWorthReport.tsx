import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { usePeriod } from '../hooks/usePeriod';
import PeriodPicker from '../components/PeriodPicker';
import { Modal, ModalBody } from '../components/common/Modal';
import { toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { preserveDemoParam } from '../utils/navigation';
import { CalendarIcon, TrendingUpIcon, ChevronRightIcon } from '../components/icons';

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

interface Snapshot {
  date: Date;
  label: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

const compactTick = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${formatDecimal(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${sign}${formatDecimal(abs / 1_000, 0)}K`;
  return formatDecimal(value, 0);
};

export default function NetWorthReport(): React.JSX.Element {
  const { accounts, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();
  const picker = usePeriod('netWorthPeriod', 'last-12-months');
  const [drillDate, setDrillDate] = useState<Date | null>(null);

  // Transactions sorted once; the series walk and the drill both consume it.
  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions]
  );

  const snapshots = useMemo<Snapshot[]>(() => {
    if (accounts.length === 0) return [];

    const now = new Date();
    const firstTxnDate = sortedTransactions.length > 0 ? new Date(sortedTransactions[0].date) : now;
    const start = picker.range.from ?? firstTxnDate;
    const end = picker.range.to ?? now;
    if (start > end) return [];

    // Point cadence: daily for short windows, month-end beyond ~3 months
    // (Money's cadence), always ending on the window's final day.
    const spanDays = (end.getTime() - start.getTime()) / 86_400_000;
    const points: Date[] = [];
    if (spanDays <= 92) {
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        points.push(new Date(d));
      }
    } else {
      // End of each month from the start month onward.
      const cursor = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      while (cursor < end) {
        points.push(new Date(cursor));
        cursor.setMonth(cursor.getMonth() + 2, 0);
      }
      points.push(new Date(end));
    }

    // One forward walk: balances accumulate from the very beginning (a
    // point's balance includes ALL history before it, not just the window).
    const balances = new Map(accounts.map(a => [a.id, toDecimal(a.openingBalance ?? 0)]));
    const monthly = spanDays > 92;
    let i = 0;
    const out: Snapshot[] = [];
    for (const point of points) {
      const cutoff = new Date(point);
      cutoff.setHours(23, 59, 59, 999);
      while (i < sortedTransactions.length && new Date(sortedTransactions[i].date) <= cutoff) {
        const t = sortedTransactions[i];
        const bal = balances.get(t.accountId);
        if (bal !== undefined) balances.set(t.accountId, bal.plus(toDecimal(t.amount)));
        i++;
      }
      let assets = toDecimal(0);
      let liabilities = toDecimal(0);
      for (const b of balances.values()) {
        if (b.greaterThan(0)) assets = assets.plus(b);
        else liabilities = liabilities.plus(b.abs());
      }
      out.push({
        date: point,
        label: point.toLocaleDateString('en-GB', monthly
          ? { month: 'short', year: '2-digit' }
          : { day: '2-digit', month: 'short' }),
        assets: assets.toNumber(),
        liabilities: liabilities.toNumber(),
        netWorth: assets.minus(liabilities).toNumber(),
      });
    }
    return out;
  }, [accounts, sortedTransactions, picker.range]);

  // Per-account balances at the drilled date (same cumulative rule).
  const drillBalances = useMemo(() => {
    if (!drillDate) return [];
    const cutoff = new Date(drillDate);
    cutoff.setHours(23, 59, 59, 999);
    const balances = new Map(accounts.map(a => [a.id, toDecimal(a.openingBalance ?? 0)]));
    for (const t of sortedTransactions) {
      if (new Date(t.date) > cutoff) break;
      const bal = balances.get(t.accountId);
      if (bal !== undefined) balances.set(t.accountId, bal.plus(toDecimal(t.amount)));
    }
    return accounts
      .map(a => ({ account: a, balance: balances.get(a.id) ?? toDecimal(0) }))
      .filter(e => !e.balance.isZero())
      .sort((a, b) => b.balance.comparedTo(a.balance));
  }, [drillDate, accounts, sortedTransactions]);

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const earliest = snapshots.length > 0 ? snapshots[0] : null;
  const change = latest && earliest
    ? toDecimal(latest.netWorth).minus(toDecimal(earliest.netWorth))
    : toDecimal(0);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Period picker */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-gray-500" size={20} />
          <PeriodPicker picker={picker} />
        </div>
      </div>

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

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2 text-gray-900 dark:text-white">
          <TrendingUpIcon size={20} className="text-gray-500" />
          Net Worth Over Time
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Computed from your full transaction history. Click any point to see every account's balance on that date.
        </p>
        {snapshots.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No data in this period</p>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
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
                <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke="#1a2332" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="assets" name="Assets" stroke="#10B981" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="liabilities" name="Liabilities" stroke="#EF4444" strokeWidth={1.5} dot={false} />
              </LineChart>
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
