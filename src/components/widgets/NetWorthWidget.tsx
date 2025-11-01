import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal, Decimal } from '../../utils/decimal';
import { DecimalInstance, DecimalAccount, DecimalTransaction } from '../../types/decimal-types';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUpIcon, TrendingDownIcon } from '../icons';
import type { BaseWidgetProps } from '../../types/widget-types';

type NetWorthWidgetProps = BaseWidgetProps;

export default function NetWorthWidget({ size = 'medium' }: NetWorthWidgetProps): React.JSX.Element {
  const { getDecimalAccounts, getDecimalTransactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const { netWorth, change, changePercent, chartData } = useMemo(() => {
    const accounts = getDecimalAccounts();
    const transactions = getDecimalTransactions();
    
    // Calculate current net worth
    const currentNetWorth = accounts.reduce((sum: DecimalInstance, acc: DecimalAccount) => sum.plus(acc.balance), toDecimal(0));
    
    // Calculate historical net worth for the last 12 months
    const monthlyData = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Calculate net worth at end of this month
      // Start with initial balances and apply transactions
      let monthNetWorth = toDecimal(0);
      accounts.forEach((account: DecimalAccount) => {
        let balance = account.balance;
        
        // Subtract transactions that happened after this month
        const futureTransactions = transactions.filter((t: DecimalTransaction) => {
          const tDate = new Date(t.date);
          return tDate > endOfMonth && t.accountId === account.id;
        });
        
        futureTransactions.forEach((t: DecimalTransaction) => {
          if (t.type === 'income') {
            balance = balance.minus(t.amount);
          } else {
            balance = balance.plus(t.amount);
          }
        });
        
        monthNetWorth = monthNetWorth.plus(balance);
      });
      
      monthlyData.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: i > 0 ? undefined : 'numeric' }),
        value: monthNetWorth.toNumber(),
        date: date.toISOString()
      });
    }
    
    // Calculate change from last month
    const lastMonthValue = monthlyData[monthlyData.length - 2]?.value || 0;
    const currentValue = currentNetWorth.toNumber();
    const change = toDecimal(currentValue - lastMonthValue);
    const changePercent = lastMonthValue > 0 
      ? change.dividedBy(toDecimal(lastMonthValue)).times(100)
      : toDecimal(0);
    
    return {
      netWorth: currentNetWorth,
      change,
      changePercent,
      chartData: monthlyData
    };
  }, [getDecimalAccounts, getDecimalTransactions]);

  const isPositive = change.greaterThanOrEqualTo(0);
  const changePercentDisplay = changePercent.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString();

  if (size === 'small') {
    return (
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {formatCurrency(netWorth)}
        </div>
        <div className={`flex items-center justify-center gap-1 text-sm ${
          isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {isPositive ? <TrendingUpIcon size={16} /> : <TrendingDownIcon size={16} />}
          <span>{isPositive ? '+' : ''}{formatCurrency(change)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(netWorth)}
          </div>
          <div className={`flex items-center gap-1 text-sm ${
            isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isPositive ? <TrendingUpIcon size={16} /> : <TrendingDownIcon size={16} />}
            <span>{isPositive ? '+' : ''}{formatCurrency(change)}</span>
            <span>({isPositive ? '+' : ''}{changePercentDisplay}%)</span>
          </div>
        </div>
      </div>

      {size === 'large' && (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="month" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => {
                  const decimalValue = toDecimal(value);
                  if (decimalValue.greaterThanOrEqualTo(1000000)) {
                    const scaled = decimalValue.dividedBy(1000000).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
                    const raw = scaled.toString();
                    const [intPart, fracPart = ''] = raw.split('.');
                    const formatted = `${intPart}.${fracPart.padEnd(1, '0')}`;
                    return `${formatted}M`;
                  }
                  if (decimalValue.greaterThanOrEqualTo(1000)) {
                    const scaled = decimalValue.dividedBy(1000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
                    return `${scaled.toString()}K`;
                  }
                  return decimalValue.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString();
                }}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
                labelFormatter={(label) => `Month: ${label}`}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
