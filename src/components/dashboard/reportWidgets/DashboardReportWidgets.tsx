import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { preserveDemoParam } from '../../../utils/navigation';
import { buildMonthlyTrend } from '../../../utils/monthlyTrend';
import { buildNetWorthSnapshots } from '../../../utils/netWorthSeries';
import { computeExpenseCategoryNetTotals } from '../../../utils/categoryNetting';
import { expandSplitTransactions } from '../../../utils/transactionSplits';
import { formatDecimal } from '../../../utils/decimal-format';
import { customReportService } from '../../../services/customReportService';
import type { PeriodRange } from '../../../hooks/usePeriod';
import { TrendingUpIcon, PieChartIcon, BarChart3Icon, FileTextIcon } from '../../icons';
import DashboardWidgetCard from './DashboardWidgetCard';
import { WIDGET_CHART_HEIGHT } from './widgetChrome';

/**
 * Compact, live versions of the Reports-hub reports for the Dashboard's
 * "pinned reports" section. Each widget computes from the SAME shared maths
 * as its full report (utils/monthlyTrend, utils/netWorthSeries,
 * utils/categoryNetting), so the glance and the full view can never
 * disagree.
 *
 * Every card clicks through to ITS report in the gallery — the ids below are
 * the report gallery's stable URL segments (see pages/reports/reportRegistry).
 *
 * Every chart area is WIDGET_CHART_HEIGHT and every card wears the same shell,
 * so the four cards in the section are one height rather than four.
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

export function NetWorthWidget({ range }: { range: PeriodRange }): React.JSX.Element {
  const { accounts, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();

  const snapshots = useMemo(
    () => buildNetWorthSnapshots(accounts, transactions, range),
    [accounts, transactions, range]
  );
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return (
    <DashboardWidgetCard
      title="Net Worth Over Time"
      icon={TrendingUpIcon}
      subtitle={
        <span className="text-xl font-bold text-gray-900 dark:text-white truncate">
          {latest ? formatCurrency(latest.netWorth) : '—'}
        </span>
      }
      onOpen={() => navigate(preserveDemoParam('/reports/net-worth-over-time', location.search))}
    >
      <div className={WIDGET_CHART_HEIGHT}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={snapshots}>
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

export function IncomeExpenseTrendWidget({ range }: { range: PeriodRange }): React.JSX.Element {
  const { transactions, transactionSplits, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();

  const data = useMemo(() => {
    const rows = expandSplitTransactions(transactions, transactionSplits).filter(t => {
      const time = new Date(t.date).getTime();
      if (range.from && time < range.from.getTime()) return false;
      if (range.to && time > range.to.getTime()) return false;
      return true;
    });
    return buildMonthlyTrend(rows, categories);
  }, [transactions, transactionSplits, categories, range]);

  return (
    <DashboardWidgetCard
      title="Income vs Expenses"
      icon={BarChart3Icon}
      subtitle={
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          Month by month, what came in against what went out
        </span>
      }
      onOpen={() => navigate(preserveDemoParam('/reports/income-and-spending-over-time', location.search))}
    >
      <div className={WIDGET_CHART_HEIGHT}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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

export function ExpenseCategoriesWidget({ range }: { range: PeriodRange }): React.JSX.Element {
  const { transactions, transactionSplits, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <DashboardWidgetCard
      title="Expense Categories"
      icon={PieChartIcon}
      subtitle={
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          Where the money went, biggest first
        </span>
      }
      onOpen={() => navigate(preserveDemoParam('/reports/spending-by-category', location.search))}
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
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="88%" strokeWidth={0} isAnimationActive={false}>
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number | string) => formatCurrency(typeof v === 'number' ? v : Number(v))} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-36 space-y-1">
            {data.slice(0, 5).map((d, i) => (
              <li key={d.categoryId} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                <span className="truncate">{d.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardWidgetCard>
  );
}

/** A pinned custom report: name + description, click-through to the hub. */
export function CustomReportWidget({ reportId }: { reportId: string }): React.JSX.Element | null {
  const navigate = useNavigate();
  const location = useLocation();
  const report = useMemo(
    () => customReportService.getCustomReports().find(r => r.id === reportId) ?? null,
    [reportId]
  );
  if (!report) return null;

  return (
    <DashboardWidgetCard
      title={report.name}
      icon={FileTextIcon}
      onOpen={() => navigate(preserveDemoParam('/reports/custom-reports', location.search))}
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
