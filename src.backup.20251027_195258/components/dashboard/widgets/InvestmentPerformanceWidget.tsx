import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../../hooks/useCurrencyDecimal';
import { TrendingUpIcon, TrendingDownIcon, ActivityIcon } from '../../icons';
import { formatSignedPercentageValue, toDecimal } from '@wealthtracker/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { generateChartColors } from '../../charts/optimizedChartHelpers';
import type { Account } from '../../../types';

const getAccountSubtype = (account: Account): string | null => {
  const subtype = (account as { subtype?: unknown }).subtype;
  return typeof subtype === 'string' ? subtype : null;
};

interface InvestmentPerformanceWidgetProps {
  isCompact?: boolean;
}

export default function InvestmentPerformanceWidget({ isCompact = false }: InvestmentPerformanceWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const { accounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const chartPalette = useMemo(() => generateChartColors(2), []);
  const primaryChartColor = chartPalette[0] ?? '#3b82f6';
  const secondaryChartColor = chartPalette[1] ?? 'rgba(59, 130, 246, 0.35)';

  const investmentData = useMemo(() => {
    // Get investment accounts
    const investmentAccounts = accounts.filter(acc => 
      acc.type === 'investment' || getAccountSubtype(acc) === 'retirement'
    );

    // Calculate total portfolio value
    const totalValue = investmentAccounts.reduce((sum, acc) => 
      sum.plus(toDecimal(acc.balance)), toDecimal(0)
    );

    // Calculate mock performance data (in production, this would come from market data API)
    const currentMonth = new Date().getMonth();
    const mockMonthlyReturns = [2.3, -1.2, 3.5, 0.8, -0.5, 2.1, 1.9, -0.3, 2.8, 1.5, 0.9, 3.2];
    const monthlyReturn = mockMonthlyReturns[currentMonth];
    const ytdReturn = mockMonthlyReturns.slice(0, currentMonth + 1).reduce((sum, r) => sum + r, 0);
    
    // Calculate gains/losses
    const dayChange = totalValue.times(0.0045); // Mock daily change
    const monthChange = totalValue.times((monthlyReturn || 0) / 100);
    const yearChange = totalValue.times(ytdReturn / 100);

    // Generate chart data (mock historical values)
    const chartLabels = ['6M ago', '5M ago', '4M ago', '3M ago', '2M ago', '1M ago', 'Today'];
    const baseValue = totalValue.toNumber();
    const chartData = [
      baseValue * 0.92,
      baseValue * 0.94,
      baseValue * 0.91,
      baseValue * 0.95,
      baseValue * 0.97,
      baseValue * 0.98,
      baseValue
    ].map((value, index) => ({
      label: chartLabels[index],
      value
    }));

    // Find best and worst performers (mock data)
    const performers = investmentAccounts.map(acc => ({
      name: acc.name,
      value: acc.balance,
      change: (Math.random() - 0.5) * 10, // Mock daily change percentage
      changeAmount: toDecimal(acc.balance).times((Math.random() - 0.5) * 0.1)
    })).sort((a, b) => b.change - a.change);

    return {
      totalValue,
      accountCount: investmentAccounts.length,
      dayChange,
      monthChange,
      yearChange,
      monthlyReturn,
      ytdReturn,
      chartLabels,
      chartData,
      topPerformer: performers[0],
      worstPerformer: performers[performers.length - 1],
      accounts: investmentAccounts
    };
  }, [accounts]);

  if (investmentData.accountCount === 0) {
    return (
      <div className="text-center py-8">
        <TrendingUpIcon size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500 dark:text-gray-400">No investment accounts</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Add investment accounts to track performance
        </p>
      </div>
    );
  }

  const monthlyReturnDecimal = toDecimal(investmentData.monthlyReturn ?? 0);
  const monthlyReturnDisplay = formatSignedPercentageValue(monthlyReturnDecimal, 1);
  const monthlyReturnClass = monthlyReturnDecimal.greaterThanOrEqualTo(0) ? 'text-green-600' : 'text-red-600';

  const ytdReturnDecimal = toDecimal(investmentData.ytdReturn ?? 0);
  const ytdReturnDisplay = formatSignedPercentageValue(ytdReturnDecimal, 1);
  const ytdReturnClass = ytdReturnDecimal.greaterThanOrEqualTo(0) ? 'text-green-600' : 'text-red-600';

  const topChangeDisplay = investmentData.topPerformer
    ? formatSignedPercentageValue(investmentData.topPerformer.change ?? 0, 1)
    : null;
  const worstChangeDisplay = investmentData.worstPerformer
    ? formatSignedPercentageValue(investmentData.worstPerformer.change ?? 0, 1)
    : null;

  const chartTooltip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) {
      return null;
    }

    const datum = payload[0];
    const rawValue = datum?.value ?? 0;
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    return (
      <div className="rounded-md bg-white px-3 py-2 shadow-md dark:bg-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">Portfolio Value</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {formatCurrency(value)}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Portfolio Value */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Portfolio Value</span>
          <ActivityIcon size={16} className="text-gray-400" />
        </div>
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(investmentData.totalValue.toNumber())}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className={`flex items-center gap-1 ${
            investmentData.dayChange.greaterThan(0) ? 'text-green-600' : 'text-red-600'
          }`}>
            {investmentData.dayChange.greaterThan(0) ? (
              <TrendingUpIcon size={14} />
            ) : (
              <TrendingDownIcon size={14} />
            )}
            <span className="text-sm font-medium">
              {investmentData.dayChange.greaterThan(0) ? '+' : ''}{formatCurrency(investmentData.dayChange.toNumber())}
            </span>
          </div>
          <span className="text-xs text-gray-400">Today</span>
        </div>
      </div>

      {/* Performance Chart */}
      {!isCompact && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={investmentData.chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={value => formatCurrency(Number(value))}
              />
              <RechartsTooltip content={chartTooltip} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={primaryChartColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: primaryChartColor, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className={`text-sm font-semibold ${monthlyReturnClass}`}>
            {monthlyReturnDisplay}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Month</div>
        </div>
        
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className={`text-sm font-semibold ${ytdReturnClass}`}>
            {ytdReturnDisplay}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">YTD</div>
        </div>
        
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {investmentData.accountCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Accounts</div>
        </div>
      </div>

      {/* Top/Bottom Performers */}
      {!isCompact && investmentData.topPerformer && investmentData.worstPerformer && (
        <div className="space-y-2">
          <div
            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border-l-4"
            style={{ borderColor: primaryChartColor }}
          >
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Best Today</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {investmentData.topPerformer.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold" style={{ color: primaryChartColor }}>
                {topChangeDisplay ?? '0%'}
              </div>
            </div>
          </div>

          <div
            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border-l-4"
            style={{ borderColor: secondaryChartColor }}
          >
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Worst Today</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {investmentData.worstPerformer.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold" style={{ color: secondaryChartColor }}>
                {worstChangeDisplay ?? '0%'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Button */}
      <button
        onClick={() => navigate('/investments')}
        className="w-full text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 text-center py-2"
      >
        View Portfolio →
      </button>
    </div>
  );
}
