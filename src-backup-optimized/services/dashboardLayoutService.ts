/**
 * Dashboard Layout Service
 * Handles dashboard layout management and widget configuration
 */

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

export interface WidgetConfig {
  title: string;
  icon: React.ElementType;
  defaultSize: 'small' | 'medium' | 'large';
  description: string;
}

export class DashboardLayoutService {
  private readonly STORAGE_KEY = 'dashboardLayout';

  /**
   * Get available widget types configuration
   */
  getWidgetTypes(): Record<string, Omit<WidgetConfig, 'icon'>> {
    return {
      netWorth: { title: 'Net Worth', defaultSize: 'medium', description: 'Track your total net worth' },
      netWorthTrend: { title: 'Net Worth Trend', defaultSize: 'large', description: 'Historical net worth chart' },
      accounts: { title: 'Accounts Overview', defaultSize: 'large', description: 'View all your accounts' },
      transactions: { title: 'Recent Transactions', defaultSize: 'large', description: 'Latest transactions' },
      budgets: { title: 'Budget Status', defaultSize: 'medium', description: 'Budget tracking' },
      savingsGoals: { title: 'Savings Goals', defaultSize: 'large', description: 'Track savings goals progress' },
      debtTracker: { title: 'Debt Tracker', defaultSize: 'medium', description: 'Monitor debts and loans' },
      billReminders: { title: 'Bill Reminders', defaultSize: 'medium', description: 'Upcoming bills and payments' },
      investmentPerformance: { title: 'Investment Performance', defaultSize: 'large', description: 'Portfolio performance' },
      cashFlow: { title: 'Cash Flow', defaultSize: 'large', description: 'Income vs expenses' },
      recentAlerts: { title: 'Recent Alerts', defaultSize: 'medium', description: 'Important notifications' },
      expenseCategories: { title: 'Expense Categories', defaultSize: 'medium', description: 'Spending by category' }
    };
  }

  /**
   * Get default layout
   */
  getDefaultLayout(): WidgetLayout {
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
   * Load saved layout from storage
   */
  loadLayout(): WidgetLayout {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return this.getDefaultLayout();
      }
    }
    return this.getDefaultLayout();
  }

  /**
   * Save layout to storage
   */
  saveLayout(layout: WidgetLayout): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(layout));
  }

  /**
   * Create new widget
   */
  createWidget(type: string): Widget {
    const widgetTypes = this.getWidgetTypes();
    const widgetConfig = widgetTypes[type];
    if (!widgetConfig) {
      throw new Error(`Unknown widget type: ${type}`);
    }

    return {
      id: `${type}-${Date.now()}`,
      type,
      title: widgetConfig.title,
      size: widgetConfig.defaultSize
    };
  }

  /**
   * Remove widget from layout
   */
  removeWidget(layout: WidgetLayout, widgetId: string): WidgetLayout {
    return {
      widgets: layout.widgets.filter(w => w.id !== widgetId),
      order: layout.order.filter(id => id !== widgetId)
    };
  }

  /**
   * Add widget to layout
   */
  addWidget(layout: WidgetLayout, widget: Widget): WidgetLayout {
    return {
      widgets: [...layout.widgets, widget],
      order: [...layout.order, widget.id]
    };
  }

  /**
   * Toggle widget compactness
   */
  toggleWidgetSize(layout: WidgetLayout, widgetId: string): WidgetLayout {
    return {
      ...layout,
      widgets: layout.widgets.map(w => 
        w.id === widgetId ? { ...w, isCompact: !w.isCompact } : w
      )
    };
  }

  /**
   * Reorder widgets
   */
  reorderWidgets(layout: WidgetLayout, oldIndex: number, newIndex: number): WidgetLayout {
    const newOrder = [...layout.order];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);
    
    return {
      ...layout,
      order: newOrder
    };
  }
}

export const dashboardLayoutService = new DashboardLayoutService();