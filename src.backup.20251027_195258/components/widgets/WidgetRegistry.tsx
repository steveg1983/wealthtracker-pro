import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ProfessionalIcon, type ProfessionalIconName } from '../icons/ProfessionalIcons';

// Import existing widgets
import NetWorthWidget from './NetWorthWidget';
import CashFlowWidget from './CashFlowWidget';
import BudgetSummaryWidget from './BudgetSummaryWidget';
import RecentTransactionsWidget from './RecentTransactionsWidget';
import GoalProgressWidget from './GoalProgressWidget';
import UpcomingBillsWidget from './UpcomingBillsWidget';
import ExpenseBreakdownWidget from './ExpenseBreakdownWidget';
import InvestmentSummaryWidget from './InvestmentSummaryWidget';
import MonthlySummaryWidget from './MonthlySummaryWidget';
import WeeklySummaryWidget from './WeeklySummaryWidget';
import AIAnalyticsWidget from './AIAnalyticsWidget';
import DataIntelligenceWidget from './DataIntelligenceWidget';
import BankConnectionsWidget from './BankConnectionsWidget';
import TaxPlanningWidget from './TaxPlanningWidget';
import FinancialPlanningWidget from './FinancialPlanningWidget';

// Import new widgets (to be created)
import DebtTrackerWidget from './DebtTrackerWidget';
import BillReminderWidget from './BillReminderWidget';
import BudgetVsActualWidget from './BudgetVsActualWidget';
import SyncStatusWidget from './SyncStatusWidget';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export type WidgetRendererProps = Record<string, unknown>;

export type WidgetComponentProps = WidgetRendererProps & {
  settings?: Record<string, unknown>;
};

export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  component: React.ComponentType<WidgetComponentProps>;
  defaultSize: WidgetSize;
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  refreshInterval?: number; // in seconds
  requiresAuth?: boolean;
  requiresData?: string[]; // e.g., ['accounts', 'transactions']
  category: 'overview' | 'budget' | 'investment' | 'analytics' | 'planning' | 'system';
  defaultSettings?: Record<string, unknown>;
}

const createIcon = (name: ProfessionalIconName) => (
  props: { size?: number; className?: string }
) => <ProfessionalIcon name={name} {...props} />;

export interface WidgetInstance {
  id: string;
  type: string;
  title: string;
  size: WidgetSize;
  position?: { x: number; y: number };
  isVisible: boolean;
  settings: Record<string, unknown>;
  order?: number;
}

class WidgetRegistryClass {
  private widgets: Map<string, WidgetDefinition> = new Map();
  
  constructor() {
    this.registerDefaultWidgets();
  }
  
  private registerDefaultWidgets() {
    // Overview Widgets
    this.register({
      type: 'net-worth',
      title: 'Net Worth',
      description: 'Track your total assets minus liabilities',
      icon: createIcon('trendingUp'),
      component: NetWorthWidget,
      defaultSize: 'medium',
      minSize: { w: 2, h: 2 },
      maxSize: { w: 6, h: 4 },
      requiresData: ['accounts'],
      category: 'overview',
      refreshInterval: 300 // 5 minutes
    });
    
    this.register({
      type: 'cash-flow',
      title: 'Cash Flow',
      description: 'Monitor income vs expenses over time',
      icon: createIcon('chartBar'),
      component: CashFlowWidget,
      defaultSize: 'large',
      minSize: { w: 4, h: 3 },
      maxSize: { w: 12, h: 6 },
      requiresData: ['transactions'],
      category: 'overview',
      defaultSettings: { forecastPeriod: 6 }
    });
    
    this.register({
      type: 'monthly-summary',
      title: 'Monthly Summary',
      description: 'Overview of current month financial activity',
      icon: createIcon('calendar'),
      component: MonthlySummaryWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 2 },
      maxSize: { w: 6, h: 4 },
      requiresData: ['transactions'],
      category: 'overview'
    });
    
