/**
 * Enhanced Dashboard Service
 * Handles widget management, metrics calculation, and layout persistence
 */

import { toDecimal } from '../utils/decimal';
import type { Account, Transaction, Budget, Goal } from '../types';
import Decimal from 'decimal.js';

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
  netWorth: InstanceType<typeof Decimal>;
  totalAssets: InstanceType<typeof Decimal>;
  totalLiabilities: InstanceType<typeof Decimal>;
  monthlyIncome: InstanceType<typeof Decimal>;
  monthlyExpenses: InstanceType<typeof Decimal>;
  savingsRate: number;
}

export interface WidgetTypeConfig {
  title: string;
  icon: any;
  defaultSize: 'small' | 'medium' | 'large';
  description: string;
}

/**
 * Enhanced dashboard service class
 */
export class EnhancedDashboardService {
  
  /**
   * Available widget types configuration
   */
  static WIDGET_TYPES: Record<string, Omit<WidgetTypeConfig, 'icon'>> = {
    netWorth: { 
      title: 'Net Worth', 
      defaultSize: 'medium', 
      description: 'Track your total net worth' 
    },
    netWorthTrend: { 
      title: 'Net Worth Trend', 
      defaultSize: 'large', 
      description: 'Historical net worth chart' 
    },
    accounts: { 
      title: 'Accounts Overview', 
      defaultSize: 'large', 
      description: 'View all your accounts' 
    },
    transactions: { 
      title: 'Recent Transactions', 
      defaultSize: 'large', 
      description: 'Latest transactions' 
    },
    budgets: { 
      title: 'Budget Status', 
      defaultSize: 'medium', 
      description: 'Budget tracking' 
    },
    savingsGoals: { 
      title: 'Savings Goals', 
      defaultSize: 'large', 
      description: 'Track savings goals progress' 
    },
    debtTracker: { 
      title: 'Debt Tracker', 
      defaultSize: 'medium', 
      description: 'Monitor debts and loans' 
    },
    billReminders: { 
      title: 'Bill Reminders', 
      defaultSize: 'medium', 
      description: 'Upcoming bills and payments' 
    },
    investmentPerformance: { 
      title: 'Investment Performance', 
      defaultSize: 'large', 
      description: 'Portfolio performance' 
    },
    cashFlow: { 
      title: 'Cash Flow', 
      defaultSize: 'large', 
      description: 'Income vs expenses' 
    },
    recentAlerts: { 
      title: 'Recent Alerts', 
      defaultSize: 'medium', 
      description: 'Important notifications' 
    },
    expenseCategories: { 
      title: 'Expense Categories', 
      defaultSize: 'medium', 
      description: 'Spending by category' 
    }
  };

  /**
   * Get default layout
   */
  static getDefaultLayout(): WidgetLayout {
    return {
      widgets: [
        { 
          id: 'netWorth-1', 
          type: 'netWorth', 
          title: 'Net Worth', 
          size: 'medium' 
        },
        { 
          id: 'accounts-1', 
          type: 'accounts', 
          title: 'Accounts', 
          size: 'large' 
        },
        { 
          id: 'transactions-1', 
          type: 'transactions', 
          title: 'Recent Transactions', 
          size: 'large' 
        },
        { 
          id: 'budgets-1', 
          type: 'budgets', 
          title: 'Budget Status', 
          size: 'medium' 
        },
        { 
          id: 'goals-1', 
          type: 'goals', 
          title: 'Financial Goals', 
          size: 'medium' 
        }
      ],
      order: ['netWorth-1', 'accounts-1', 'transactions-1', 'budgets-1', 'goals-1']
    };
  }

  /**
   * Load saved layout from localStorage
   */
  static loadSavedLayout(): WidgetLayout | null {
    const saved = localStorage.getItem('dashboardLayout');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
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
  static calculateMetrics(
    accounts: Account[], 
    transactions: Transaction[]
  ): DashboardMetrics {
    // Calculate assets and liabilities
    const totalAssets = accounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum.plus(toDecimal(acc.balance)), toDecimal(0));
    
    const totalLiabilities = accounts
      .filter(acc => acc.balance < 0)
      .reduce((sum, acc) => sum.plus(toDecimal(Math.abs(acc.balance))), toDecimal(0));
    
    const netWorth = totalAssets.minus(totalLiabilities);
    
    // Calculate monthly stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTransactions = transactions.filter(t => new Date(t.date) >= startOfMonth);
    
    const monthlyIncome = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
    
    const monthlyExpenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0));

    const savingsRate = monthlyIncome.isZero() ? 0 : 
      monthlyIncome.minus(monthlyExpenses).dividedBy(monthlyIncome).times(100).toNumber();

    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      monthlyIncome,
      monthlyExpenses,
      savingsRate
    };
  }

  /**
   * Create a new widget
   */
  static createWidget(type: string): Widget {
    const config = this.WIDGET_TYPES[type];
    if (!config) {
      throw new Error(`Unknown widget type: ${type}`);
    }

    return {
      id: `${type}-${Date.now()}`,
      type,
      title: config.title,
      size: config.defaultSize
    };
  }

  /**
   * Add widget to layout
   */
  static addWidgetToLayout(layout: WidgetLayout, type: string): WidgetLayout {
    const newWidget = this.createWidget(type);
    
    return {
      widgets: [...layout.widgets, newWidget],
      order: [...layout.order, newWidget.id]
    };
  }

  /**
   * Remove widget from layout
   */
  static removeWidgetFromLayout(layout: WidgetLayout, widgetId: string): WidgetLayout {
    return {
      widgets: layout.widgets.filter(w => w.id !== widgetId),
      order: layout.order.filter(id => id !== widgetId)
    };
  }

  /**
   * Toggle widget size/compactness
   */
  static toggleWidgetSize(layout: WidgetLayout, widgetId: string): WidgetLayout {
    return {
      ...layout,
      widgets: layout.widgets.map(w => 
        w.id === widgetId ? { ...w, isCompact: !w.isCompact } : w
      )
    };
  }

  /**
   * Reorder widgets in layout
   */
  static reorderWidgets(
    layout: WidgetLayout, 
    activeId: string, 
    overId: string
  ): WidgetLayout {
    const oldIndex = layout.order.indexOf(activeId);
    const newIndex = layout.order.indexOf(overId);
    
    if (oldIndex === -1 || newIndex === -1) {
      return layout;
    }

    // Array move logic
    const newOrder = [...layout.order];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);

    return {
      ...layout,
      order: newOrder
    };
  }

  /**
   * Get recent transactions
   */
  static getRecentTransactions(
    transactions: Transaction[], 
    limit: number = 5
  ): Transaction[] {
    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  /**
   * Get budget statistics
   */
  static getBudgetStats(budgets: Budget[]) {
    const activeBudgets = budgets.filter(b => b.isActive);
    const overBudget = activeBudgets.filter(b => (b.spent || 0) > b.amount);
    
    return {
      activeBudgets,
      overBudget,
      totalActive: activeBudgets.length,
      totalOver: overBudget.length
    };
  }
}