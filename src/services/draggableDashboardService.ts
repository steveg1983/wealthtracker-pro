import { Account, Transaction, Budget, Goal } from '../types';
import { toDecimal } from '../utils/decimal';
import type Decimal from 'decimal.js';

export interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  isCompact?: boolean;
  settings?: Record<string, unknown>;
}

export interface WidgetLayout {
  widgets: Widget[];
  order: string[];
}

export interface DashboardMetrics {
  netWorth: Decimal;
  totalAssets: Decimal;
  totalLiabilities: Decimal;
  monthlyIncome: Decimal;
  monthlyExpenses: Decimal;
  savingsRate: number;
}

export const WIDGET_TYPES = {
  netWorth: { 
    title: 'Net Worth', 
    defaultSize: 'medium' as const, 
    description: 'Track your total net worth' 
  },
  netWorthTrend: { 
    title: 'Net Worth Trend', 
    defaultSize: 'large' as const, 
    description: 'Historical net worth chart' 
  },
  accounts: { 
    title: 'Accounts Overview', 
    defaultSize: 'large' as const, 
    description: 'View all your accounts' 
  },
  transactions: { 
    title: 'Recent Transactions', 
    defaultSize: 'large' as const, 
    description: 'Latest transactions' 
  },
  budgets: { 
    title: 'Budget Status', 
    defaultSize: 'medium' as const, 
    description: 'Budget tracking' 
  },
  savingsGoals: { 
    title: 'Savings Goals', 
    defaultSize: 'large' as const, 
    description: 'Track savings goals progress' 
  },
  debtTracker: { 
    title: 'Debt Tracker', 
    defaultSize: 'medium' as const, 
    description: 'Monitor debts and loans' 
  },
  billReminders: { 
    title: 'Bill Reminders', 
    defaultSize: 'medium' as const, 
    description: 'Upcoming bills and payments' 
  },
  investmentPerformance: { 
    title: 'Investment Performance', 
    defaultSize: 'large' as const, 
    description: 'Portfolio performance' 
  },
  cashFlow: { 
    title: 'Cash Flow', 
    defaultSize: 'large' as const, 
    description: 'Income vs expenses' 
  },
  recentAlerts: { 
    title: 'Recent Alerts', 
    defaultSize: 'medium' as const, 
    description: 'Important notifications' 
  },
  expenseCategories: { 
    title: 'Expense Categories', 
    defaultSize: 'medium' as const, 
    description: 'Spending by category' 
  }
};

export class DraggableDashboardService {
  /**
   * Get default layout
   */
  static getDefaultLayout(): WidgetLayout {
    return {
      widgets: [
        { id: 'netWorth-1', type: 'netWorth', title: 'Net Worth', size: 'medium' },
        { id: 'accounts-1', type: 'accounts', title: 'Accounts', size: 'large' },
        { id: 'transactions-1', type: 'transactions', title: 'Recent Transactions', size: 'large' },
        { id: 'budgets-1', type: 'budgets', title: 'Budget Status', size: 'medium' },
        { id: 'goals-1', type: 'goals', title: 'Financial Goals', size: 'medium' }
      ],
      order: ['netWorth-1', 'accounts-1', 'transactions-1', 'budgets-1', 'goals-1']
    };
  }

  /**
   * Load layout from localStorage
   */
  static loadLayout(): WidgetLayout {
    const saved = localStorage.getItem('dashboardLayout');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved layout:', e);
      }
    }
    return this.getDefaultLayout();
  }

  /**
   * Save layout to localStorage
   */
  static saveLayout(layout: WidgetLayout): void {
    localStorage.setItem('dashboardLayout', JSON.stringify(layout));
  }

  /**
   * Calculate dashboard metrics
   */
  static calculateMetrics(accounts: Account[], transactions: Transaction[]): DashboardMetrics {
    const totalAssets = accounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum.plus(toDecimal(acc.balance)), toDecimal(0));
    
    const totalLiabilities = accounts
      .filter(acc => acc.balance < 0)
      .reduce((sum, acc) => sum.plus(toDecimal(Math.abs(acc.balance))), toDecimal(0));
    
    const netWorth = totalAssets.minus(totalLiabilities);
    
    // Monthly stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTransactions = transactions.filter(t => new Date(t.date) >= startOfMonth);
    
    const monthlyIncome = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
    
    const monthlyExpenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0));

    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      monthlyIncome,
      monthlyExpenses,
      savingsRate: monthlyIncome.isZero() ? 0 : 
        monthlyIncome.minus(monthlyExpenses).dividedBy(monthlyIncome).times(100).toNumber()
    };
  }

  /**
   * Create new widget
   */
  static createWidget(type: string): Widget {
    const widgetConfig = WIDGET_TYPES[type as keyof typeof WIDGET_TYPES];
    return {
      id: `${type}-${Date.now()}`,
      type,
      title: widgetConfig.title,
      size: widgetConfig.defaultSize
    };
  }

  /**
   * Get recent transactions
   */
  static getRecentTransactions(transactions: Transaction[], limit: number = 5): Transaction[] {
    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  /**
   * Get active budgets with progress
   */
  static getActiveBudgets(budgets: Budget[], transactions: Transaction[]) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTransactions = transactions.filter(t => new Date(t.date) >= startOfMonth);
    
    return budgets
      .filter(b => b.isActive)
      .map(budget => {
        const categoryId = (budget as any).categoryId || (budget as any).category;
        const spent = monthTransactions
          .filter(t => t.category === categoryId && t.type === 'expense')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        return {
          ...budget,
          spent,
          progress: budget.amount > 0 ? (spent / budget.amount) * 100 : 0
        };
      });
  }

  /**
   * Get goals with progress
   */
  static getGoalsWithProgress(goals: Goal[]) {
    return goals.map(goal => ({
      ...goal,
      progress: goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
    }));
  }
}