    this.register({
      type: 'weekly-summary',
      title: 'Weekly Summary',
      description: 'Week-over-week spending trends',
      icon: createIcon('chartLine'),
      component: WeeklySummaryWidget,
      defaultSize: 'small',
      minSize: { w: 2, h: 2 },
      maxSize: { w: 4, h: 3 },
      requiresData: ['transactions'],
      category: 'overview'
    });
    
    // Budget Widgets
    this.register({
      type: 'budget-summary',
      title: 'Budget Summary',
      description: 'Track budget progress by category',
      icon: createIcon('piggyBank'),
      component: BudgetSummaryWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 3 },
      maxSize: { w: 6, h: 5 },
      requiresData: ['budgets', 'transactions'],
      category: 'budget',
      defaultSettings: { period: 'current' }
    });
    
    this.register({
      type: 'budget-vs-actual',
      title: 'Budget vs Actual',
      description: 'Compare budgeted amounts to actual spending',
      icon: createIcon('analyticsReport'),
      component: BudgetVsActualWidget,
      defaultSize: 'large',
      minSize: { w: 4, h: 3 },
      maxSize: { w: 8, h: 6 },
      requiresData: ['budgets', 'transactions'],
      category: 'budget',
      defaultSettings: { showVariance: true }
    });
    
    this.register({
      type: 'expense-breakdown',
      title: 'Expense Breakdown',
      description: 'Visualize spending by category',
      icon: createIcon('chartDonut'),
      component: ExpenseBreakdownWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 3 },
      maxSize: { w: 6, h: 5 },
      requiresData: ['transactions'],
      category: 'budget'
    });
    
    // Debt & Bills
    this.register({
      type: 'debt-tracker',
      title: 'Debt Tracker',
      description: 'Monitor credit cards and loans',
      icon: createIcon('creditCard'),
      component: DebtTrackerWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 3 },
      maxSize: { w: 6, h: 5 },
      requiresData: ['accounts'],
      category: 'budget',
      defaultSettings: { showInterest: true }
    });
    
    this.register({
      type: 'bill-reminder',
      title: 'Bill Reminders',
      description: 'Upcoming and overdue bills',
      icon: createIcon('notification'),
      component: BillReminderWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 3 },
      maxSize: { w: 6, h: 5 },
      requiresData: ['transactions'],
      category: 'budget',
      defaultSettings: { daysAhead: 14 }
    });
    
    this.register({
      type: 'upcoming-bills',
      title: 'Upcoming Bills',
      description: 'Bills due in the next period',
      icon: createIcon('calendar'),
      component: UpcomingBillsWidget,
      defaultSize: 'small',
      minSize: { w: 2, h: 2 },
      maxSize: { w: 4, h: 4 },
      requiresData: ['transactions'],
      category: 'budget'
    });
    
    // Investment Widgets
    this.register({
      type: 'investment-summary',
      title: 'Investment Summary',
      description: 'Portfolio performance overview',
      icon: createIcon('investments'),
      component: InvestmentSummaryWidget,
      defaultSize: 'large',
      minSize: { w: 4, h: 3 },
      maxSize: { w: 8, h: 6 },
      requiresData: ['accounts'],
      category: 'investment',
      requiresAuth: true
    });
    
    // Analytics Widgets
    this.register({
      type: 'ai-analytics',
      title: 'AI Insights',
      description: 'AI-powered financial insights',
      icon: createIcon('magicWand'),
      component: AIAnalyticsWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 3 },
      maxSize: { w: 6, h: 5 },
      requiresData: ['transactions'],
      category: 'analytics',
      refreshInterval: 600 // 10 minutes
    });
    
    this.register({
      type: 'data-intelligence',
      title: 'Data Intelligence',
      description: 'Smart analysis of your financial data',
      icon: createIcon('analyticsReport'),
      component: DataIntelligenceWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 3 },
      maxSize: { w: 6, h: 5 },
      requiresData: ['transactions'],
      category: 'analytics'
    });
    
    // Planning Widgets
    this.register({
      type: 'goal-progress',
      title: 'Goal Progress',
      description: 'Track progress toward financial goals',
      icon: createIcon('goals'),
      component: GoalProgressWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 2 },
      maxSize: { w: 6, h: 4 },
      requiresData: ['goals'],
      category: 'planning'
    });
    
    this.register({
      type: 'tax-planning',
      title: 'Tax Planning',
      description: 'Tax optimization insights',
      icon: createIcon('calculator'),
      component: TaxPlanningWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 3 },
      maxSize: { w: 6, h: 5 },
      requiresData: ['transactions'],
      category: 'planning'
    });
    
    this.register({
      type: 'financial-planning',
      title: 'Financial Planning',
      description: 'Retirement and investment planning',
      icon: createIcon('analyticsReport'),
      component: FinancialPlanningWidget,
      defaultSize: 'large',
      minSize: { w: 4, h: 3 },
      maxSize: { w: 8, h: 6 },
      requiresData: ['accounts'],
      category: 'planning'
    });
    
    // System Widgets
    this.register({
      type: 'recent-transactions',
      title: 'Recent Transactions',
      description: 'Latest financial activity',
      icon: createIcon('transactions'),
      component: RecentTransactionsWidget,
      defaultSize: 'medium',
      minSize: { w: 3, h: 3 },
      maxSize: { w: 6, h: 8 },
      requiresData: ['transactions'],
      category: 'system'
    });
    
    this.register({
      type: 'bank-connections',
      title: 'Bank Connections',
      description: 'Manage linked accounts',
      icon: createIcon('accounts'),
      component: BankConnectionsWidget,
      defaultSize: 'small',
      minSize: { w: 2, h: 2 },
      maxSize: { w: 4, h: 3 },
      requiresAuth: true,
      category: 'system'
    });
    
    this.register({
      type: 'sync-status',
      title: 'Sync Status',
      description: 'Real-time sync status for all accounts',
      icon: createIcon('refresh'),
      component: SyncStatusWidget,
      defaultSize: 'small',
      minSize: { w: 2, h: 2 },
      maxSize: { w: 4, h: 4 },
      requiresData: ['accounts'],
      category: 'system',
      refreshInterval: 30 // 30 seconds
    });
  }
  
  register(definition: WidgetDefinition) {
    this.widgets.set(definition.type, definition);
  }
  
  getWidget(type: string): WidgetDefinition | undefined {
    return this.widgets.get(type);
  }
  
  getAllWidgets(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }
  
  getWidgetsByCategory(category: string): WidgetDefinition[] {
    return this.getAllWidgets().filter(w => w.category === category);
  }
  
  createWidget(type: string): WidgetInstance | null {
    const definition = this.getWidget(type);
    if (!definition) return null;
    
    return {
      id: uuidv4(),
      type,
      title: definition.title,
      size: definition.defaultSize,
      isVisible: true,
      settings: definition.defaultSettings || {},
      order: 999
    };
  }
  
  renderWidget(instance: WidgetInstance, props: WidgetRendererProps): React.ReactNode {
    const definition = this.getWidget(instance.type);
    if (!definition) return <div>Widget type not found: {instance.type}</div>;
    
    const Component = definition.component;
    return <Component {...props} settings={instance.settings} />;
  }
  
  getCategories(): string[] {
    const categories = new Set<string>();
    this.getAllWidgets().forEach(w => categories.add(w.category));
    return Array.from(categories);
  }
  
  validateWidget(instance: WidgetInstance, availableData: string[]): boolean {
    const definition = this.getWidget(instance.type);
    if (!definition) return false;
    
    // Check if required data is available
    if (definition.requiresData) {
      for (const required of definition.requiresData) {
        if (!availableData.includes(required)) {
          return false;
        }
      }
    }
    
    return true;
  }
}

// Export singleton instance
export const WidgetRegistry = new WidgetRegistryClass();
