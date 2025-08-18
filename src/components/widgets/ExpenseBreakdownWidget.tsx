import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { PieChartIcon } from '../icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ExpenseBreakdownWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: {
    period?: 'week' | 'month' | 'quarter' | 'year';
    showLegend?: boolean;
  };
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6',
  '#F97316', '#06B6D4', '#84CC16', '#A855F7'
];

export default function ExpenseBreakdownWidget({ size, settings }: ExpenseBreakdownWidgetProps): React.JSX.Element {
  const { transactions, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const period = settings.period || 'month';
  const showLegend = settings.showLegend ?? true;

  const expenseData = useMemo(() => {
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const expenses = transactions.filter(t => 
      t.type === 'expense' && 
      new Date(t.date) >= startDate
    );

    const categoryTotals = expenses.reduce((acc, t) => {
      const category = categories.find(c => c.id === t.category);
      const categoryName = category?.name || 'Uncategorized';
      acc[categoryName] = (acc[categoryName] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, size === 'small' ? 5 : size === 'medium' ? 8 : 12);
  }, [transactions, categories, period, size]);

  const totalExpenses = useMemo(() => {
    return expenseData.reduce((sum, item) => sum + item.value, 0);
  }, [expenseData]);

  if (expenseData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <PieChartIcon size={48} className="mb-2 opacity-50" />
        <p className="text-sm">No expense data</p>
        <p className="text-xs mt-1">Make some transactions to see breakdown</p>
      </div>
    );
  }

  const chartHeight = size === 'small' ? 200 : size === 'medium' ? 250 : 300;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(totalExpenses)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Total {period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : period === 'quarter' ? 'Quarterly' : 'Yearly'} Expenses
        </p>
      </div>

      {/* Chart */}
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={expenseData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={size !== 'small' ? ({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%` : false}
              outerRadius={size === 'small' ? 60 : size === 'medium' ? 80 : 100}
              fill="#8884d8"
              dataKey="value"
            >
              {expenseData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px'
              }}
            />
            {showLegend && size !== 'small' && (
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry) => `${value}: ${formatCurrency(typeof entry.value === 'number' ? entry.value : 0)}`}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Category List for Small Size */}
      {size === 'small' && (
        <div className="space-y-2">
          {expenseData.slice(0, 3).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
              </div>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}