import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApp } from '../../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../../hooks/useCurrencyDecimal';
import { buildMonthlyTrend } from '../../../utils/monthlyTrend';
import { buildNetWorthSnapshots, netWorthPointToken } from '../../../utils/netWorthSeries';
import { computeExpenseCategoryNetTotals } from '../../../utils/categoryNetting';
import { expandSplitTransactions } from '../../../utils/transactionSplits';
import { formatDecimal } from '../../../utils/decimal-format';
import { customReportService } from '../../../services/customReportService';
import type { UsePeriodResult } from '../../../hooks/usePeriod';
import type { CardPeriodPin } from '../../../hooks/useCardPeriod';
import { TrendingUpIcon, PieChartIcon, BarChart3Icon, FileTextIcon } from '../../icons';
import DashboardWidgetCard from './DashboardWidgetCard';
import CardPeriodControl from './CardPeriodControl';
import { WIDGET_CHART_HEIGHT } from './widgetChrome';
import { useReportDrill } from './useReportDrill';

/**
 * Compact, live versions of the Reports-hub reports for the Dashboard's
 * "pinned reports" section. Each widget computes from the SAME shared maths
 * as its full report (utils/monthlyTrend, utils/netWorthSeries,
 * utils/categoryNetting), so the glance and the full view can never
 * disagree.
 *
 * Every card clicks through to ITS report in the gallery — the ids below are
 * the report gallery's stable URL segments (see pages/reports/reportRegistry).
 * The click carries TWO things it used to drop on the floor: the period the
 * card was read over, so the report opens on the same window rather than on
 * whatever it last stored; and where the user came from, so the report's
 * back-link returns to the Dashboard (see useReportDrill).
 *
 * Clicking a point rather than the header carries the point as well, and the
 * report lands on it. What "lands on it" means is the report's own business —
 * the month-by-month table highlights the month, the net-worth line opens that
 * day's balances — which is why the widgets pass a token and nothing else.
 *
 * Every chart area is WIDGET_CHART_HEIGHT and every card wears the same shell,
 * so the four cards in the section are one height rather than four.
 *
 * ── `picker` AND `pin` ARE NOT TWO WINDOWS ──────────────────────────────────
 *
 * `picker` is the window the card is read over, whether that is the page's or
 * one this card was pinned to; the Dashboard resolves which before handing it
 * over (hooks/useCardPeriod). `pin` carries no window at all — only whether
 * this card has one of its own and the two ways to change that — so the card's
 * chart, its click-through and its declaration cannot disagree about the
 * window, because there is only one of them to read.
 *
 * `pin` is optional: a card rendered without it is a card with no period
 * affordance, which is exactly what these three were before the pin existed.
 */

const CATEGORY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'
];

