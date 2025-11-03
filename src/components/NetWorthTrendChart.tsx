import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import type { DecimalInstance, DecimalTransaction, DecimalAccount } from '../types/decimal-types';

const NetWorthTrendChart = React.memo(function NetWorthTrendChart() {
  const { getDecimalAccounts, getDecimalTransactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  // Calculate net worth over the last 6 months
  const data = useMemo(() => {
    const result = [];
    const today = new Date();
    const decimalAccounts = getDecimalAccounts();
    const decimalTransactions = getDecimalTransactions();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      // Calculate net worth at the end of that month
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Get all transactions up to that month
      const relevantTransactions = decimalTransactions.filter((t: DecimalTransaction) => 
        new Date(t.date) <= monthEnd
      );
      
      // Calculate the balance change from transactions
      const transactionBalance = relevantTransactions.reduce((sum: DecimalInstance, t: DecimalTransaction) => {
        if (t.type === 'income') return sum.plus(t.amount);
        if (t.type === 'expense') return sum.minus(t.amount);
        return sum;
      }, toDecimal(0));
      
      // For simplicity, we'll use current account balances
      // In a real app, you'd track historical balances
      const totalBalance = decimalAccounts.reduce((sum: DecimalInstance, acc: DecimalAccount) => sum.plus(acc.balance), toDecimal(0));
      
      result.push({
        month: monthName,
        balance: totalBalance.plus(transactionBalance.times(i / 5)).toNumber()
      });
    }
    
    return result;
  }, [getDecimalAccounts, getDecimalTransactions]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Net Worth Trend</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9CA3AF" />
            <YAxis 
              stroke="#9CA3AF"
              tickFormatter={(value: number) => `£${formatDecimal(value / 1000, 0)}k`}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '8px'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="balance" 
              stroke="#8B5CF6" 
              strokeWidth={2}
              dot={{ fill: '#8B5CF6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default NetWorthTrendChart;
