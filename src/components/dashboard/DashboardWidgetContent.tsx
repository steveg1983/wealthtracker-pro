import { memo, lazy, useEffect } from 'react';
import type { Account, Transaction, Budget, Goal } from '../../types';
import type { DecimalInstance } from '../../types/decimal-types';
import { logger } from '../../services/loggingService';
import { 
  TrendingUpIcon,
  WalletIcon,
  TargetIcon,
  CreditCardIcon,
  PieChartIcon,
  BanknoteIcon,
  CalendarIcon,
  AlertCircleIcon,
  ArrowRightLeftIcon
} from '../icons';

// Lazy load heavy widgets
const DebtTrackerWidget = lazy(() => import('./widgets/DebtTrackerWidget'));
const BillRemindersWidget = lazy(() => import('./widgets/BillRemindersWidget'));
const InvestmentPerformanceWidget = lazy(() => import('./widgets/InvestmentPerformanceWidget'));
const SavingsGoalsWidget = lazy(() => import('./widgets/SavingsGoalsWidget'));
const CashFlowWidget = lazy(() => import('./widgets/CashFlowWidget'));
const RecentAlertsWidget = lazy(() => import('./widgets/RecentAlertsWidget'));
const NetWorthTrendWidget = lazy(() => import('./widgets/NetWorthTrendWidget'));
const ExpenseCategoriesWidget = lazy(() => import('./widgets/ExpenseCategoriesWidget'));

interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  isCompact?: boolean;
  settings?: Record<string, unknown>;
}

interface DashboardWidgetContentProps {
  widget: Widget;
  metrics: {
    totalAssets: DecimalInstance;
    totalLiabilities: DecimalInstance;
    netWorth: DecimalInstance;
  };
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  navigate: (path: string) => void;
  formatCurrencyWithSymbol: (amount: number) => string;
}

/**
 * Renders content for different widget types
 * Extracted from OptimizedDashboard for single responsibility
 */
export const DashboardWidgetContent = memo(function DashboardWidgetContent({ 
  widget, 
  metrics, 
  accounts, 
  transactions, 
  budgets, 
  goals, 
  navigate, 
  formatCurrencyWithSymbol 
}: DashboardWidgetContentProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardWidgetContent component initialized', {
      componentName: 'DashboardWidgetContent'
    });
  }, []);

  switch (widget.type) {
    case 'netWorth':
      return (
        <div className="space-y-4">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrencyWithSymbol(metrics.netWorth.toNumber())}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Assets</div>
              <div className="text-green-600 font-semibold">
                {formatCurrencyWithSymbol(metrics.totalAssets.toNumber())}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Liabilities</div>
              <div className="text-red-600 font-semibold">
                {formatCurrencyWithSymbol(metrics.totalLiabilities.toNumber())}
              </div>
            </div>
          </div>
        </div>
      );
      
    case 'accounts': {
      const visibleAccounts = widget.isCompact ? accounts.slice(0, 3) : accounts.slice(0, 5);
      return (
        <div className="space-y-3">
          {visibleAccounts.map((account) => (
            <div key={account.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{account.name}</div>
                <div className="text-xs text-gray-500">{account.type}</div>
              </div>
              <div className={`font-semibold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrencyWithSymbol(account.balance)}
              </div>
            </div>
          ))}
          <button
            onClick={() => navigate('/accounts')}
            className="text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500"
          >
            View all accounts →
          </button>
        </div>
      );
    }
      
    case 'transactions': {
      const recentTransactions = transactions
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, widget.isCompact ? 3 : 5);
      
      return (
        <div className="space-y-3">
          {recentTransactions.map((transaction) => (
            <div key={transaction.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{transaction.description}</div>
                <div className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString()}</div>
              </div>
              <div className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                {transaction.type === 'income' ? '+' : '-'}{formatCurrencyWithSymbol(Math.abs(transaction.amount))}
              </div>
            </div>
          ))}
          <button
            onClick={() => navigate('/transactions')}
            className="text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500"
          >
            View all transactions →
          </button>
        </div>
      );
    }
      
    case 'budgets': {
      const activeBudgets = budgets.filter((b) => b.isActive);
      const overBudget = activeBudgets.filter((b) => (b.spent || 0) > b.amount);
      
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Active Budgets</span>
            <span className="text-2xl font-bold">{activeBudgets.length}</span>
          </div>
          {overBudget.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircleIcon size={20} />
                <span className="font-medium">{overBudget.length} budgets exceeded</span>
              </div>
            </div>
          )}
          <button
            onClick={() => navigate('/budget')}
            className="text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500"
          >
            Manage budgets →
          </button>
        </div>
      );
    }
      
    case 'savingsGoals':
      return <SavingsGoalsWidget isCompact={!!widget.isCompact} />;
      
    case 'debtTracker':
      return <DebtTrackerWidget isCompact={!!widget.isCompact} />;
      
    case 'billReminders':
      return <BillRemindersWidget isCompact={!!widget.isCompact} />;
      
    case 'investmentPerformance':
      return <InvestmentPerformanceWidget isCompact={!!widget.isCompact} />;
      
    case 'cashFlow':
      return <CashFlowWidget isCompact={!!widget.isCompact} />;
      
    case 'recentAlerts':
      return <RecentAlertsWidget isCompact={!!widget.isCompact} />;
      
    case 'netWorthTrend':
      return <NetWorthTrendWidget isCompact={!!widget.isCompact} />;
      
    case 'expenseCategories':
      return <ExpenseCategoriesWidget isCompact={!!widget.isCompact} />;
      
    default:
      return <div className="text-gray-500">Widget content</div>;
  }
});

// Widget type configuration
export const WIDGET_TYPES = {
  netWorth: { title: 'Net Worth', icon: WalletIcon, defaultSize: 'medium', description: 'Track your total net worth' },
  netWorthTrend: { title: 'Net Worth Trend', icon: TrendingUpIcon, defaultSize: 'large', description: 'Historical net worth chart' },
  accounts: { title: 'Accounts Overview', icon: BanknoteIcon, defaultSize: 'large', description: 'View all your accounts' },
  transactions: { title: 'Recent Transactions', icon: CreditCardIcon, defaultSize: 'large', description: 'Latest transactions' },
  budgets: { title: 'Budget Status', icon: PieChartIcon, defaultSize: 'medium', description: 'Budget tracking' },
  savingsGoals: { title: 'Savings Goals', icon: TargetIcon, defaultSize: 'large', description: 'Track savings goals progress' },
  debtTracker: { title: 'Debt Tracker', icon: CreditCardIcon, defaultSize: 'medium', description: 'Monitor debts and loans' },
  billReminders: { title: 'Bill Reminders', icon: CalendarIcon, defaultSize: 'medium', description: 'Upcoming bills and payments' },
  investmentPerformance: { title: 'Investment Performance', icon: TrendingUpIcon, defaultSize: 'large', description: 'Portfolio performance' },
  cashFlow: { title: 'Cash Flow', icon: ArrowRightLeftIcon, defaultSize: 'large', description: 'Income vs expenses' },
  recentAlerts: { title: 'Recent Alerts', icon: AlertCircleIcon, defaultSize: 'medium', description: 'Important notifications' },
  expenseCategories: { title: 'Expense Categories', icon: PieChartIcon, defaultSize: 'medium', description: 'Spending by category' }
};

export type { Widget };
