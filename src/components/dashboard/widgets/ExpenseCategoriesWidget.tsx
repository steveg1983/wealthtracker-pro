import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../../hooks/useCurrencyDecimal';
import { PieChartIcon, TrendingUpIcon, TrendingDownIcon } from '../../icons';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ExpenseCategoriesWidgetProps {
  isCompact?: boolean;
}

interface CategoryData {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  trend: number; // Percentage change vs last period
}

export default function ExpenseCategoriesWidget({ isCompact = false }: ExpenseCategoriesWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const { transactions, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const categoryData = useMemo(() => {
    const today = new Date();
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // Get this month's expenses by category
    const thisMonthExpenses = transactions.filter(t => 
      t.type === 'expense' && 
      new Date(t.date) >= thisMonthStart
    );

    // Get last month's expenses for comparison
    const lastMonthExpenses = transactions.filter(t => 
      t.type === 'expense' && 
      new Date(t.date) >= lastMonthStart &&
      new Date(t.date) <= lastMonthEnd
    );

    // Group by category
    const categoryTotals = new Map<string, { current: number; previous: number }>();
    
    thisMonthExpenses.forEach(t => {
      const category = t.categoryId || 'Uncategorized';
      const existing = categoryTotals.get(category) || { current: 0, previous: 0 };
      categoryTotals.set(category, {
        ...existing,
        current: existing.current + Math.abs(t.amount)
      });
    });

    lastMonthExpenses.forEach(t => {
      const category = t.categoryId || 'Uncategorized';
      const existing = categoryTotals.get(category) || { current: 0, previous: 0 };
      categoryTotals.set(category, {
        ...existing,
        previous: existing.previous + Math.abs(t.amount)
      });
    });

    // Calculate total for percentages
    const totalExpenses = Array.from(categoryTotals.values())
      .reduce((sum, cat) => sum + cat.current, 0);

    // Define colors for categories
    const colors = [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#14B8A6', // Teal
      '#F97316', // Orange
      '#6B7280', // Gray
      '#84CC16', // Lime
    ];

    // Convert to array and calculate percentages
    const categoryArray: CategoryData[] = Array.from(categoryTotals.entries())
      .map(([name, amounts], index) => {
        const percentage = totalExpenses > 0 ? (amounts.current / totalExpenses) * 100 : 0;
        const trend = amounts.previous > 0 
          ? ((amounts.current - amounts.previous) / amounts.previous) * 100
          : 0;
        
        return {
          name,
          amount: amounts.current,
          percentage,
          color: colors[index % colors.length],
          trend
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, isCompact ? 5 : 8); // Limit categories shown

    // Add "Others" category if there are more
    const othersAmount = Array.from(categoryTotals.values())
      .reduce((sum, cat) => sum + cat.current, 0) - 
      categoryArray.reduce((sum, cat) => sum + cat.amount, 0);
    
    if (othersAmount > 0) {
      categoryArray.push({
        name: 'Others',
        amount: othersAmount,
        percentage: (othersAmount / totalExpenses) * 100,
        color: '#9CA3AF',
        trend: 0
      });
    }

    return {
      categories: categoryArray,
      totalExpenses,
      topCategory: categoryArray[0],
      categoryCount: categoryTotals.size
    };
  }, [transactions, categories]);

  if (categoryData.categories.length === 0) {
    return (
      <div className="text-center py-8">
        <PieChartIcon size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500 dark:text-gray-400">No expenses this month</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Start tracking your expenses
        </p>
      </div>
    );
  }

  const chartData = {
    labels: categoryData.categories.map(cat => cat.name),
    datasets: [
      {
        data: categoryData.categories.map(cat => cat.amount),
        backgroundColor: categoryData.categories.map(cat => cat.color),
        borderColor: categoryData.categories.map(cat => cat.color),
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = formatCurrency(context.raw);
            const percentage = categoryData.categories[context.dataIndex].percentage.toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '60%'
  };

  return (
    <div className="space-y-4">
      {/* Total Expenses */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Expenses</span>
          <PieChartIcon size={16} className="text-gray-400" />
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(categoryData.totalExpenses)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Across {categoryData.categoryCount} categories
        </div>
      </div>

      {/* Chart and Legend */}
      <div className="flex gap-4">
        {/* Donut Chart */}
        <div className="w-32 h-32 flex-shrink-0">
          <Doughnut data={chartData} options={chartOptions} />
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1 overflow-y-auto max-h-32">
          {categoryData.categories.slice(0, isCompact ? 4 : 6).map((category, index) => (
            <div key={category.name} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                  {category.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {formatCurrency(category.amount)}
                </span>
                {category.trend !== 0 && (
                  <span className={`text-xs flex items-center ${
                    category.trend > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {category.trend > 0 ? (
                      <TrendingUpIcon size={10} />
                    ) : (
                      <TrendingDownIcon size={10} />
                    )}
                    {Math.abs(category.trend).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Category Alert */}
      {categoryData.topCategory && categoryData.topCategory.percentage > 40 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <strong>{categoryData.topCategory.name}</strong> represents {categoryData.topCategory.percentage.toFixed(0)}% of your spending
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {!isCompact && (
        <div className="space-y-2">
          {categoryData.categories.slice(0, 3).map(category => (
            <div key={category.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {category.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(category.amount)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {category.percentage.toFixed(1)}%
                  </div>
                </div>
                {category.trend !== 0 && (
                  <div className={`flex items-center gap-1 ${
                    category.trend > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {category.trend > 0 ? (
                      <TrendingUpIcon size={12} />
                    ) : (
                      <TrendingDownIcon size={12} />
                    )}
                    <span className="text-xs">
                      {Math.abs(category.trend).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Details Button */}
      <button
        onClick={() => navigate('/analytics')}
        className="w-full text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 text-center py-2"
      >
        View Spending Analysis →
      </button>
    </div>
  );
}