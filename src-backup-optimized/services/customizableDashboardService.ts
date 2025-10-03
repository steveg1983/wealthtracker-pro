/**
 * Customizable Dashboard Service
 * Business logic for dashboard widget management
 */

import type { WidgetConfig } from '../components/DashboardWidget';

export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: 'net-worth',
    type: 'net-worth',
    title: 'Net Worth',
    size: 'medium',
    position: { x: 0, y: 0 },
    isVisible: true,
    settings: {}
  },
  {
    id: 'cash-flow',
    type: 'cash-flow',
    title: 'Cash Flow',
    size: 'large',
    position: { x: 2, y: 0 },
    isVisible: true,
    settings: { forecastPeriod: 6 }
  },
  {
    id: 'budget-summary',
    type: 'budget-summary',
    title: 'Budget Summary',
    size: 'medium',
    position: { x: 0, y: 1 },
    isVisible: true,
    settings: { period: 'current' }
  },
  {
    id: 'recent-transactions',
    type: 'recent-transactions',
    title: 'Recent Transactions',
    size: 'medium',
    position: { x: 2, y: 1 },
    isVisible: true,
    settings: { count: 5 }
  }
];

export const AVAILABLE_WIDGETS: WidgetDefinition[] = [
  { type: 'net-worth', title: 'Net Worth', description: 'Track your total net worth over time' },
  { type: 'cash-flow', title: 'Cash Flow', description: 'Monitor income vs expenses with forecasting' },
  { type: 'budget-summary', title: 'Budget Summary', description: 'Overview of budget performance' },
  { type: 'recent-transactions', title: 'Recent Transactions', description: 'Latest financial transactions' },
  { type: 'goal-progress', title: 'Goal Progress', description: 'Track progress towards financial goals' },
  { type: 'expense-breakdown', title: 'Expense Breakdown', description: 'Categorized expense analysis' },
  { type: 'investment-summary', title: 'Investment Summary', description: 'Portfolio performance overview' },
  { type: 'upcoming-bills', title: 'Upcoming Bills', description: 'Bills due in the next 30 days' },
  { type: 'weekly-summary', title: 'Weekly Summary', description: 'Financial summary for the current week' },
  { type: 'monthly-summary', title: 'Monthly Summary', description: 'Financial summary for the current month' },
  { type: 'bank-connections', title: 'Bank Connections', description: 'Connected bank accounts status' },
  { type: 'ai-analytics', title: 'AI Analytics', description: 'AI-powered insights and recommendations' },
  { type: 'tax-planning', title: 'Tax Planning', description: 'Tax estimates and deduction tracking' },
  { type: 'investment-enhancement', title: 'Investment Enhancement', description: 'Portfolio optimization and analysis' },
  { type: 'security', title: 'Security Status', description: 'Security settings and activity monitoring' },
  { type: 'collaboration', title: 'Household Collaboration', description: 'Shared expenses and household management' },
  { type: 'mobile-app', title: 'Mobile App', description: 'Offline support and mobile features' },
  { type: 'business', title: 'Business Features', description: 'Invoice management, expenses, and mileage tracking' },
  { type: 'financial-planning', title: 'Financial Planning', description: 'Retirement planning, mortgage calculator, and financial goals' },
  { type: 'data-intelligence', title: 'Data Intelligence', description: 'Smart insights, subscription management, and spending pattern analysis' }
];

class CustomizableDashboardService {
  /**
   * Create a new widget configuration
   */
  createWidget(type: string): WidgetConfig | null {
    const template = AVAILABLE_WIDGETS.find(w => w.type === type);
    if (!template) return null;

    return {
      id: `${type}-${Date.now()}`,
      type: type as WidgetConfig['type'],
      title: template.title,
      size: 'medium',
      position: { x: 0, y: 0 },
      isVisible: true,
      settings: this.getDefaultSettings(type)
    };
  }

  /**
   * Get default settings for a widget type
   */
  private getDefaultSettings(type: string): Record<string, any> {
    switch (type) {
      case 'cash-flow':
        return { forecastPeriod: 6 };
      case 'budget-summary':
        return { period: 'current' };
      case 'recent-transactions':
        return { count: 5 };
      default:
        return {};
    }
  }

  /**
   * Update widget configuration
   */
  updateWidget(
    widgets: WidgetConfig[],
    widgetId: string,
    update: Partial<WidgetConfig>
  ): WidgetConfig[] {
    return widgets.map(w => 
      w.id === widgetId ? { ...w, ...update } : w
    );
  }

  /**
   * Remove a widget
   */
  removeWidget(widgets: WidgetConfig[], widgetId: string): WidgetConfig[] {
    return widgets.filter(w => w.id !== widgetId);
  }

  /**
   * Toggle widget visibility
   */
  toggleWidgetVisibility(widgets: WidgetConfig[], widgetId: string): WidgetConfig[] {
    return widgets.map(w => 
      w.id === widgetId ? { ...w, isVisible: !w.isVisible } : w
    );
  }

  /**
   * Get visible widgets
   */
  getVisibleWidgets(widgets: WidgetConfig[]): WidgetConfig[] {
    return widgets.filter(w => w.isVisible);
  }

  /**
   * Refresh all widgets
   */
  refreshAllWidgets(widgets: WidgetConfig[]): WidgetConfig[] {
    const now = new Date();
    return widgets.map(w => ({ ...w, lastRefresh: now }));
  }

  /**
   * Reset to default layout
   */
  resetToDefault(): WidgetConfig[] {
    return [...DEFAULT_WIDGETS];
  }

  /**
   * Find widget definition by type
   */
  getWidgetDefinition(type: string): WidgetDefinition | undefined {
    return AVAILABLE_WIDGETS.find(w => w.type === type);
  }

  /**
   * Validate widget position
   */
  validatePosition(position: { x: number; y: number }): boolean {
    return position.x >= 0 && position.y >= 0;
  }
}

export const customizableDashboardService = new CustomizableDashboardService();