import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, isToday, isFuture } from 'date-fns';
import { useCashFlowForecast } from '../hooks/useCashFlowForecast';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { 
  TrendingUpIcon, 
  TrendingDownIcon, 
  AlertCircleIcon,
  CalendarIcon,
  RefreshCwIcon,
  PlusIcon,
  EditIcon,
  DeleteIcon,
  ChevronRightIcon,
  ActivityIcon
} from './icons';
import { LoadingState } from './loading/LoadingState';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';
import type { RecurringPattern } from '../services/cashFlowForecastService';
import type { DecimalInstance } from '../types/decimal-types';
import { toDecimal } from '../utils/decimal';

interface CashFlowForecastProps {
  accountIds?: string[];
  className?: string;
}

export default function CashFlowForecast({ accountIds, className = '' }: CashFlowForecastProps) {
  const { formatCurrency } = useCurrencyDecimal();
  const [forecastMonths, setForecastMonths] = useState(6);
  const [showPatterns, setShowPatterns] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<RecurringPattern | null>(null);
  
  const { 
    forecast, 
    isLoading, 
    error, 
    refresh,
    updatePattern,
    removePattern 
  } = useCashFlowForecast({
    months: forecastMonths,
    accountIds
  });

  if (isLoading) {
    return <LoadingState message="Analyzing cash flow patterns..." />;
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!forecast) {
    return null;
  }

  // Prepare chart data
  const chartData = forecast.projections
    .filter((_, index) => index % 7 === 0) // Weekly data points
    .map(proj => ({
      date: format(proj.date, 'MMM d'),
      balance: proj.projectedBalance.toNumber(),
      income: proj.projectedIncome.toNumber(),
      expenses: proj.projectedExpenses.toNumber(),
      confidence: proj.confidence
    }));

  // Group patterns by type
  const incomePatterns = forecast.recurringPatterns.filter(p => p.type === 'income');
  const expensePatterns = forecast.recurringPatterns.filter(p => p.type === 'expense');

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cash Flow Forecast</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Based on your transaction history and detected patterns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={forecastMonths}
            onChange={(e) => setForecastMonths(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
          <button
            onClick={refresh}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh forecast"
          >
            <RefreshCwIcon size={20} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Projected End Balance</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(forecast.summary.projectedEndBalance)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                in {forecastMonths} months
              </p>
            </div>
            <ActivityIcon className="text-primary" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Monthly Income</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                +{formatCurrency(forecast.summary.averageMonthlyIncome)}
              </p>
            </div>
            <TrendingUpIcon className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Monthly Expenses</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                -{formatCurrency(forecast.summary.averageMonthlyExpenses)}
              </p>
            </div>
            <TrendingDownIcon className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Monthly Savings</p>
              <p className={`text-xl font-bold ${
                forecast.summary.averageMonthlySavings.greaterThanOrEqualTo(0)
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {forecast.summary.averageMonthlySavings.greaterThanOrEqualTo(0) ? '+' : ''}
                {formatCurrency(forecast.summary.averageMonthlySavings)}
              </p>
            </div>
            <ActivityIcon 
              className={
                forecast.summary.averageMonthlySavings.greaterThanOrEqualTo(0)
                  ? 'text-green-500'
                  : 'text-red-500'
              } 
              size={24} 
            />
          </div>
        </div>
      </div>

      {/* Alert for low balance */}
      {forecast.summary.lowestProjectedBalance.lessThan(0) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-red-600 dark:text-red-400 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-300">
                Projected Negative Balance
              </h3>
              <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                Your balance is projected to reach {formatCurrency(forecast.summary.lowestProjectedBalance)} 
                on {format(forecast.summary.lowestBalanceDate, 'MMMM d, yyyy')}.
                Consider adjusting your spending or increasing income.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Projection Chart */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Balance Projection
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#666"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => formatCurrency(toDecimal(value))}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(toDecimal(value))}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}
              />
              <ReferenceLine y={0} stroke="#ff0000" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#balanceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recurring Patterns */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Detected Patterns ({forecast.recurringPatterns.length})
          </h3>
          <button
            onClick={() => setShowPatterns(!showPatterns)}
            className="text-sm text-primary hover:text-secondary transition-colors"
          >
            {showPatterns ? 'Hide' : 'Show'} Details
            <ChevronRightIcon 
              size={16} 
              className={`inline-block ml-1 transition-transform ${showPatterns ? 'rotate-90' : ''}`} 
            />
          </button>
        </div>

        {showPatterns && (
          <div className="space-y-4">
            {/* Income Patterns */}
            {incomePatterns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Income Patterns ({incomePatterns.length})
                </h4>
                <div className="space-y-2">
                  {incomePatterns.map(pattern => (
                    <PatternCard
                      key={pattern.id}
                      pattern={pattern}
                      formatCurrency={formatCurrency}
                      onEdit={() => setSelectedPattern(pattern)}
                      onRemove={() => removePattern(pattern.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Expense Patterns */}
            {expensePatterns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expense Patterns ({expensePatterns.length})
                </h4>
                <div className="space-y-2">
                  {expensePatterns.map(pattern => (
                    <PatternCard
                      key={pattern.id}
                      pattern={pattern}
                      formatCurrency={formatCurrency}
                      onEdit={() => setSelectedPattern(pattern)}
                      onRemove={() => removePattern(pattern.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Pattern Card Component
function PatternCard({ 
  pattern, 
  formatCurrency, 
  onEdit, 
  onRemove 
}: { 
  pattern: RecurringPattern; 
  formatCurrency: (value: DecimalInstance | number) => string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            pattern.type === 'income' ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {pattern.description}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatCurrency(pattern.amount)} • {pattern.frequency} • 
              Next: {format(pattern.nextOccurrence, 'MMM d')}
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Confidence</p>
          <p className="font-medium text-gray-900 dark:text-white">{pattern.confidence}%</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-1 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary rounded transition-colors"
            title="Edit pattern"
          >
            <EditIcon size={16} />
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
            title="Remove pattern"
          >
            <DeleteIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}