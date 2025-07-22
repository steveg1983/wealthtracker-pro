import React, { useState, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import DashboardWidget from './DashboardWidget';
import type { WidgetConfig } from './DashboardWidget';
import NetWorthWidget from './widgets/NetWorthWidget';
import CashFlowWidget from './widgets/CashFlowWidget';
import BudgetSummaryWidget from './widgets/BudgetSummaryWidget';
import RecentTransactionsWidget from './widgets/RecentTransactionsWidget';
import GoalProgressWidget from './widgets/GoalProgressWidget';
import ExpenseBreakdownWidget from './widgets/ExpenseBreakdownWidget';
import InvestmentSummaryWidget from './widgets/InvestmentSummaryWidget';
import UpcomingBillsWidget from './widgets/UpcomingBillsWidget';
import WeeklySummaryWidget from './widgets/WeeklySummaryWidget';
import MonthlySummaryWidget from './widgets/MonthlySummaryWidget';
import BankConnectionsWidget from './widgets/BankConnectionsWidget';
import AIAnalyticsWidget from './widgets/AIAnalyticsWidget';
import TaxPlanningWidget from './widgets/TaxPlanningWidget';
import InvestmentEnhancementWidget from './widgets/InvestmentEnhancementWidget';
import SecurityWidget from './widgets/SecurityWidget';
import CollaborationWidget from './widgets/CollaborationWidget';
import MobileAppWidget from './widgets/MobileAppWidget';
import BusinessWidget from './widgets/BusinessWidget';
import FinancialPlanningWidget from './widgets/FinancialPlanningWidget';
import DataIntelligenceWidget from './widgets/DataIntelligenceWidget';
import { 
  PlusIcon, 
  SettingsIcon, 
  GridIcon, 
  EyeIcon, 
  EyeOffIcon,
  RefreshCwIcon
} from './icons';

const DEFAULT_WIDGETS: WidgetConfig[] = [
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

const AVAILABLE_WIDGETS = [
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
] as const;

export default function CustomizableDashboard(): React.JSX.Element {
  const [widgets, setWidgets] = useLocalStorage<WidgetConfig[]>('dashboard-widgets', DEFAULT_WIDGETS);
  const [isDragMode, setIsDragMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleWidgetConfigChange = useCallback((config: WidgetConfig) => {
    setWidgets(prev => prev.map(w => w.id === config.id ? config : w));
  }, [setWidgets]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  }, [setWidgets]);

  const handleAddWidget = useCallback((type: string) => {
    const widgetTemplate = AVAILABLE_WIDGETS.find(w => w.type === type);
    if (!widgetTemplate) return;

    const newWidget: WidgetConfig = {
      id: `${type}-${Date.now()}`,
      type: type as any,
      title: widgetTemplate.title,
      size: 'medium',
      position: { x: 0, y: 0 },
      isVisible: true,
      settings: {}
    };

    setWidgets(prev => [...prev, newWidget]);
    setShowAddWidget(false);
  }, [setWidgets]);

  const handleToggleWidgetVisibility = useCallback((widgetId: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, isVisible: !w.isVisible } : w
    ));
  }, [setWidgets]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const now = new Date();
    setWidgets(prev => prev.map(w => ({ ...w, lastRefresh: now })));
    setIsRefreshing(false);
  }, [setWidgets]);

  const renderWidget = useCallback((config: WidgetConfig) => {
    const commonProps = {
      size: config.size,
      settings: config.settings
    };

    switch (config.type) {
      case 'net-worth':
        return <NetWorthWidget {...commonProps} />;
      case 'cash-flow':
        return <CashFlowWidget {...commonProps} />;
      case 'budget-summary':
        return <BudgetSummaryWidget {...commonProps} />;
      case 'recent-transactions':
        return <RecentTransactionsWidget {...commonProps} />;
      case 'goal-progress':
        return <GoalProgressWidget {...commonProps} />;
      case 'expense-breakdown':
        return <ExpenseBreakdownWidget {...commonProps} />;
      case 'investment-summary':
        return <InvestmentSummaryWidget {...commonProps} />;
      case 'upcoming-bills':
        return <UpcomingBillsWidget {...commonProps} />;
      case 'weekly-summary':
        return <WeeklySummaryWidget {...commonProps} />;
      case 'monthly-summary':
        return <MonthlySummaryWidget {...commonProps} />;
      case 'bank-connections':
        return <BankConnectionsWidget {...commonProps} />;
      case 'ai-analytics':
        return <AIAnalyticsWidget {...commonProps} />;
      case 'tax-planning':
        return <TaxPlanningWidget {...commonProps} />;
      case 'investment-enhancement':
        return <InvestmentEnhancementWidget {...commonProps} />;
      case 'security':
        return <SecurityWidget {...commonProps} />;
      case 'collaboration':
        return <CollaborationWidget {...commonProps} />;
      case 'mobile-app':
        return <MobileAppWidget {...commonProps} />;
      case 'business':
        return <BusinessWidget {...commonProps} />;
      case 'financial-planning':
        return <FinancialPlanningWidget {...commonProps} />;
      case 'data-intelligence':
        return <DataIntelligenceWidget {...commonProps} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">🚧</div>
              <div>Widget not implemented</div>
            </div>
          </div>
        );
    }
  }, []);

  const visibleWidgets = widgets.filter(w => w.isVisible);

  return (
    <div className="space-y-6">
      {/* Dashboard Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Customize your financial overview
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
          >
            <RefreshCwIcon size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh All
          </button>
          
          <button
            onClick={() => setIsDragMode(!isDragMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              isDragMode 
                ? 'bg-[var(--color-primary)] text-white' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <GridIcon size={16} />
            {isDragMode ? 'Exit Edit' : 'Edit Layout'}
          </button>
          
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <SettingsIcon size={16} />
            Settings
          </button>
          
          <button
            onClick={() => setShowAddWidget(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <PlusIcon size={16} />
            Add Widget
          </button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
        {visibleWidgets.map((config) => (
          <DashboardWidget
            key={config.id}
            config={config}
            onConfigChange={handleWidgetConfigChange}
            onRemove={handleRemoveWidget}
            isDragMode={isDragMode}
          >
            {renderWidget(config)}
          </DashboardWidget>
        ))}
        
        {visibleWidgets.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400 mb-4">
              <GridIcon size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No widgets visible
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Add some widgets to customize your dashboard
            </p>
            <button
              onClick={() => setShowAddWidget(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Add Your First Widget
            </button>
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      {showAddWidget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Widget
              </h3>
              <button
                onClick={() => setShowAddWidget(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <PlusIcon size={20} className="rotate-45" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_WIDGETS.map((widget) => (
                <button
                  key={widget.type}
                  onClick={() => handleAddWidget(widget.type)}
                  className="p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-[var(--color-primary)] hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {widget.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {widget.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Dashboard Settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <PlusIcon size={20} className="rotate-45" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                  Widget Visibility
                </h4>
                <div className="space-y-2">
                  {widgets.map((widget) => (
                    <div key={widget.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {widget.title}
                      </span>
                      <button
                        onClick={() => handleToggleWidgetVisibility(widget.id)}
                        className={`p-1 rounded ${
                          widget.isVisible 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-400'
                        }`}
                      >
                        {widget.isVisible ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setWidgets(DEFAULT_WIDGETS);
                    setShowSettings(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  Reset to Default Layout
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}