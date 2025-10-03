import { useMemo } from 'react';
import type { Account, Transaction, Budget, Goal } from '../types';
import { TIME } from '../constants';

/**
 * Enterprise-grade custom hook for dashboard metrics calculation
 * Extracts complex logic from DashboardV2 component
 * Follows single responsibility principle - only calculates metrics
 */
export interface DashboardMetrics {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  budgetUtilization: number;
  goalsProgress: number;
  accountsHealth: {
    healthy: number;
    warning: number;
    critical: number;
  };
  cashFlow: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  trends: {
    netWorthChange: number;
    incomeChange: number;
    expenseChange: number;
  };
}

export function useDashboardMetrics(
  accounts: Account[] = [],
  transactions: Transaction[] = [],
  budgets: Budget[] = [],
  goals: Goal[] = []
): DashboardMetrics {
  return useMemo(() => {
    // Calculate base financial metrics
    const totalAssets = accounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum + acc.balance, 0);
    
    const totalLiabilities = accounts
      .filter(acc => acc.balance < 0)
      .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    
    const netWorth = totalAssets - totalLiabilities;
    
    // Calculate time-based transaction metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * TIME.DAY));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * TIME.DAY));
    const sevenDaysAgo = new Date(now.getTime() - (7 * TIME.DAY));
    
    // Current month transactions
    const recentTransactions = transactions.filter(t => 
      new Date(t.date) >= thirtyDaysAgo
    );
    
    // Previous month transactions for trend calculation
    const previousMonthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });
    
    // This week transactions
    const weeklyTransactions = transactions.filter(t =>
      new Date(t.date) >= sevenDaysAgo
    );
    
    // Calculate income and expenses
    const monthlyIncome = recentTransactions
      .filter(t => t.type === 'income' || t.amount > 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const monthlyExpenses = recentTransactions
      .filter(t => t.type === 'expense' || t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const previousIncome = previousMonthTransactions
      .filter(t => t.type === 'income' || t.amount > 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const previousExpenses = previousMonthTransactions
      .filter(t => t.type === 'expense' || t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
    
    // Calculate cash flow patterns
    const dailyTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.toDateString() === now.toDateString();
    });
    
    const dailyCashFlow = dailyTransactions.reduce((sum, t) => sum + t.amount, 0);
    const weeklyCashFlow = weeklyTransactions.reduce((sum, t) => sum + t.amount, 0);
    const monthlyCashFlow = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate budget utilization
    const activeBudgets = budgets.filter(b => b.isActive !== false);
    const budgetUtilization = activeBudgets.length > 0
      ? activeBudgets.reduce((total, budget) => {
          const spent = budget.spent || 0;
          const amount = budget.amount || 1;
          return total + (spent / amount);
        }, 0) / activeBudgets.length * 100
      : 0;
    
    // Calculate goals progress
    const activeGoals = goals.filter(g => g.isActive !== false);
    const goalsProgress = activeGoals.length > 0
      ? activeGoals.reduce((total, goal) => {
          const current = goal.currentAmount || 0;
          const target = goal.targetAmount || 1;
          return total + (current / target);
        }, 0) / activeGoals.length * 100
      : 0;
    
    // Calculate account health
    const accountsHealth = accounts.reduce((health, account) => {
      if (account.type === 'credit_card' || account.type === 'loan') {
        const utilization = Math.abs(account.balance) / (account.creditLimit || Math.abs(account.balance));
        if (utilization > 0.8) {
          health.critical++;
        } else if (utilization > 0.5) {
          health.warning++;
        } else {
          health.healthy++;
        }
      } else {
        // For regular accounts, check if balance is positive
        if (account.balance > 1000) {
          health.healthy++;
        } else if (account.balance > 0) {
          health.warning++;
        } else {
          health.critical++;
        }
      }
      return health;
    }, { healthy: 0, warning: 0, critical: 0 });
    
    // Calculate trends
    const incomeChange = previousIncome > 0
      ? ((monthlyIncome - previousIncome) / previousIncome) * 100
      : 0;
    
    const expenseChange = previousExpenses > 0
      ? ((monthlyExpenses - previousExpenses) / previousExpenses) * 100
      : 0;
    
    // Estimate net worth change based on savings rate
    const netWorthChange = monthlySavings;
    
    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      monthlyIncome,
      monthlyExpenses,
      monthlySavings,
      savingsRate,
      budgetUtilization,
      goalsProgress,
      accountsHealth,
      cashFlow: {
        daily: dailyCashFlow,
        weekly: weeklyCashFlow,
        monthly: monthlyCashFlow
      },
      trends: {
        netWorthChange,
        incomeChange,
        expenseChange
      }
    };
  }, [accounts, transactions, budgets, goals]);
}