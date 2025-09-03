import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSeasonalAnalysis } from '../hooks/useCashFlowForecast';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { LoadingState } from './loading/LoadingState';
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon } from './icons';

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

interface SeasonalTrendsProps {
  className?: string;
}

export default function SeasonalTrends({ className = '' }: SeasonalTrendsProps) {
  const { formatCurrency } = useCurrencyDecimal();
  const seasonalTrends = useSeasonalAnalysis();

  if (!seasonalTrends) {
    return <LoadingState message="Analyzing seasonal patterns..." />;
  }

  // Convert Map to chart data
  const chartData = Array.from(seasonalTrends.entries()).map(([month, data]) => ({
    month: monthNames[month],
    income: data.income.toNumber(),
    expenses: data.expenses.toNumber(),
    net: data.income.minus(data.expenses).toNumber()
  }));

  // Find peak months
  let highestIncomeMonth = { month: 0, amount: toDecimal(0) };
  let highestExpenseMonth = { month: 0, amount: toDecimal(0) };
  
  seasonalTrends.forEach((data, month) => {
    if (data.income.greaterThan(highestIncomeMonth.amount)) {
      highestIncomeMonth = { month, amount: data.income };
    }
    if (data.expenses.greaterThan(highestExpenseMonth.amount)) {
      highestExpenseMonth = { month, amount: data.expenses };
    }
  });

  // Calculate yearly totals
  let yearlyIncome = toDecimal(0);
  let yearlyExpenses = toDecimal(0);
  
  seasonalTrends.forEach((data) => {
    yearlyIncome = yearlyIncome.plus(data.income);
    yearlyExpenses = yearlyExpenses.plus(data.expenses);
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <CalendarIcon className="text-primary" size={24} />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Seasonal Trends
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Average monthly patterns based on historical data
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Peak Income</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {monthNames[highestIncomeMonth.month]}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {formatCurrency(highestIncomeMonth.amount)}
              </p>
            </div>
            <TrendingUpIcon className="text-green-500" size={20} />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Peak Expenses</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {monthNames[highestExpenseMonth.month]}
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {formatCurrency(highestExpenseMonth.amount)}
              </p>
            </div>
            <TrendingDownIcon className="text-red-500" size={20} />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Yearly Average</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                Net: {formatCurrency(yearlyIncome.minus(yearlyExpenses))}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Income: {formatCurrency(yearlyIncome)} | Expenses: {formatCurrency(yearlyExpenses)}
              </p>
            </div>
            <CalendarIcon className="text-primary" size={20} />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="month" 
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
              <Legend />
              <Bar 
                dataKey="income" 
                fill="#10b981" 
                name="Income"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="expenses" 
                fill="#ef4444" 
                name="Expenses"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Month-by-month breakdown */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {chartData.map((data, index) => {
            const net = data.income - data.expenses;
            return (
              <div key={data.month} className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {data.month}
                </p>
                <p className={`text-sm font-semibold ${
                  net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {net >= 0 ? '+' : ''}{formatCurrency(toDecimal(net))}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
          Seasonal Insights
        </h4>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Your highest income typically occurs in {monthNames[highestIncomeMonth.month]}</li>
          <li>• Expenses peak in {monthNames[highestExpenseMonth.month]}</li>
          <li>• Plan ahead for high-expense months by saving during surplus periods</li>
          <li>• Consider adjusting your budget based on these seasonal patterns</li>
        </ul>
      </div>
    </div>
  );
}