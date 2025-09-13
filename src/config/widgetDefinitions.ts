/**
 * Widget Definitions Configuration
 * Central registry of all available dashboard widgets
 */

import NetWorthWidget from '../components/widgets/NetWorthWidget';
import CashFlowWidget from '../components/widgets/CashFlowWidget';
import BudgetSummaryWidget from '../components/widgets/BudgetSummaryWidget';
import RecentTransactionsWidget from '../components/widgets/RecentTransactionsWidget';
import GoalProgressWidget from '../components/widgets/GoalProgressWidget';
import UpcomingBillsWidget from '../components/widgets/UpcomingBillsWidget';
import ExpenseBreakdownWidget from '../components/widgets/ExpenseBreakdownWidget';
import InvestmentSummaryWidget from '../components/widgets/InvestmentSummaryWidget';
import MonthlySummaryWidget from '../components/widgets/MonthlySummaryWidget';
import WeeklySummaryWidget from '../components/widgets/WeeklySummaryWidget';
import AIAnalyticsWidget from '../components/widgets/AIAnalyticsWidget';
import DataIntelligenceWidget from '../components/widgets/DataIntelligenceWidget';
import BankConnectionsWidget from '../components/widgets/BankConnectionsWidget';
import TaxPlanningWidget from '../components/widgets/TaxPlanningWidget';
import FinancialPlanningWidget from '../components/widgets/FinancialPlanningWidget';
import DebtTrackerWidget from '../components/widgets/DebtTrackerWidget';
import BillReminderWidget from '../components/widgets/BillReminderWidget';
import BudgetVsActualWidget from '../components/widgets/BudgetVsActualWidget';
import SyncStatusWidget from '../components/widgets/SyncStatusWidget';
import type { ComponentType } from 'react';
import type { WidgetDefinition, WidgetComponentProps } from '../services/widgetRegistryService';

export const overviewWidgets: WidgetDefinition[] = [
  {
    type: 'net-worth',
    title: 'Net Worth',
    description: 'Track your total assets minus liabilities',
    icon: '💰',
    component: NetWorthWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'medium',
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    requiresData: ['accounts'],
    category: 'overview',
    refreshInterval: 300
  },
  {
    type: 'cash-flow',
    title: 'Cash Flow',
    description: 'Monitor income vs expenses over time',
    icon: '📊',
    component: CashFlowWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'large',
    minSize: { w: 4, h: 3 },
    maxSize: { w: 12, h: 6 },
    requiresData: ['transactions'],
    category: 'overview',
    defaultSettings: { forecastPeriod: 6 }
  },
  {
    type: 'monthly-summary',
    title: 'Monthly Summary',
    description: 'Overview of current month financial activity',
    icon: '📅',
    component: MonthlySummaryWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'medium',
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    requiresData: ['transactions'],
    category: 'overview'
  },
  {
    type: 'weekly-summary',
    title: 'Weekly Summary',
    description: 'Week-over-week spending trends',
    icon: '📈',
    component: WeeklySummaryWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'small',
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 3 },
    requiresData: ['transactions'],
    category: 'overview'
  }
];

export const budgetWidgets: WidgetDefinition[] = [
  {
    type: 'budget-summary',
    title: 'Budget Summary',
    description: 'Track budget progress by category',
    icon: '🎯',
    component: BudgetSummaryWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'medium',
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    requiresData: ['budgets', 'transactions'],
    category: 'budget',
    defaultSettings: { period: 'current' }
  },
  {
    type: 'budget-vs-actual',
    title: 'Budget vs Actual',
    description: 'Compare budgeted amounts to actual spending',
    icon: '⚖️',
    component: BudgetVsActualWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'large',
    minSize: { w: 4, h: 3 },
    maxSize: { w: 8, h: 6 },
    requiresData: ['budgets', 'transactions'],
    category: 'budget',
    defaultSettings: { showVariance: true }
  },
  {
    type: 'expense-breakdown',
    title: 'Expense Breakdown',
    description: 'Visualize spending by category',
    icon: '🍰',
    component: ExpenseBreakdownWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'medium',
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    requiresData: ['transactions'],
    category: 'budget'
  },
  {
    type: 'debt-tracker',
    title: 'Debt Tracker',
    description: 'Monitor credit cards and loans',
    icon: '💳',
    component: DebtTrackerWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'medium',
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    requiresData: ['accounts'],
    category: 'budget',
    defaultSettings: { showInterest: true }
  },
  {
    type: 'bill-reminder',
    title: 'Bill Reminders',
    description: 'Upcoming and overdue bills',
    icon: '🔔',
    component: BillReminderWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'medium',
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    requiresData: ['transactions'],
    category: 'budget',
    defaultSettings: { daysAhead: 14 }
  },
  {
    type: 'upcoming-bills',
    title: 'Upcoming Bills',
    description: 'Bills due in the next period',
    icon: '📝',
    component: UpcomingBillsWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'small',
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    requiresData: ['transactions'],
    category: 'budget'
  }
];

