import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { transactionAnalyticsService } from '../services/transactionAnalyticsService';

const SpendingByCategoryChart = React.memo(function SpendingByCategoryChart() {
  const { transactions, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  // Calculate spending by category using the service
  const data = useMemo(() => {
    const spendingByCategory = transactionAnalyticsService.calculateSpendingByCategory(
      transactions,
      categories,
      undefined, // no start date
      undefined, // no end date
      'expense'
    );

    return spendingByCategory
      .slice(0, 6) // Top 6 categories
      .map(item => ({ 
        name: item.categoryName, 
        value: item.amount 
      }));
  }, [transactions, categories]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // Create accessible description of the data
  const chartDescription = useMemo(() => {
    if (data.length === 0) return 'No expense data available';
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const items = data.map(item => {
      const percentage = ((item.value / total) * 100).toFixed(1);
      return `${item.name}: ${formatCurrency(item.value)} (${percentage}%)`;
    }).join(', ');
    
    return `Spending breakdown by category: ${items}`;
  }, [data, formatCurrency]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Spending by Category</h2>
      {data.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No expense data available
        </p>
      ) : (
        <div className="h-64" role="img" aria-label={chartDescription}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart role="presentation">
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Accessible data table for screen readers */}
      {data.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200">
            View data in table format
          </summary>
          <table className="mt-2 w-full text-sm" role="table">
            <caption className="sr-only">Spending by category breakdown</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left py-1">Category</th>
                <th scope="col" className="text-right py-1">Amount</th>
                <th scope="col" className="text-right py-1">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const total = data.reduce((sum, d) => sum + d.value, 0);
                const percentage = ((item.value / total) * 100).toFixed(1);
                return (
                  <tr key={index}>
                    <td className="py-1">{item.name}</td>
                    <td className="text-right py-1">{formatCurrency(item.value)}</td>
                    <td className="text-right py-1">{percentage}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
});

export default SpendingByCategoryChart;
