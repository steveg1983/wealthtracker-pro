import { memo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircleIcon } from '../../icons';
import type { Widget } from '../../../services/enhancedDashboardService';
import type { Account, Transaction, Budget } from '../../../types';
import { useLogger } from '../services/ServiceProvider';
import {
  DebtTrackerWidget,
  BillRemindersWidget,
  InvestmentPerformanceWidget,
  SavingsGoalsWidget,
  CashFlowWidget,
  RecentAlertsWidget,
  NetWorthTrendWidget,
  ExpenseCategoriesWidget
} from '../widgets';

interface WidgetRendererProps {
  widget: Widget;
  metrics: {
    netWorth: any;
    totalAssets: any;
    totalLiabilities: any;
  };
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  formatCurrency: (amount: number) => string;
}

/**
 * Widget content renderer
 */
export const WidgetRenderer = memo(function WidgetRenderer({ widget,
  metrics,
  accounts,
  transactions,
  budgets,
  formatCurrency
 }: WidgetRendererProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('WidgetRenderer component initialized', {
      componentName: 'WidgetRenderer'
    });
  }, []);

  const navigate = useNavigate();

  switch (widget.type) {
    case 'netWorth':
      return (
        <div className="space-y-4">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(metrics.netWorth.toNumber())}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Assets</div>
              <div className="text-green-600 font-semibold">
                {formatCurrency(metrics.totalAssets.toNumber())}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Liabilities</div>
              <div className="text-red-600 font-semibold">
                {formatCurrency(metrics.totalLiabilities.toNumber())}
              </div>
            </div>
          </div>
        </div>
      );
    
    case 'accounts':
      return (
        <div className="space-y-3">
          {accounts.slice(0, widget.isCompact ? 3 : 5).map(account => (
            <div key={account.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{account.name}</div>
                <div className="text-xs text-gray-500">{account.type}</div>
              </div>
              <div className={`font-semibold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(account.balance)}
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
    
    case 'transactions': {
      const recentTransactions = transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, widget.isCompact ? 3 : 5);
      
      return (
        <div className="space-y-3">
          {recentTransactions.map(transaction => (
            <div key={transaction.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{transaction.description}</div>
                <div className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString()}</div>
              </div>
              <div className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
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
      const activeBudgets = budgets.filter(b => b.isActive);
      const overBudget = activeBudgets.filter(b => (b.spent || 0) > b.amount);
      
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
      return <SavingsGoalsWidget isCompact={widget.isCompact} />;
    
    case 'debtTracker':
      return <DebtTrackerWidget isCompact={widget.isCompact} />;
    
    case 'billReminders':
      return <BillRemindersWidget isCompact={widget.isCompact} />;
    
    case 'investmentPerformance':
      return <InvestmentPerformanceWidget isCompact={widget.isCompact} />;
    
    case 'cashFlow':
      return <CashFlowWidget isCompact={widget.isCompact} />;
    
    case 'recentAlerts':
      return <RecentAlertsWidget isCompact={widget.isCompact} />;
    
    case 'netWorthTrend':
      return <NetWorthTrendWidget isCompact={widget.isCompact} />;
    
    case 'expenseCategories':
      return <ExpenseCategoriesWidget isCompact={widget.isCompact} />;
    
    default:
      return <div className="text-gray-500">Widget content</div>;
  }
});