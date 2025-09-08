/**
 * Budget Calculations Module
 * Budget-related financial calculations
 */

import type { Budget, Transaction } from '../../types';
import type { BudgetProgressResult } from './types';

/**
 * Calculate budget percentage
 */
export function calculateBudgetPercentage(spent: number, budgeted: number): number {
  if (budgeted === 0) return 0;
  return (spent / budgeted) * 100;
}

/**
 * Calculate budget variance
 */
export function calculateBudgetVariance(actual: number, budgeted: number): number {
  return actual - budgeted;
}

/**
 * Calculate budget spending for a category within a date range
 */
export function calculateBudgetSpending(
  budget: Budget,
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): number {
  const budgetTransactions = transactions.filter(t => 
    t.type === 'expense' &&
    t.category === (budget as any).categoryId &&
    new Date(t.date) >= startDate &&
    new Date(t.date) <= endDate
  );
  
  return budgetTransactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate budget remaining
 */
export function calculateBudgetRemaining(
  budget: Budget,
  spent: number
): number {
  const remaining = budget.amount - spent;
  return remaining < 0 ? 0 : remaining;
}

/**
 * Calculate budget usage amount
 */
export function calculateBudgetUsage(budget: Budget, transactions: Transaction[]): number {
  const expenseTransactions = transactions.filter(t => 
    t.type === 'expense' && t.category === (budget as any).categoryId
  );
  return expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate budget progress with detailed information
 */
export function calculateBudgetProgress(
  budget: Budget, 
  transactions?: Transaction[]
): BudgetProgressResult {
  // If budget has a 'spent' property, use it directly
  const spent = budget.spent || (transactions ? calculateBudgetUsage(budget, transactions) : 0);
  const percentage = budget.amount === 0 ? 0 : (spent / budget.amount) * 100;
  const remaining = budget.amount - spent;
  
  let status: 'good' | 'warning' | 'danger';
  if (percentage >= 100) {
    status = 'danger';
  } else if (percentage >= 80) {
    status = 'warning';
  } else {
    status = 'good';
  }
  
  return {
    percentage,
    remaining,
    status
  };
}

/**
 * Allocate budget based on historical spending
 */
export function allocateBudget(
  totalBudget: number,
  historicalSpending: { category: string; amount: number }[]
): { category: string; allocation: number }[] {
  const totalSpent = historicalSpending.reduce((sum, item) => sum + item.amount, 0);
  
  if (totalSpent === 0) {
    return historicalSpending.map(item => ({
      category: item.category,
      allocation: totalBudget / historicalSpending.length
    }));
  }
  
  return historicalSpending.map(item => ({
    category: item.category,
    allocation: (item.amount / totalSpent) * totalBudget
  }));
}

/**
 * Calculate budget efficiency score
 */
export function calculateBudgetEfficiency(
  budgets: Budget[],
  transactions: Transaction[]
): number {
  if (budgets.length === 0) return 100;
  
  let totalScore = 0;
  
  budgets.forEach(budget => {
    const spent = calculateBudgetUsage(budget, transactions);
    const efficiency = spent <= budget.amount ? 100 : (budget.amount / spent) * 100;
    totalScore += efficiency;
  });
  
  return totalScore / budgets.length;
}

/**
 * Get budget recommendations based on spending patterns
 */
export function getBudgetRecommendations(
  transactions: Transaction[],
  currentBudgets: Budget[]
): { category: string; recommended: number; current: number }[] {
  const categorySpending = new Map<string, number>();
  
  // Calculate actual spending by category
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const current = categorySpending.get(t.category || 'Other') || 0;
      categorySpending.set(t.category || 'Other', current + t.amount);
    });
  
  const recommendations: { category: string; recommended: number; current: number }[] = [];
  
  categorySpending.forEach((amount, category) => {
    const currentBudget = currentBudgets.find(b => (b as any).categoryId === category);
    const currentAmount = currentBudget?.amount || 0;
    
    // Recommend 10% buffer above average spending
    const recommended = amount * 1.1;
    
    recommendations.push({
      category,
      recommended: Math.round(recommended),
      current: currentAmount
    });
  });
  
  return recommendations;
}
