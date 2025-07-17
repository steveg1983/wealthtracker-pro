import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useBudgets } from '../../contexts/BudgetContext';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal } from '../../utils/decimal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PiggyBankIcon, AlertCircleIcon, CheckCircleIcon } from '../icons';

interface BudgetSummaryWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: Record<string, any>;
}

export default function BudgetSummaryWidget({ size, settings }: BudgetSummaryWidgetProps) {
  const { getDecimalTransactions } = useApp();
  const { budgets } = useBudgets();
  const { formatCurrency } = useCurrencyDecimal();
  
  const period = settings.period || 'current';

  const { budgetData, totalBudgeted, totalSpent, totalRemaining, overBudgetCount } = useMemo(() => {
    const transactions = getDecimalTransactions();
    const now = new Date();
    
    // Determine date range based on period
    let startDate: Date;
    let endDate: Date;
    
    switch (period) {
      case 'last':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      default: // current
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    const budgetData = budgets.map(budget => {
      const budgetAmount = toDecimal(budget.amount);
      
      // Calculate spending for this budget's categories
      const spent = transactions
        .filter(t => {
          const tDate = new Date(t.date);
          return t.type === 'expense' && 
                 tDate >= startDate && 
                 tDate <= endDate &&
                 budget.categoryIds.includes(t.category || '');
        })
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
      const remaining = budgetAmount.minus(spent);
      const percentage = budgetAmount.greaterThan(0) ? spent.dividedBy(budgetAmount).times(100) : toDecimal(0);
      const isOverBudget = remaining.lessThan(0);
      
      return {
        id: budget.id,
        name: budget.name,
        budgeted: budgetAmount,
        spent,
        remaining,
        percentage: percentage.toNumber(),
        isOverBudget,
        color: budget.color || '#3B82F6'
      };
    });
    
    const totalBudgeted = budgetData.reduce((sum, b) => sum.plus(b.budgeted), toDecimal(0));
    const totalSpent = budgetData.reduce((sum, b) => sum.plus(b.spent), toDecimal(0));
    const totalRemaining = totalBudgeted.minus(totalSpent);
    const overBudgetCount = budgetData.filter(b => b.isOverBudget).length;
    
    return {
      budgetData,
      totalBudgeted,
      totalSpent,
      totalRemaining,
      overBudgetCount
    };
  }, [budgets, getDecimalTransactions, period]);

  const pieData = budgetData.map(budget => ({
    name: budget.name,
    value: budget.spent.toNumber(),
    color: budget.color
  }));

  const isOverBudget = totalRemaining.lessThan(0);

  if (size === 'small') {
    return (
      <div className="text-center">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Budget Status</div>
        <div className={`text-2xl font-bold mb-2 ${
          isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
        }`}>
          {formatCurrency(totalRemaining)}
        </div>
        <div className="flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          {isOverBudget ? <AlertCircleIcon size={16} /> : <CheckCircleIcon size={16} />}
          <span>{isOverBudget ? 'Over budget' : 'On track'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {period === 'last' ? 'Last Month' : 
             period === 'ytd' ? 'Year to Date' : 'This Month'}
          </div>
          <div className={`text-2xl font-bold ${
            isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          }`}>
            {isOverBudget ? '-' : '+'}{formatCurrency(totalRemaining.abs())}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatCurrency(totalSpent)} of {formatCurrency(totalBudgeted)}
          </div>
        </div>
        
        {overBudgetCount > 0 && (
          <div className="text-right">
            <div className="text-sm text-red-600 dark:text-red-400 font-medium">
              {overBudgetCount} over budget
            </div>
          </div>
        )}
      </div>

      {size === 'large' && budgetData.length > 0 && (
        <div className="flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
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
            
            <div className="space-y-2 overflow-y-auto">
              {budgetData.map((budget) => (
                <div
                  key={budget.id}
                  className={`p-2 rounded-lg border ${
                    budget.isOverBudget 
                      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: budget.color }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {budget.name}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${
                      budget.isOverBudget 
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {budget.percentage.toFixed(0)}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
                    <div
                      className={`h-2 rounded-full ${
                        budget.isOverBudget ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ 
                        width: `${Math.min(budget.percentage, 100)}%`,
                        backgroundColor: budget.isOverBudget ? '#EF4444' : budget.color
                      }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>{formatCurrency(budget.spent)}</span>
                    <span>{formatCurrency(budget.budgeted)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {size === 'medium' && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">Budgeted</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(totalBudgeted)}
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Spent</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(totalSpent)}
              </div>
            </div>
          </div>
          
          {budgetData.length > 0 && (
            <div className="mt-4 space-y-2">
              {budgetData.slice(0, 3).map((budget) => (
                <div key={budget.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: budget.color }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {budget.name}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${
                    budget.isOverBudget 
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {budget.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
              {budgetData.length > 3 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  +{budgetData.length - 3} more
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}