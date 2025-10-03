import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { Investment } from '../../types';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { TrendingUpIcon, TrendingDownIcon, LineChartIcon } from '../icons';
import { DynamicPieChart, DynamicBarChart, DynamicLineChart, DynamicAreaChart, DynamicTreemap } from '../charts/ChartMigration';

interface InvestmentSummaryWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: {
    showChart?: boolean;
    period?: '1M' | '3M' | '6M' | '1Y' | 'ALL';
  };
}

export default function InvestmentSummaryWidget({ size, settings }: InvestmentSummaryWidgetProps) {
  const { accounts, investments = [] } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const showChart = settings.showChart ?? true;
  const period = settings.period || '1M';

  const investmentAccounts = useMemo(() => {
    return accounts.filter(account => account.type === 'investment');
  }, [accounts]);

  const portfolioData = useMemo(() => {
    const totalValue = investmentAccounts.reduce((sum, account) => sum + account.balance, 0);
    
    // Calculate total cost basis and gains
    let totalCost = 0;
    let totalGains = 0;
    
    if (investments) {
      investments.forEach((inv: Investment) => {
        const quantity = inv.quantity || 0;
        const costBasis = inv.costBasis || 0;
        const currentPrice = inv.currentPrice || 0;
        
        totalCost += quantity * costBasis;
        const currentValue = quantity * currentPrice;
        totalGains += currentValue - (quantity * costBasis);
      });
    }

    const gainPercentage = totalCost > 0 ? (totalGains / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalGains,
      gainPercentage,
      accountCount: investmentAccounts.length
    };
  }, [investmentAccounts, investments]);

  // Mock historical data for chart
  const chartData = useMemo(() => {
    const now = new Date();
    const dataPoints = [];
    const baseValue = portfolioData.totalValue;
    
    let points = 30;
    switch (period) {
      case '3M': points = 90; break;
      case '6M': points = 180; break;
      case '1Y': points = 365; break;
      case 'ALL': points = 365 * 2; break;
    }

    for (let i = points; i >= 0; i -= Math.ceil(points / 30)) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Simulate some volatility
      const volatility = (Math.random() - 0.5) * 0.02;
      const trend = i > 0 ? Math.pow(1.0008, i) : 1; // Slight upward trend
      const value = baseValue / trend * (1 + volatility);
      
      dataPoints.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100
      });
    }
    
    return dataPoints;
  }, [portfolioData.totalValue, period]);

  if (investmentAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <LineChartIcon size={48} className="mb-2 opacity-50" />
        <p className="text-sm">No investment accounts</p>
        <a href="/accounts" className="text-xs text-primary hover:underline mt-1">
          Add investment account
        </a>
      </div>
    );
  }

  const isPositive = portfolioData.totalGains >= 0;

  return (
    <div className="space-y-4">
      {/* Portfolio Value */}
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(portfolioData.totalValue)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Portfolio Value
        </p>
      </div>

      {/* Gains/Losses */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className={`text-lg font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? '+' : ''}{formatCurrency(portfolioData.totalGains)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Total {isPositive ? 'Gains' : 'Losses'}
          </p>
        </div>
        <div>
          <div className={`flex items-center gap-1 text-lg font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? <TrendingUpIcon size={16} /> : <TrendingDownIcon size={16} />}
            {isPositive ? '+' : ''}{portfolioData.gainPercentage.toFixed(2)}%
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Return Rate
          </p>
        </div>
      </div>

      {/* Chart */}
      {showChart && size !== 'small' && (
        <div style={{ height: size === 'medium' ? 150 : 200 }}>
          <DynamicLineChart
          data={chartData}
          xDataKey="date"
          yDataKeys={['value']}
          height={200}
        />
        </div>
      )}

      {/* Account Summary */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {portfolioData.accountCount} Investment {portfolioData.accountCount === 1 ? 'Account' : 'Accounts'}
          </span>
          <a href="/investments" className="text-primary hover:underline">
            View Details →
          </a>
        </div>
      </div>
    </div>
  );
}