/**
 * WidgetRegistry - Registry for dashboard widgets
 *
 * Features:
 * - Widget registration and management
 * - Widget metadata and configuration
 * - Dynamic widget loading
 * - Widget lifecycle management
 */

import React, { ReactNode } from 'react';
import { lazyLogger as logger } from '../../services/serviceFactory';

// Widget types
export type WidgetSize = 'small' | 'medium' | 'large' | 'full';
export type WidgetCategory = 'financial' | 'analytics' | 'goals' | 'accounts' | 'budgets' | 'utility';

export interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  icon: string;
  component: React.ComponentType<WidgetProps>;
  isCustomizable: boolean;
  requiresData?: string[];
  premium?: boolean;
}

export interface WidgetProps {
  id: string;
  size: WidgetSize;
  config?: Record<string, any>;
  onConfigChange?: (config: Record<string, any>) => void;
  onRemove?: () => void;
}

// Base widget components
function AccountSummaryWidget({ id, size }: WidgetProps): React.JSX.Element {
  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
      size === 'small' ? 'h-32' : size === 'medium' ? 'h-48' : 'h-64'
    }`}>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Account Summary</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Total Balance</span>
          <span className="font-medium text-green-600">£5,420.50</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">This Month</span>
          <span className="font-medium text-blue-600">+£320.00</span>
        </div>
      </div>
    </div>
  );
}

function RecentTransactionsWidget({ id, size }: WidgetProps): React.JSX.Element {
  const transactions = [
    { id: 1, description: 'Grocery Store', amount: -45.23, date: '2025-01-15' },
    { id: 2, description: 'Salary Deposit', amount: 3200.00, date: '2025-01-14' },
    { id: 3, description: 'Coffee Shop', amount: -4.50, date: '2025-01-14' }
  ];

  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
      size === 'small' ? 'h-32' : size === 'medium' ? 'h-48' : 'h-64'
    }`}>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Recent Transactions</h3>
      <div className="space-y-2 overflow-y-auto">
        {transactions.map(transaction => (
          <div key={transaction.id} className="flex justify-between items-center text-sm">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{transaction.description}</div>
              <div className="text-gray-500 dark:text-gray-400">{transaction.date}</div>
            </div>
            <span className={`font-medium ${
              transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {transaction.amount > 0 ? '+' : ''}£{Math.abs(transaction.amount).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetOverviewWidget({ id, size }: WidgetProps): React.JSX.Element {
  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
      size === 'small' ? 'h-32' : size === 'medium' ? 'h-48' : 'h-64'
    }`}>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Budget Overview</h3>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Groceries</span>
            <span className="text-gray-900 dark:text-gray-100">£245 / £300</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full" style={{ width: '82%' }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Entertainment</span>
            <span className="text-gray-900 dark:text-gray-100">£180 / £150</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-red-600 h-2 rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalsProgressWidget({ id, size }: WidgetProps): React.JSX.Element {
  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
      size === 'small' ? 'h-32' : size === 'medium' ? 'h-48' : 'h-64'
    }`}>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Goals Progress</h3>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-900 dark:text-gray-100">Emergency Fund</span>
            <span className="text-gray-600 dark:text-gray-400">65%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }}></div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">£3,250 / £5,000</div>
        </div>
      </div>
    </div>
  );
}

// Widget registry
class WidgetRegistryClass {
  private widgets = new Map<string, WidgetConfig>();

  constructor() {
    this.registerDefaultWidgets();
  }

  private registerDefaultWidgets() {
    // Register built-in widgets
    this.register({
      id: 'account-summary',
      name: 'Account Summary',
      description: 'Overview of all account balances',
      category: 'financial',
      defaultSize: 'medium',
      allowedSizes: ['small', 'medium', 'large'],
      icon: '🏦',
      component: AccountSummaryWidget,
      isCustomizable: false,
      requiresData: ['accounts']
    });

    this.register({
      id: 'recent-transactions',
      name: 'Recent Transactions',
      description: 'Latest financial transactions',
      category: 'financial',
      defaultSize: 'large',
      allowedSizes: ['medium', 'large', 'full'],
      icon: '💰',
      component: RecentTransactionsWidget,
      isCustomizable: true,
      requiresData: ['transactions']
    });

    this.register({
      id: 'budget-overview',
      name: 'Budget Overview',
      description: 'Current budget status and spending',
      category: 'budgets',
      defaultSize: 'medium',
      allowedSizes: ['small', 'medium', 'large'],
      icon: '📊',
      component: BudgetOverviewWidget,
      isCustomizable: true,
      requiresData: ['budgets', 'transactions']
    });

    this.register({
      id: 'goals-progress',
      name: 'Goals Progress',
      description: 'Track progress towards financial goals',
      category: 'goals',
      defaultSize: 'medium',
      allowedSizes: ['small', 'medium', 'large'],
      icon: '🎯',
      component: GoalsProgressWidget,
      isCustomizable: false,
      requiresData: ['goals']
    });

    logger.debug('Default widgets registered');
  }

  register(config: WidgetConfig): void {
    this.widgets.set(config.id, config);
    logger.debug('Widget registered:', config.id);
  }

  unregister(id: string): void {
    this.widgets.delete(id);
    logger.debug('Widget unregistered:', id);
  }

  get(id: string): WidgetConfig | undefined {
    return this.widgets.get(id);
  }

  getAll(): WidgetConfig[] {
    return Array.from(this.widgets.values());
  }

  getByCategory(category: WidgetCategory): WidgetConfig[] {
    return this.getAll().filter(widget => widget.category === category);
  }

  getAvailable(isPremium: boolean = false): WidgetConfig[] {
    return this.getAll().filter(widget => !widget.premium || isPremium);
  }

  renderWidget(id: string, props: Omit<WidgetProps, 'id'>): ReactNode {
    const widget = this.get(id);
    if (!widget) {
      logger.error('Widget not found:', id);
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">Widget not found: {id}</p>
        </div>
      );
    }

    const WidgetComponent = widget.component;
    return <WidgetComponent id={id} {...props} />;
  }
}

// Export singleton instance
export const WidgetRegistry = new WidgetRegistryClass();
export default WidgetRegistry;