import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../../hooks/useCurrencyDecimal';
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, TrendingDownIcon } from '../../icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { startOfWeek, endOfWeek } from 'date-fns';

interface CashFlowWidgetProps {
  isCompact?: boolean;
}

export default function CashFlowWidget({ isCompact = false }: CashFlowWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const { transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const cashFlowData = useMemo(() => {
    const today = new Date();
    const thisWeekStart = startOfWeek(today);
    const thisWeekEnd = endOfWeek(today);
    
    // Calculate for different periods
    const periods = {
      week: 7,
      month: 30,
      quarter: 90
    };

    const calculatePeriodFlow = (days: number) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const periodTransactions = transactions.filter(t => 
        new Date(t.date) >= startDate && new Date(t.date) <= today
      );

      const income = periodTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = periodTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        income,
        expenses,
        net: income - expenses,
        savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0
      };
    };

    const weekFlow = calculatePeriodFlow(periods.week);
    const monthFlow = calculatePeriodFlow(periods.month);
    const quarterFlow = calculatePeriodFlow(periods.quarter);

    // Calculate daily average
    const dailyAvgIncome = monthFlow.income / 30;
    const dailyAvgExpenses = monthFlow.expenses / 30;

    // Calculate weekly data for chart
    const weeklyData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      
      const weekTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date >= weekStart && date < weekEnd;
      });

      const weekIncome = weekTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const weekExpenses = weekTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      weeklyData.push({
        label: i === 0 ? 'This week' : `${i + 1}w ago`,
        income: weekIncome,
        expenses: weekExpenses,
        net: weekIncome - weekExpenses
      });
    }

    return {
      week: weekFlow,
      month: monthFlow,
      quarter: quarterFlow,
      dailyAvgIncome,
      dailyAvgExpenses,
      weeklyData,
      trend: monthFlow.net > 0 ? 'positive' : 'negative'
    };
  }, [transactions]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: !isCompact,
        position: 'bottom' as const
      },
      tooltip: {
        callbacks: {
          label: (context: unknown) => {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: !isCompact,
        grid: {
          display: false
        }
      },
      y: {
        display: !isCompact,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: (value: unknown) => {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  const chartData = {
    labels: cashFlowData.weeklyData.map(d => d.label),
    datasets: [
      {
        label: 'Income',
        data: cashFlowData.weeklyData.map(d => d.income),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1
      },
      {
        label: 'Expenses',
        data: cashFlowData.weeklyData.map(d => d.expenses),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1
      }
    ]
  };

  return (
    <div className="space-y-4">
      {/* Monthly Summary */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Monthly Cash Flow</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="flex items-center gap-1 text-green-600">
              <ArrowUpIcon size={14} />
              <span className="text-xs">Income</span>
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(cashFlowData.month.income)}
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-1 text-red-600">
              <ArrowDownIcon size={14} />
              <span className="text-xs">Expenses</span>
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(cashFlowData.month.expenses)}
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-1">
              {cashFlowData.month.net >= 0 ? (
                <TrendingUpIcon size={14} className="text-green-600" />
              ) : (
                <TrendingDownIcon size={14} className="text-red-600" />
              )}
              <span className="text-xs text-gray-600 dark:text-gray-400">Net</span>
            </div>
            <div className={`text-lg font-bold ${
              cashFlowData.month.net >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {cashFlowData.month.net >= 0 ? '+' : ''}{formatCurrency(cashFlowData.month.net)}
            </div>
          </div>
        </div>
        
        {/* Savings Rate */}
        {cashFlowData.month.savingsRate > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Savings Rate</span>
              <span className="text-sm font-semibold text-green-600">
                {cashFlowData.month.savingsRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
              <div 
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${Math.min(cashFlowData.month.savingsRate, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Weekly Comparison Chart */}
      {!isCompact && (
        <div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Weekly Comparison
          </div>
          <div className="h-32">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Period Comparisons */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-xs text-gray-500 dark:text-gray-400">Week</div>
          <div className={`text-sm font-semibold ${
            cashFlowData.week.net >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {cashFlowData.week.net >= 0 ? '+' : ''}{formatCurrency(cashFlowData.week.net)}
          </div>
        </div>
        
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-xs text-gray-500 dark:text-gray-400">Month</div>
          <div className={`text-sm font-semibold ${
            cashFlowData.month.net >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {cashFlowData.month.net >= 0 ? '+' : ''}{formatCurrency(cashFlowData.month.net)}
          </div>
        </div>
        
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-xs text-gray-500 dark:text-gray-400">Quarter</div>
          <div className={`text-sm font-semibold ${
            cashFlowData.quarter.net >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {cashFlowData.quarter.net >= 0 ? '+' : ''}{formatCurrency(cashFlowData.quarter.net)}
          </div>
        </div>
      </div>

      {/* Daily Averages */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Daily Average</div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm">
              <span className="text-green-600">↑ {formatCurrency(cashFlowData.dailyAvgIncome)}</span>
            </span>
            <span className="text-sm">
              <span className="text-red-600">↓ {formatCurrency(cashFlowData.dailyAvgExpenses)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* View Details Button */}
      <button
        onClick={() => navigate('/analytics')}
        className="w-full text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 text-center py-2"
      >
        View Analytics →
      </button>
    </div>
  );
}