import { toDecimal } from '../utils/decimal';
import { 
  calculateBudgetSpending, 
  calculateBudgetRemaining, 
  calculateBudgetPercentage 
} from '../utils/calculations-decimal';
import type { Budget, Transaction, Category } from '../types';
import type { DecimalInstance } from '../types/decimal-types';

export type BudgetTab = 'traditional' | 'envelope' | 'templates' | 'rollover' | 'alerts' | 'zero-based';

export interface BudgetWithSpent extends Budget {
  spent: number;
  percentage: number;
  remaining: number;
}

export interface BudgetTotals {
  totalBudgeted: DecimalInstance;
  totalSpent: DecimalInstance;
  totalRemaining: DecimalInstance;
}

export interface BudgetAlert {
  budgetId: string;
  categoryName: string;
  percentage: number;
  spent: number;
  budget: number;
  period: string;
  type: 'warning' | 'danger';
}

export interface TabConfig {
  id: BudgetTab;
  label: string;
  icon: string;
  tooltip?: string;
}

class BudgetPageService {
  getTabConfigs(): TabConfig[] {
    return [
      { 
        id: 'traditional', 
        label: 'Traditional', 
        icon: 'BanknoteIcon',
        tooltip: 'Traditional category-based budgeting'
      },
      { 
        id: 'envelope', 
        label: 'Envelope', 
        icon: 'PiggyBankIcon',
        tooltip: 'Envelope budgeting - allocate money to virtual envelopes'
      },
      { 
        id: 'templates', 
        label: 'Templates', 
        icon: 'RepeatIcon'
      },
      { 
        id: 'rollover', 
        label: 'Rollover', 
        icon: 'ArrowRightIcon'
      },
      { 
        id: 'alerts', 
        label: 'Alerts', 
        icon: 'BellIcon'
      },
      { 
        id: 'zero-based', 
        label: 'Zero-Based', 
        icon: 'CalculatorIcon'
      }
    ];
  }

  getDateRange(period: string, currentMonth: number, currentYear: number): { startDate: Date; endDate: Date } {
    let startDate: Date;
    let endDate: Date;
    
    if (period === 'monthly') {
      startDate = new Date(currentYear, currentMonth, 1);
      endDate = new Date(currentYear, currentMonth + 1, 0);
    } else if (period === 'weekly') {
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

    return { startDate, endDate };
  }

  calculateBudgetsWithSpent(
    budgets: Budget[], 
    transactions: Transaction[],
    currentMonth: number,
    currentYear: number
  ): BudgetWithSpent[] {
    return budgets
      .filter(budget => budget !== null && budget !== undefined)
      .map((budget) => {
        // Convert to decimal for calculations
        const decimalBudget = {
          ...budget,
          // Decimal helpers expect 'category' to be the category id
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
        const { startDate, endDate } = this.getDateRange(budget.period, currentMonth, currentYear);

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
  }

  calculateTotals(budgetsWithSpent: BudgetWithSpent[]): BudgetTotals {
    const active = budgetsWithSpent.filter(b => b && b.isActive !== false);
    const totalBudgeted = active.reduce((sum, b) => sum.plus(toDecimal(b.amount || 0)), toDecimal(0));
    const totalSpent = active.reduce((sum, b) => sum.plus(toDecimal(b.spent || 0)), toDecimal(0));
    const totalRemaining = totalBudgeted.minus(totalSpent);
    
    return {
      totalBudgeted,
      totalSpent,
      totalRemaining
    };
  }

  generateBudgetAlerts(
    budgetsWithSpent: BudgetWithSpent[],
    categories: Category[],
    alertThreshold: number
  ): BudgetAlert[] {
    return budgetsWithSpent
      .filter(budget => budget.isActive)
      .map(budget => {
        const category = categories.find(c => c.id === ((budget as any).categoryId || (budget as any).category));
        if (budget.percentage >= 100) {
          return {
            budgetId: budget.id,
            categoryName: category?.name || 'Unknown',
            percentage: Math.round(budget.percentage),
            spent: budget.spent,
            budget: budget.amount,
            period: budget.period,
            type: 'danger' as const
          };
        } else if (budget.percentage >= alertThreshold) {
          return {
            budgetId: budget.id,
            categoryName: category?.name || 'Unknown',
            percentage: Math.round(budget.percentage),
            spent: budget.spent,
            budget: budget.amount,
            period: budget.period,
            type: 'warning' as const
          };
        }
        return null;
      })
      .filter((alert): alert is BudgetAlert => alert !== null);
  }

  getProgressColor(percentage: number): string {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  getTabClassName(isActive: boolean): string {
    return `flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
    }`;
  }

  formatPeriodLabel(period: string): string {
    switch (period) {
      case 'monthly': return 'Monthly';
      case 'weekly': return 'Weekly';
      case 'yearly': return 'Yearly';
      default: return period;
    }
  }

  getCurrentDateInfo(): { currentMonth: number; currentYear: number } {
    const now = new Date();
    return {
      currentMonth: now.getMonth(),
      currentYear: now.getFullYear()
    };
  }
}

export const budgetPageService = new BudgetPageService();
