import { useCallback, useMemo, useState } from 'react';
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
import NetWorthSummary from '../components/NetWorthSummary';
import { singlePointDot } from '../components/charts/singlePointDots';
import { toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { preserveDemoParam } from '../utils/navigation';
import { buildNetWorthSnapshots, netWorthAxisTicks, netWorthPointToken } from '../utils/netWorthSeries';
import { useArrivalAction } from '../hooks/useArrivalFocus';
import { resolveEffectiveOpeningDates } from '../utils/openingDates';
import { TrendingUpIcon, ChevronRightIcon } from '../components/icons';
import { DECOMPOSITION_SERIES, useChartTooltipStyle } from '../components/charts/chartColors';
import type { ReportViewProps } from './reports/types';
import { preferences } from '../services/preferencesService';
import { useHistoricalAccounts } from '../hooks/useHistoricalAccounts';
import { getDateLocale } from '../utils/dateFormatter';

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


/**
 * The legend, drawing each series as the LINE IT ACTUALLY IS.
 *
 * The design ruling that separated these three by shape rather than colour came
 * with one condition attached: "the legend must show the actual dash pattern,
 * not a coloured square. A legend that renders three identical navy squares is
 * worse than the bug we started with."
 *
 * Recharts' default legend does not meet that. Measured before writing this:
 * its swatch is a `<path>` carrying `stroke` and no `stroke-dasharray` at all,
 * so Assets and Liabilities — deliberately the same hue — came out as two
 * identical navy lines. The whole point of the ruling is that shape carries
 * identity, and the default legend is the one place shape was being dropped.
 *
 * So the swatch is drawn here from the same `DECOMPOSITION_SERIES` entry the
 * chart draws from, which is also what stops the two drifting: there is no
 * second copy of the pattern to forget to update.
 */
function DecompositionLegend({ payload }: { payload?: readonly { value?: string }[] }): React.JSX.Element {
  const style = (name: string | undefined): typeof DECOMPOSITION_SERIES[keyof typeof DECOMPOSITION_SERIES] =>
    name === 'Assets' ? DECOMPOSITION_SERIES.part
      : name === 'Liabilities' ? DECOMPOSITION_SERIES.counterpart
        : DECOMPOSITION_SERIES.total;

  return (
    <ul className="flex flex-wrap items-center justify-center gap-4 pt-1">
      {(payload ?? []).map(entry => {
        const series = style(entry.value);
        return (
          <li key={entry.value} className="flex items-center gap-1.5 text-label text-gray-600 dark:text-gray-300">
            {/* 24px of the real line: same colour, same weight, same dash. */}
            <svg width="24" height="10" aria-hidden="true" className="flex-shrink-0">
              <line
                x1="0" y1="5" x2="24" y2="5"
                stroke={series.color}
                strokeWidth={series.width}
                strokeDasharray={series.dash}
              />
            </svg>
            {entry.value}
          </li>
        );
      })}
    </ul>
  );
}

const compactTick = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${formatDecimal(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${sign}${formatDecimal(abs / 1_000, 0)}K`;
  return formatDecimal(value, 0);
};

export default function NetWorthReport({ picker, focus }: ReportViewProps): React.JSX.Element {
  const { accounts: openAccounts, transactions } = useApp();
  /**
   * OPEN AND CLOSED, because this page walks history.
   *
   * The app context holds open accounts only (`getAccounts` filters on
   * `is_active`), so every point on this chart used to omit whatever the
   * owner's 110 closed accounts held at the time — understating the past, and
   * understating it more the further back you look. See useHistoricalAccounts.
   *
   * Everything on this page reads from it: the series, the effective opening
   * dates, the per-date drill and the caveat note. They must agree, and the
   * headline above the chart is the LAST POINT of the series rather than a
   * separately-computed figure, so it moves with them.
   */
  const accounts = useHistoricalAccounts(openAccounts);
  const { formatCurrency } = useCurrencyDecimal();
  // Watches the dark class rather than reading it once — the theme scheduler
  // can flip the ground under a mounted chart.
  const chartTooltipStyle = useChartTooltipStyle();
  const navigate = useNavigate();
  const location = useLocation();
  const [drillDate, setDrillDate] = useState<Date | null>(null);
  // Line or bar presentation — same data, same drill-in; persisted.
  const [chartType, setChartType] = useState<'line' | 'bar'>(() =>
    preferences.getItem('netWorthChartType') === 'bar' ? 'bar' : 'line'
  );
  const handleChartType = (type: 'line' | 'bar'): void => {
    setChartType(type);
    preferences.setItem('netWorthChartType', type);
  };
  // Assets/liabilities context series are OFF by default — the chart is the
  // net worth line; the detail is an opt-in (persisted).
  const [showDetail, setShowDetail] = useState<boolean>(() =>
    preferences.getItem('netWorthShowDetail') === '1'
  );
  const toggleDetail = (): void => {
    setShowDetail(prev => {
      preferences.setItem('netWorthShowDetail', prev ? '0' : '1');
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

  /**
   * A point clicked on the Dashboard's net-worth card, landed on here.
   *
   * This report answers "that point" with the day's balances and nothing else —
   * there is no row to highlight — so arriving on a point does exactly what
   * clicking the same point on the chart below does, and closing the dialog
   * leaves the reader on the report over the window they came from.
   *
   * It retries until the snapshot exists: the report renders once before the
   * arriving period has been applied, and the series it is asked about is not
   * built yet at that moment. A token no snapshot matches (a date outside the
   * window) simply never fires.
   */
  const openArrivalPoint = useCallback((token: string): boolean => {
    const snapshot = snapshots.find(s => netWorthPointToken(s.date) === token);
    if (!snapshot) return false;
    setDrillDate(snapshot.date);
    return true;
  }, [snapshots]);
  useArrivalAction(focus, openArrivalPoint);

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
      {/*
        THE SAME THREE FIGURES AS THE DASHBOARD AND THE ACCOUNTS LIST, SO THE
        SAME CARD (PHONE_CAPTURES_REVIEW_2026-08-13 §4).

        What used to be here was the navy slab plus two white cards that
        NetWorthSummary was written to abolish — and opting out of the shared
        card is not free. The dark-mode fault that card's comment documents was
        found and fixed ONCE and reached all three surfaces that use it; this
        page, which had copied the markup instead, was still carrying its own
        version of the same class of bug: `text-red-600` with NO `dark:`
        variant, so Liabilities rendered #dc2626 on the #1f2937 dark card. That
        is the whole argument for sharing, and it is why the copy is gone.

        The three magnitudes are navy in the shared card because none of them is
        a direction of travel (RULINGS_ON_CAUSE_2026-08-13 §1). The CHANGE below
        them is the exception that proves it: a delta is nothing BUT a direction
        of travel, so it is the one figure on this page that keeps the semantic
        colours — which is also what stops green and red here from being
        decoration.
      */}
      <div className="mb-6 space-y-2">
        <NetWorthSummary
          netWorth={latest ? formatCurrency(latest.netWorth) : '—'}
          assets={latest ? formatCurrency(latest.assets) : '—'}
          liabilities={latest ? formatCurrency(latest.liabilities) : '—'}
        />
        <p className="text-body text-gray-600 dark:text-gray-400">
          {latest ? <>As at <span className="font-medium text-gray-900 dark:text-gray-100">{latest.label}</span>. </> : null}
          Change over the period{' '}
          <span className={change.greaterThanOrEqualTo(0) ? 'font-medium text-green-600 dark:text-green-400' : 'font-medium text-red-600 dark:text-red-400'}>
            {change.greaterThanOrEqualTo(0) ? '+' : ''}{formatCurrency(change.toNumber())}
          </span>.
        </p>
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
                {/* Years for a multi-year window (§2.3) — same helper as the
                    Dashboard widget, so card and report tick identically. */}
                <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 12 }} minTickGap={24} {...netWorthAxisTicks(snapshots)} />
                {/* Below zero only when the data goes there (§2.4). */}
                <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={compactTick} width={70} domain={[(dataMin: number) => Math.min(0, dataMin), 'auto']} />
                {/* The radius-only contentStyle LOOKED themed and set no
                    colour — the same survivor pattern the 16 Aug sweep found
                    on three other report pages. */}
                <Tooltip
                  formatter={(value: number | string) => formatCurrency(typeof value === 'number' ? value : Number(value))}
                  contentStyle={chartTooltipStyle} separator=": "
                />
                <Legend content={<DecompositionLegend />} />
                {chartType === 'bar' ? (
                  // Money-style bar view: net worth as bars, assets/liabilities
                  // as context lines. Same data, same click-to-drill.
                  <Bar dataKey="netWorth" name="Net Worth" fill={DECOMPOSITION_SERIES.total.color} radius={[3, 3, 0, 0]} cursor="pointer" />
                ) : (
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    name="Net Worth"
                    stroke={DECOMPOSITION_SERIES.total.color}
                    strokeWidth={DECOMPOSITION_SERIES.total.width}
                    dot={singlePointDot(snapshots, DECOMPOSITION_SERIES.total.color)}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                )}
                {showDetail && (
                  <Line
                    type="monotone"
                    dataKey="assets"
                    name="Assets"
                    stroke={DECOMPOSITION_SERIES.part.color}
                    strokeWidth={DECOMPOSITION_SERIES.part.width}
                    strokeDasharray={DECOMPOSITION_SERIES.part.dash}
                    dot={singlePointDot(snapshots, DECOMPOSITION_SERIES.part.color)}
                    isAnimationActive={false}
                  />
                )}
                {showDetail && (
                  <Line
                    type="monotone"
                    dataKey="liabilities"
                    name="Liabilities"
                    stroke={DECOMPOSITION_SERIES.counterpart.color}
                    strokeWidth={DECOMPOSITION_SERIES.counterpart.width}
                    strokeDasharray={DECOMPOSITION_SERIES.counterpart.dash}
                    dot={singlePointDot(snapshots, DECOMPOSITION_SERIES.counterpart.color)}
                    isAnimationActive={false}
                  />
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
        title={drillDate ? `Balances on ${drillDate.toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
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
