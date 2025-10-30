import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal } from '@wealthtracker/utils';
import type { DecimalInstance } from '@wealthtracker/utils';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, ReferenceLine } from 'recharts';
import { ProfessionalIcon } from '../icons/ProfessionalIcons';

interface CashFlowSettings {
  forecastPeriod?: number;
}

interface CashFlowWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: CashFlowSettings;
}

interface CashFlowDataPoint {
  month: string;
  income: number;
  expenses: number;
  netFlow: number;
  date: string;
  type: 'historical' | 'forecast';
  incomeDecimal: DecimalInstance;
  expensesDecimal: DecimalInstance;
  netFlowDecimal: DecimalInstance;
}

export default function CashFlowWidget({ size, settings }: CashFlowWidgetProps) {
  const { transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const forecastPeriod = settings.forecastPeriod ?? 6;

  const {
    historicalData,
    forecastData,
    currentMonthFlow,
    projectedFlow,
    averageHistoricalIncome,
    averageHistoricalExpenses,
  } = useMemo(() => {
    // Convert transactions to decimal for calculations
    const decimalTransactions = transactions.map(t => ({
      ...t,
      amount: toDecimal(t.amount)
    }));
    const now = new Date();
    
    // Historical data (last 6 months)
    const historicalData: CashFlowDataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthTransactions = decimalTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= date && tDate <= endOfMonth;
      });
      
      const incomeDecimal = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
        
      const expensesDecimal = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
        
      const netFlowDecimal = incomeDecimal.minus(expensesDecimal);
      
      historicalData.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        income: incomeDecimal.toNumber(),
        expenses: expensesDecimal.toNumber(),
        netFlow: netFlowDecimal.toNumber(),
        date: date.toISOString(),
        type: 'historical',
        incomeDecimal,
        expensesDecimal,
        netFlowDecimal,
      });
    }
    
    // Calculate averages for forecasting
    const dataCount = historicalData.length;
    const incomeSum = historicalData.reduce(
      (sum, point) => sum.plus(point.incomeDecimal),
      toDecimal(0),
    );
    const expensesSum = historicalData.reduce(
      (sum, point) => sum.plus(point.expensesDecimal),
      toDecimal(0),
    );
    const averageIncome = dataCount > 0
      ? incomeSum.dividedBy(dataCount)
      : toDecimal(0);
    const averageExpenses = dataCount > 0
      ? expensesSum.dividedBy(dataCount)
      : toDecimal(0);
    const averageNetFlow = averageIncome.minus(averageExpenses);
    
    // Forecast data
    const forecastData: CashFlowDataPoint[] = [];
    const variationRange = 0.1;

    for (let i = 1; i <= forecastPeriod; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      
      // Add some variation to the forecast
      const incomeVariation = toDecimal(1 + (Math.random() - 0.5) * variationRange);
      const expenseVariation = toDecimal(1 + (Math.random() - 0.5) * variationRange);
      
      const projectedIncomeDecimal = averageIncome.times(incomeVariation);
      const projectedExpensesDecimal = averageExpenses.times(expenseVariation);
      const projectedNetFlowDecimal = projectedIncomeDecimal.minus(projectedExpensesDecimal);
      
      forecastData.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        income: projectedIncomeDecimal.toNumber(),
        expenses: projectedExpensesDecimal.toNumber(),
        netFlow: projectedNetFlowDecimal.toNumber(),
        date: date.toISOString(),
        type: 'forecast',
        incomeDecimal: projectedIncomeDecimal,
        expensesDecimal: projectedExpensesDecimal,
        netFlowDecimal: projectedNetFlowDecimal,
      });
    }
    
    // Current month flow
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthTransactions = decimalTransactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= currentMonthStart;
    });
    
    const currentIncome = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
    const currentExpenses = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
    const currentMonthFlow = currentIncome.minus(currentExpenses);
    
    return {
      historicalData,
      forecastData,
      currentMonthFlow,
      projectedFlow: averageNetFlow,
      averageHistoricalIncome: averageIncome,
      averageHistoricalExpenses: averageExpenses,
    };
  }, [transactions, forecastPeriod]);

  const combinedData = [...historicalData, ...forecastData];
  const isCurrentFlowPositive = currentMonthFlow.greaterThanOrEqualTo(0);
  const isProjectedFlowPositive = projectedFlow.greaterThanOrEqualTo(0);

  if (size === 'small') {
    return (
      <div className="text-center">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">This Month</div>
        <div className={`text-2xl font-bold mb-2 ${
          isCurrentFlowPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {formatCurrency(currentMonthFlow)}
        </div>
        <div className={`flex items-center justify-center gap-1 text-sm ${
          isProjectedFlowPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {isProjectedFlowPositive ? (
            <ProfessionalIcon name="trendingUp" size={16} />
          ) : (
            <ProfessionalIcon name="trendingDown" size={16} />
          )}
          <span>Proj: {formatCurrency(projectedFlow)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Month Flow</div>
          <div className={`text-2xl font-bold ${
            isCurrentFlowPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(currentMonthFlow)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Projected Avg</div>
          <div className={`text-lg font-medium ${
            isProjectedFlowPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(projectedFlow)}
          </div>
        </div>
      </div>

      {size === 'large' && (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData}>
              <XAxis 
                dataKey="month" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => {
                  if (Math.abs(value) >= 1000) {
                    const scaled = value / 1000;
                    return `${new Intl.NumberFormat('en-US', {
                      maximumFractionDigits: 1,
                      minimumFractionDigits: 0,
                    }).format(scaled)}K`;
                  }
                  return new Intl.NumberFormat('en-US', {
                    maximumFractionDigits: 0,
                    minimumFractionDigits: 0,
                  }).format(value);
                }}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  formatCurrency(value), 
                  name === 'income' ? 'Income' : 
                  name === 'expenses' ? 'Expenses' : 'Net Flow'
                ]}
                labelFormatter={(label) => `Month: ${label}`}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
              
              <Line 
                type="monotone" 
                dataKey="income" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                strokeDasharray=""
              />
              <Line 
                type="monotone" 
                dataKey="expenses" 
                stroke="#EF4444" 
                strokeWidth={2}
                dot={{ fill: '#EF4444', strokeWidth: 2, r: 3 }}
                strokeDasharray=""
              />
              <Line 
                type="monotone" 
                dataKey="netFlow" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                strokeDasharray=""
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {size === 'medium' && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">Avg Income</div>
              <div className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(averageHistoricalIncome)}
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Avg Expenses</div>
              <div className="font-medium text-red-600 dark:text-red-400">
                {formatCurrency(averageHistoricalExpenses)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning for negative cash flow */}
      {!isProjectedFlowPositive && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <ProfessionalIcon name="warning" className="text-red-600 dark:text-red-400" size={16} />
            <span className="text-sm text-red-800 dark:text-red-200">
              Projected negative cash flow
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
