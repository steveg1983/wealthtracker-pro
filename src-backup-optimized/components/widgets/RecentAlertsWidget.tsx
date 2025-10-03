import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { IconProps } from '../icons';
import { 
  AlertCircleIcon, 
  AlertTriangleIcon, 
  InfoIcon,
  TrendingUpIcon,
  CreditCardIcon,
  TargetIcon,
  BellIcon
} from '../icons';
import { formatDistanceToNow } from 'date-fns';

interface RecentAlertsWidgetProps {
  isCompact?: boolean;
}

interface Alert {
  id: string;
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  actionUrl?: string;
  actionLabel?: string;
  icon?: React.ComponentType<IconProps>;
}

export default function RecentAlertsWidget({ isCompact = false }: RecentAlertsWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, goals } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const alerts = useMemo(() => {
    const alertsList: Alert[] = [];
    const today = new Date();

    // Check budget overruns
    budgets.forEach(budget => {
      if (budget.isActive && budget.spent > budget.amount) {
        const overAmount = budget.spent - budget.amount;
        const overPercent = ((overAmount / budget.amount) * 100).toFixed(0);
        
        alertsList.push({
          id: `budget-over-${budget.id}`,
          type: 'warning',
          title: 'Budget Exceeded',
          message: `${budget.categoryId} is ${overPercent}% over budget (${formatCurrency(overAmount)} over)`,
          timestamp: new Date(),
          actionUrl: '/budget',
          actionLabel: 'View Budget',
          icon: AlertTriangleIcon
        });
      } else if (budget.isActive && budget.spent > budget.amount * 0.9) {
        alertsList.push({
          id: `budget-warning-${budget.id}`,
          type: 'info',
          title: 'Budget Warning',
          message: `${budget.categoryId} is at ${((budget.spent / budget.amount) * 100).toFixed(0)}% of budget`,
          timestamp: new Date(),
          actionUrl: '/budget',
          actionLabel: 'View Budget',
          icon: AlertCircleIcon
        });
      }
    });

    // Check low account balances
    accounts.forEach(account => {
      if (account.type === 'checking' && account.balance < 100 && account.balance > 0) {
        alertsList.push({
          id: `low-balance-${account.id}`,
          type: 'warning',
          title: 'Low Balance',
          message: `${account.name} balance is low (${formatCurrency(account.balance)})`,
          timestamp: new Date(),
          actionUrl: '/accounts',
          actionLabel: 'View Account',
          icon: AlertTriangleIcon
        });
      }
    });

    // Check high credit utilization
    accounts
      .filter(acc => acc.type === 'credit')
      .forEach(account => {
        const limit = account.metadata?.creditLimit || 0;
        const balance = Math.abs(account.balance);
        const utilization = limit > 0 ? (balance / limit) * 100 : 0;
        
        if (utilization > 90) {
          alertsList.push({
            id: `high-util-${account.id}`,
            type: 'error',
            title: 'High Credit Utilization',
            message: `${account.name} is at ${utilization.toFixed(0)}% utilization`,
            timestamp: new Date(),
            actionUrl: '/accounts',
            actionLabel: 'View Account',
            icon: CreditCardIcon
          });
        }
      });

    // Check goal milestones
    goals.forEach(goal => {
      const progress = (goal.currentAmount / goal.targetAmount) * 100;
      
      if (progress >= 100 && !goal.completedAt) {
        alertsList.push({
          id: `goal-complete-${goal.id}`,
          type: 'success',
          title: 'Goal Achieved!',
          message: `Congratulations! You've reached your "${goal.name}" goal`,
          timestamp: new Date(),
          actionUrl: '/goals',
          actionLabel: 'View Goal',
          icon: TargetIcon
        });
      } else if (progress >= 75 && progress < 100) {
        alertsList.push({
          id: `goal-near-${goal.id}`,
          type: 'success',
          title: 'Goal Nearly Complete',
          message: `"${goal.name}" is ${progress.toFixed(0)}% complete`,
          timestamp: new Date(),
          actionUrl: '/goals',
          actionLabel: 'View Goal',
          icon: TargetIcon
        });
      }
    });

    // Check for unusual spending
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const recentTransactions = transactions.filter(t => 
      new Date(t.date) >= lastWeek && t.type === 'expense'
    );
    
    const weeklySpending = recentTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgTransaction = weeklySpending / Math.max(recentTransactions.length, 1);
    
    recentTransactions.forEach(transaction => {
      if (Math.abs(transaction.amount) > avgTransaction * 3) {
        alertsList.push({
          id: `unusual-spending-${transaction.id}`,
          type: 'info',
          title: 'Unusual Transaction',
          message: `Large expense: ${transaction.description} (${formatCurrency(Math.abs(transaction.amount))})`,
          timestamp: new Date(transaction.date),
          actionUrl: '/transactions',
          actionLabel: 'View Transaction',
          icon: InfoIcon
        });
      }
    });

    // Add positive reinforcement alerts
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthTransactions = transactions.filter(t => new Date(t.date) >= monthStart);
    const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const monthExpenses = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    if (monthIncome > monthExpenses && monthExpenses > 0) {
      const savingsRate = ((monthIncome - monthExpenses) / monthIncome * 100).toFixed(0);
      if (parseInt(savingsRate) > 20) {
        alertsList.push({
          id: 'high-savings',
          type: 'success',
          title: 'Great Savings Rate!',
          message: `You're saving ${savingsRate}% of your income this month`,
          timestamp: new Date(),
          icon: TrendingUpIcon
        });
      }
    }

    // Sort by timestamp (most recent first)
    return alertsList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [accounts, transactions, budgets, goals, formatCurrency]);

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <BellIcon size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500 dark:text-gray-400">No alerts</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          You're all caught up!
        </p>
      </div>
    );
  }

  const getAlertStyle = (type: Alert['type']) => {
    switch (type) {
      case 'error':
        return 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20';
      case 'warning':
        return 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20';
      case 'success':
        return 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20';
      case 'info':
      default:
        return 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-gray-900/20';
    }
  };

  const getAlertIconColor = (type: Alert['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-amber-600';
      case 'success':
        return 'text-green-600';
      case 'info':
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-3">
      {/* Alert Summary */}
      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {alerts.length} {alerts.length === 1 ? 'Alert' : 'Alerts'}
        </span>
        <div className="flex gap-2">
          {alerts.filter(a => a.type === 'error').length > 0 && (
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
          {alerts.filter(a => a.type === 'warning').length > 0 && (
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          )}
          {alerts.filter(a => a.type === 'success').length > 0 && (
            <span className="w-2 h-2 bg-green-500 rounded-full" />
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-2">
        {alerts.slice(0, isCompact ? 3 : 5).map(alert => {
          const Icon = alert.icon || AlertCircleIcon;
          
          return (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${getAlertStyle(alert.type)} transition-all hover:shadow-sm cursor-pointer`}
              onClick={() => alert.actionUrl && navigate(alert.actionUrl)}
            >
              <div className="flex items-start gap-2">
                <Icon size={16} className={`${getAlertIconColor(alert.type)} mt-0.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {alert.title}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {alert.message}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                    </span>
                    {alert.actionLabel && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-600 dark:text-gray-500 hover:underline">
                          {alert.actionLabel}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View All Button */}
      {alerts.length > (isCompact ? 3 : 5) && (
        <button
          onClick={() => navigate('/notifications')}
          className="w-full text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 text-center py-2"
        >
          View All Alerts ({alerts.length}) →
        </button>
      )}
    </div>
  );
}
