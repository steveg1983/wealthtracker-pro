import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { TrendingUpIcon, TrendingDownIcon, WalletIcon } from '../icons';
import { DynamicLineChart } from '../charts/ChartMigration';
import type { TooltipProps } from 'recharts';
import { format, subMonths } from 'date-fns';
import { toDecimal } from '../../utils/decimal';

interface NetWorthTrendWidgetProps {
  isCompact?: boolean;
}

export default function NetWorthTrendWidget({ isCompact = false }: NetWorthTrendWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const { accounts, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const netWorthData = useMemo(() => {
    // Calculate current net worth
    const totalAssets = accounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum.plus(toDecimal(acc.balance)), toDecimal(0));
    
    const totalLiabilities = accounts
      .filter(acc => acc.balance < 0)
      .reduce((sum, acc) => sum.plus(toDecimal(Math.abs(acc.balance))), toDecimal(0));
    
    const currentNetWorth = totalAssets.minus(totalLiabilities);

    // Generate historical data (mock - in production, this would come from snapshots)
    const months = 6;
    const historicalData = [];
    const today = new Date();
    
    for (let i = months; i >= 0; i--) {
      const date = subMonths(today, i);
      
      // Simulate historical net worth based on transaction patterns
      let historicalValue = currentNetWorth.toNumber();
      
      // Apply rough historical adjustments based on transactions
      const monthTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === date.getMonth() && 
               tDate.getFullYear() === date.getFullYear();
      });
      
      const monthIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const monthExpenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      // Adjust historical value based on cumulative changes
      const monthlyChange = monthIncome - monthExpenses;
      historicalValue -= (monthlyChange * (i + 1));
      
      // Add some realistic variation
      historicalValue *= (1 + (Math.random() - 0.5) * 0.05);
      
      historicalData.push({
        date: format(date, 'MMM'),
        value: Math.max(0, historicalValue)
      });
    }

    // Calculate changes
    const lastMonth = historicalData[historicalData.length - 2]?.value || currentNetWorth.toNumber();
    const sixMonthsAgo = historicalData[0]?.value || currentNetWorth.toNumber();
    
    const monthChange = currentNetWorth.toNumber() - lastMonth;
    const monthChangePercent = lastMonth !== 0 ? (monthChange / lastMonth) * 100 : 0;
    
    const sixMonthChange = currentNetWorth.toNumber() - sixMonthsAgo;
    const sixMonthChangePercent = sixMonthsAgo !== 0 ? (sixMonthChange / sixMonthsAgo) * 100 : 0;

    // Calculate growth rate
    const monthlyGrowthRate = historicalData.length > 1 
      ? (currentNetWorth.toNumber() - historicalData[0].value) / historicalData.length / historicalData[0].value * 100
      : 0;

    // Find min and max for the period
    const allValues = historicalData.map(d => d.value);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    return {
      current: currentNetWorth,
      assets: totalAssets,
      liabilities: totalLiabilities,
      historicalData,
      chartPoints: historicalData.map(entry => ({ label: entry.date, value: entry.value })),
      monthChange,
      monthChangePercent,
      sixMonthChange,
      sixMonthChangePercent,
      monthlyGrowthRate,
      minValue,
      maxValue,
      trend: monthChange >= 0 ? 'up' : 'down'
    };
  }, [accounts, transactions]);

  const tooltipFormatter: TooltipProps<number, string>['formatter'] = (value) => [formatCurrency(value as number), 'Net Worth'];

  const tooltipLabelFormatter: TooltipProps<number, string>['labelFormatter'] = (label) => label ?? '';

  return (
    <div className="space-y-4">
      {/* Current Net Worth */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Net Worth</span>
          <WalletIcon size={16} className="text-gray-400" />
        </div>
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(netWorthData.current.toNumber())}
        </div>
        <div className="flex items-center gap-2 mt-2">
          {netWorthData.monthChange >= 0 ? (
            <TrendingUpIcon size={14} className="text-green-600" />
          ) : (
            <TrendingDownIcon size={14} className="text-red-600" />
          )}
          <span className={`text-sm font-medium ${
            netWorthData.monthChange >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {netWorthData.monthChange >= 0 ? '+' : ''}{formatCurrency(netWorthData.monthChange)}
            {' '}({netWorthData.monthChangePercent >= 0 ? '+' : ''}{netWorthData.monthChangePercent.toFixed(1)}%)
          </span>
          <span className="text-xs text-gray-400">vs last month</span>
        </div>
      </div>

      {/* Trend Chart */}
      <div className={isCompact ? 'h-24' : 'h-40'}>
        <DynamicLineChart
          data={netWorthData.chartPoints}
          xDataKey="label"
          yDataKeys={['value']}
          colors={[netWorthData.trend === 'up' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)']}
          height={isCompact ? 96 : 160}
        />
      </div>

      {/* Assets vs Liabilities */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div className="text-xs text-green-700 dark:text-green-300 mb-1">Assets</div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatCurrency(netWorthData.assets.toNumber())}
          </div>
        </div>
        
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <div className="text-xs text-red-700 dark:text-red-300 mb-1">Liabilities</div>
          <div className="text-lg font-bold text-red-600 dark:text-red-400">
            {formatCurrency(netWorthData.liabilities.toNumber())}
          </div>
        </div>
      </div>

      {/* Period Comparisons */}
      {!isCompact && (
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="text-xs text-gray-500 dark:text-gray-400">6 Month Change</div>
            <div className={`text-sm font-semibold ${
              netWorthData.sixMonthChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {netWorthData.sixMonthChange >= 0 ? '+' : ''}{formatCurrency(netWorthData.sixMonthChange)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ({netWorthData.sixMonthChangePercent >= 0 ? '+' : ''}{netWorthData.sixMonthChangePercent.toFixed(1)}%)
            </div>
          </div>
          
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="text-xs text-gray-500 dark:text-gray-400">Avg Monthly Growth</div>
            <div className={`text-sm font-semibold ${
              netWorthData.monthlyGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {netWorthData.monthlyGrowthRate >= 0 ? '+' : ''}{netWorthData.monthlyGrowthRate.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Min/Max Values */}
      {!isCompact && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
          <span>Low: {formatCurrency(netWorthData.minValue)}</span>
          <span>High: {formatCurrency(netWorthData.maxValue)}</span>
        </div>
      )}

      {/* View Details Button */}
      <button
        onClick={() => navigate('/analytics')}
        className="w-full text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 text-center py-2"
      >
        View Full Analysis →
      </button>
    </div>
  );
}
