import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { TrendingUpIcon, TrendingDownIcon, LineChartIcon } from '../icons';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

interface InvestmentSummaryWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: {
    showChart?: boolean;
    period?: '1M' | '3M' | '6M' | '1Y' | 'ALL';
  };
}

export default function InvestmentSummaryWidget({ size, settings }: InvestmentSummaryWidgetProps) {
  const { accounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const showChart = settings.showChart ?? true;
  const period = settings.period || '1M';

  const investmentAccounts = useMemo(() => {
    return accounts.filter(account => account.type === 'investment');
  }, [accounts]);

  const holdings = useMemo(() => {
    const result: {
      accountId: string;
      shares: number;
      averageCost: number;
      marketValue: number;
    }[] = [];

    accounts.forEach((account) => {
      if (account.type !== 'investment' || !account.holdings) {
        return;
      }

      account.holdings.forEach((holding) => {
        const shares = holding.shares ?? 0;
        const averageCost = holding.averageCost ?? 0;
        const marketValue = holding.marketValue ?? holding.value ?? shares * (holding.currentPrice ?? 0);

        result.push({
          accountId: account.id,
          shares,
          averageCost,
          marketValue
        });
      });
    });

    return result;
  }, [accounts]);

  const portfolioData = useMemo(() => {
    const totalValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);

    const totalCost = holdings.reduce((sum, holding) => sum + holding.shares * holding.averageCost, 0);
    const totalGains = totalValue - totalCost;
    const gainPercentage = totalCost > 0 ? (totalGains / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalGains,
      gainPercentage,
      accountCount: investmentAccounts.length
    };
  }, [holdings, investmentAccounts]);

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

  if (investmentAccounts.length === 0 || holdings.length === 0) {
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
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                contentStyle={{
                  backgroundColor: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="var(--color-primary)" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
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