const compactTick = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${formatDecimal(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${sign}${formatDecimal(abs / 1_000, 0)}K`;
  return formatDecimal(value, 0);
};

const NET_WORTH_TITLE = 'Net Worth Over Time';

export function NetWorthWidget({ picker, pin }: {
  picker: UsePeriodResult;
  pin?: CardPeriodPin;
}): React.JSX.Element {
  const { accounts, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const openReport = useReportDrill();

  const snapshots = useMemo(
    () => buildNetWorthSnapshots(accounts, transactions, picker.range),
    [accounts, transactions, picker.range]
  );
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  const open = (focus?: string): void =>
    openReport('net-worth-over-time', { period: picker, focus });

  return (
    <DashboardWidgetCard
      title={NET_WORTH_TITLE}
      icon={TrendingUpIcon}
      subtitle={
        <>
          <span className="min-w-0 text-xl font-bold text-gray-900 dark:text-white truncate">
            {latest ? formatCurrency(latest.netWorth) : '—'}
          </span>
          {pin && <CardPeriodControl cardLabel={NET_WORTH_TITLE} period={picker.period} pin={pin} />}
        </>
      }
      onOpen={() => open()}
    >
      <div className={WIDGET_CHART_HEIGHT}>
        <ResponsiveContainer width="100%" height="100%">
          {/* Clicking a point opens the report on the same window with THAT
              day's balances already showing — the report's own answer to a
              point, reached from the card. The chart carries the click (not
              each dot) because the line is drawn without dots: recharts hands
              back the label under the pointer, which is enough to name the
              snapshot. */}
          <LineChart
            data={snapshots}
            style={{ cursor: 'pointer' }}
            onClick={(state) => {
              const snapshot = snapshots.find(s => s.label === state?.activeLabel);
              if (snapshot) open(netWorthPointToken(snapshot.date));
            }}
          >
            <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 10 }} minTickGap={32} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={compactTick} width={44} />
            <Tooltip formatter={(v: number | string) => formatCurrency(typeof v === 'number' ? v : Number(v))} />
            <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke="#1a2332" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
}

const INCOME_EXPENSE_TITLE = 'Income vs Expenses';

export function IncomeExpenseTrendWidget({ picker, pin }: {
  picker: UsePeriodResult;
  pin?: CardPeriodPin;
}): React.JSX.Element {
  const { transactions, transactionSplits, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const openReport = useReportDrill();
  const { range } = picker;

  const data = useMemo(() => {
    const rows = expandSplitTransactions(transactions, transactionSplits).filter(t => {
      const time = new Date(t.date).getTime();
      if (range.from && time < range.from.getTime()) return false;
      if (range.to && time > range.to.getTime()) return false;
      return true;
    });
    return buildMonthlyTrend(rows, categories);
  }, [transactions, transactionSplits, categories, range]);

  const open = (focus?: string): void =>
    openReport('income-and-spending-over-time', { period: picker, focus });

  return (
    <DashboardWidgetCard
      title={INCOME_EXPENSE_TITLE}
      icon={BarChart3Icon}
      subtitle={
        <>
          <span className="min-w-0 text-xs text-gray-500 dark:text-gray-400 truncate">
            Month by month, what came in against what went out
          </span>
          {pin && <CardPeriodControl cardLabel={INCOME_EXPENSE_TITLE} period={picker.period} pin={pin} />}
        </>
      }
      onOpen={() => open()}
    >
      <div className={WIDGET_CHART_HEIGHT}>
        <ResponsiveContainer width="100%" height="100%">
          {/* A click lands on the report's row for THAT month, highlighted,
              with both figures on it one click from the transactions behind
              them. Deliberately not straight into one of those two lists: the
              tooltip covers income and expenses together, so a click near the
              crossing point cannot say which was meant, and guessing would open
              the wrong one half the time. */}
          <LineChart
            data={data}
            style={{ cursor: 'pointer' }}
            onClick={(state) => {
              const point = data.find(d => d.month === state?.activeLabel);
              if (point) open(point.monthKey);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.2)" />
            <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 10 }} minTickGap={32} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={compactTick} width={44} />
            <Tooltip formatter={(v: number | string) => formatCurrency(typeof v === 'number' ? v : Number(v))} />
            <Line type="monotone" dataKey="income" name="Income" stroke="#10B981" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
}

const EXPENSE_CATEGORIES_TITLE = 'Expense Categories';

export function ExpenseCategoriesWidget({ picker, pin }: {
  picker: UsePeriodResult;
  pin?: CardPeriodPin;
}): React.JSX.Element {
  const { transactions, transactionSplits, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const openReport = useReportDrill();
  const { range } = picker;

  const data = useMemo(() => {
    const rows = expandSplitTransactions(transactions, transactionSplits).filter(t => {
      const time = new Date(t.date).getTime();
      if (range.from && time < range.from.getTime()) return false;
      if (range.to && time > range.to.getTime()) return false;
      return true;
    });
    return computeExpenseCategoryNetTotals(rows, categories)
      .slice(0, 6)
      .map(({ key, name, value }) => ({ categoryId: key, name, value }));
  }, [transactions, transactionSplits, categories, range]);

  const open = (focus?: string): void =>
    openReport('spending-by-category', { period: picker, focus });

  return (
    <DashboardWidgetCard
      title={EXPENSE_CATEGORIES_TITLE}
      icon={PieChartIcon}
      subtitle={
        <>
          <span className="min-w-0 text-xs text-gray-500 dark:text-gray-400 truncate">
            Where the money went, biggest first
          </span>
          {pin && <CardPeriodControl cardLabel={EXPENSE_CATEGORIES_TITLE} period={picker.period} pin={pin} />}
        </>
      }
      onOpen={() => open()}
    >
      {/* The empty state fills the SAME box the chart would, so a period with
          nothing in it does not shrink the card out of line with its neighbour. */}
      {data.length === 0 ? (
        <div className={`${WIDGET_CHART_HEIGHT} flex items-center justify-center`}>
          <p className="text-center text-sm text-gray-400">No categorised spending in this period</p>
        </div>
      ) : (
        <div className={`flex items-center gap-3 ${WIDGET_CHART_HEIGHT}`}>
          <div className="h-full flex-1 basis-0 min-w-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                {/* A slice opens the report with that category's row
                    highlighted — the ranked table around it is the context a
                    single slice cannot give. */}
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="88%"
                  strokeWidth={0}
                  isAnimationActive={false}
                  cursor="pointer"
                  onClick={(entry) => {
                    const datum = ((entry as { payload?: typeof data[number] })?.payload ?? entry) as typeof data[number];
                    if (datum?.categoryId) open(datum.categoryId);
                  }}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number | string) => formatCurrency(typeof v === 'number' ? v : Number(v))} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          {/* The legend does the same as the slice beside it, and is the only
              one of the two a keyboard can reach: an SVG sector is not a
              control. Same idiom as the Account Distribution card's legend. */}
          <ul className="w-36 space-y-1">
            {data.slice(0, 5).map((d, i) => (
              <li key={d.categoryId}>
                <button
                  type="button"
                  onClick={() => open(d.categoryId)}
                  title={`${d.name} — open the full report on this category`}
                  className="w-full flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} aria-hidden="true" />
                  <span className="truncate">{d.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardWidgetCard>
  );
}

/**
 * A pinned custom report: name + description, click-through to the hub.
 *
 * No period travels with this one and no point can be clicked on it — a custom
 * report carries its own date and account filters (usesPeriod: false in the
 * registry) and this card draws no chart. The way back still knows where it
 * came from.
 */
export function CustomReportWidget({ reportId }: { reportId: string }): React.JSX.Element | null {
  const openReport = useReportDrill();
  const report = useMemo(
    () => customReportService.getCustomReports().find(r => r.id === reportId) ?? null,
    [reportId]
  );
  if (!report) return null;

  return (
    <DashboardWidgetCard
      title={report.name}
      icon={FileTextIcon}
      onOpen={() => openReport('custom-reports')}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {report.description || 'Custom report'}
      </p>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        {report.components.length} component{report.components.length === 1 ? '' : 's'} — open to generate
      </p>
    </DashboardWidgetCard>
  );
}