export const investmentWidgets: WidgetDefinition[] = [
  {
    type: 'investment-summary',
    title: 'Investment Summary',
    description: 'Portfolio performance overview',
    icon: '📈',
    component: InvestmentSummaryWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'large',
    minSize: { w: 4, h: 3 },
    maxSize: { w: 8, h: 6 },
    requiresData: ['accounts'],
    category: 'investment',
    requiresAuth: true
  }
];

export const analyticsWidgets: WidgetDefinition[] = [
  {
    type: 'ai-analytics',
    title: 'AI Insights',
    description: 'AI-powered financial insights',
    icon: '🤖',
    component: AIAnalyticsWidget,
    defaultSize: 'medium',
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    requiresData: ['transactions'],
    category: 'analytics',
    refreshInterval: 600
  },
  {
    type: 'data-intelligence',
    title: 'Data Intelligence',
    description: 'Smart analysis of your financial data',
    icon: '🧠',
    component: DataIntelligenceWidget,
    defaultSize: 'medium',
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    requiresData: ['transactions'],
    category: 'analytics'
  }
];

export const planningWidgets: WidgetDefinition[] = [
  {
    type: 'goal-progress',
    title: 'Goal Progress',
    description: 'Track progress toward financial goals',
    icon: '🎯',
    component: GoalProgressWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'medium',
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    requiresData: ['goals'],
    category: 'planning'
  },
  {
    type: 'tax-planning',
    title: 'Tax Planning',
    description: 'Tax optimization insights',
    icon: '🧾',
    component: TaxPlanningWidget,
    defaultSize: 'medium',
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
    requiresData: ['transactions'],
    category: 'planning'
  },
  {
    type: 'financial-planning',
    title: 'Financial Planning',
    description: 'Retirement and investment planning',
    icon: '📋',
    component: FinancialPlanningWidget,
    defaultSize: 'large',
    minSize: { w: 4, h: 3 },
    maxSize: { w: 8, h: 6 },
    requiresData: ['accounts'],
    category: 'planning'
  }
];

export const systemWidgets: WidgetDefinition[] = [
  {
    type: 'recent-transactions',
    title: 'Recent Transactions',
    description: 'Latest financial activity',
    icon: '📜',
    component: RecentTransactionsWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'medium',
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 8 },
    requiresData: ['transactions'],
    category: 'system'
  },
  {
    type: 'bank-connections',
    title: 'Bank Connections',
    description: 'Manage linked accounts',
    icon: '🏦',
    component: BankConnectionsWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'small',
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 3 },
    requiresAuth: true,
    category: 'system'
  },
  {
    type: 'sync-status',
    title: 'Sync Status',
    description: 'Real-time sync status for all accounts',
    icon: '🔄',
    component: SyncStatusWidget as unknown as ComponentType<WidgetComponentProps>,
    defaultSize: 'small',
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    requiresData: ['accounts'],
    category: 'system',
    refreshInterval: 30
  }
];

export const allWidgetDefinitions: WidgetDefinition[] = [
  ...overviewWidgets,
  ...budgetWidgets,
  ...investmentWidgets,
  ...analyticsWidgets,
  ...planningWidgets,
  ...systemWidgets
];