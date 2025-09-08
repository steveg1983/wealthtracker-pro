import { useMemo, useEffect } from 'react';
import { toDecimal } from '../../utils/decimal';
import { calculateBudgetSpending, calculateBudgetRemaining, calculateBudgetPercentage } from '../../utils/calculations-decimal';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { useNotifications } from '../../contexts/NotificationContext';
import type { Budget, Transaction, Category } from '../../types';
import type { BudgetWithSpent, BudgetTotals, BudgetAlert, DateValues } from './types';

/**
 * Custom hook for budget calculations and alerts
 * Handles budget spending calculations, totals, and alert checking
 */
export function useBudgetCalculations(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  dateValues: DateValues
) {
  const { formatCurrency } = useCurrencyDecimal();
  const { checkEnhancedBudgetAlerts, checkBudgetAlerts, alertThreshold } = useNotifications();
  const { currentMonth, currentYear } = dateValues;

  // Calculate spent amounts for each budget with memoization
  const budgetsWithSpent = useMemo<BudgetWithSpent[]>(() => {
    return budgets
      .filter(budget => budget !== null && budget !== undefined)
      .map((budget) => {
        // Convert to decimal for calculations
        const decimalBudget = {
          ...budget,
          category: (budget as any).categoryId || (budget as any).category,
          amount: toDecimal(budget.amount),
          spent: toDecimal(0)
        };
        
        // Convert transactions to decimal for calculations
        const decimalTransactions = transactions.map(t => ({
          ...t,
          amount: toDecimal(t.amount)
        }));
        
        // Calculate date range for budget period
        let startDate: Date;
        let endDate: Date;
        
        if (budget.period === 'monthly') {
          startDate = new Date(currentYear, currentMonth, 1);
          endDate = new Date(currentYear, currentMonth + 1, 0);
        } else if (budget.period === 'weekly') {
          // For weekly, use the current week
          const now = new Date();
          const dayOfWeek = now.getDay();
          startDate = new Date(now);
          startDate.setDate(now.getDate() - dayOfWeek);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Yearly
          startDate = new Date(currentYear, 0, 1);
          endDate = new Date(currentYear, 11, 31);
        }

        const spent = calculateBudgetSpending(decimalBudget, decimalTransactions, startDate, endDate);
        const percentage = calculateBudgetPercentage(decimalBudget, spent);
        const remaining = calculateBudgetRemaining(decimalBudget, spent);

        return {
          ...budget,
          spent: spent.toNumber(),
          percentage,
          remaining: remaining.toNumber()
        };
      });
  }, [budgets, transactions, currentMonth, currentYear]);

  // Calculate totals with memoization
  const totals = useMemo<BudgetTotals>(() => {
    const active = budgetsWithSpent.filter(b => b && b.isActive !== false);
    const budgeted = active.reduce((sum, b) => sum.plus(toDecimal(b.amount || 0)), toDecimal(0));
    const spent = active.reduce((sum, b) => sum.plus(toDecimal(b.spent || 0)), toDecimal(0));
    const remaining = budgeted.minus(spent);
    
    return {
      totalBudgeted: formatCurrency(budgeted),
      totalSpent: formatCurrency(spent),
      totalRemaining: formatCurrency(remaining),
      totalRemainingValue: remaining.toNumber()
    };
  }, [budgetsWithSpent, formatCurrency]);

  // Check for budget alerts
  useEffect(() => {
    const alerts: BudgetAlert[] = budgetsWithSpent
      .filter(budget => budget.isActive)
      .map(budget => {
        const category = categories.find(c => c.id === ((budget as any).categoryId || (budget as any).category));
        if (budget.percentage >= 100) {
          return {
            budgetId: budget.id,
            categoryName: category?.name || 'Unknown',
            percentage: toDecimal(budget.percentage).round().toNumber(),
            spent: budget.spent,
            budget: budget.amount,
            period: budget.period,
            type: 'danger' as const
          };
        } else if (budget.percentage >= alertThreshold) {
          return {
            budgetId: budget.id,
            categoryName: category?.name || 'Unknown',
            percentage: toDecimal(budget.percentage).round().toNumber(),
            spent: budget.spent,
            budget: budget.amount,
            period: budget.period,
            type: 'warning' as const
          };
        }
        return null;
      })
      .filter((alert): alert is BudgetAlert => alert !== null);

    if (alerts.length > 0) {
      checkBudgetAlerts(alerts);
    }
  }, [budgetsWithSpent, categories, alertThreshold, checkBudgetAlerts]);

  // Check for enhanced budget alerts whenever budgets change
  useEffect(() => {
    if (budgets.length > 0 && transactions.length > 0) {
      checkEnhancedBudgetAlerts(budgets, transactions, categories);
    }
  }, [budgets, transactions, categories, checkEnhancedBudgetAlerts]);

  return {
    budgetsWithSpent,
    totals
  };
}
