import { useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { logActivity } from './useActivityTracking';

/**
 * Hook that automatically logs activities when app data changes
 */
export function useActivityLogger() {
  const { transactions, accounts, budgets, goals } = useApp();

  // Track transaction changes
  useEffect(() => {
    if (transactions.length === 0) return;

    // Get the most recent transaction
    const sorted = [...transactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latest = sorted[0];

    // Check if this is a new transaction (added in last minute)
    const now = Date.now();
    const transactionTime = new Date(latest.date).getTime();
    if (now - transactionTime < 60000) { // Within last minute
      logActivity({
        type: 'transaction',
        title: 'New Transaction',
        description: latest.description,
        category: latest.category,
        amount: parseFloat(latest.amount),
        actionUrl: '/transactions'
      });
    }
  }, [transactions.length]);

  // Track account balance changes
  useEffect(() => {
    accounts.forEach(account => {
      // Check for significant balance changes
      const prevBalance = localStorage.getItem(`account_balance_${account.id}`);
      const currentBalance = account.balance.toString();
      
      if (prevBalance && prevBalance !== currentBalance) {
        const diff = parseFloat(currentBalance) - parseFloat(prevBalance);
        if (Math.abs(diff) > 0.01) {
          logActivity({
            type: 'account',
            title: `${account.name} Balance Updated`,
            description: `Balance changed by £${Math.abs(diff).toFixed(2)}`,
            amount: diff,
            actionUrl: '/accounts'
          });
        }
      }
      
      localStorage.setItem(`account_balance_${account.id}`, currentBalance);
    });
  }, [accounts]);

  // Track budget updates
  useEffect(() => {
    if (budgets.length === 0) return;

    // Check for budget alerts
    budgets.forEach(budget => {
      const spent = Math.abs(transactions
        .filter(t => t.category === budget.categoryId && parseFloat(t.amount) < 0)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0));
      
      const percentage = (spent / parseFloat(budget.amount)) * 100;
      const alertKey = `budget_alert_${budget.id}_${new Date().getMonth()}`;
      const alreadyAlerted = localStorage.getItem(alertKey);

      if (percentage >= 90 && !alreadyAlerted) {
        logActivity({
          type: 'budget',
          title: 'Budget Alert',
          description: `${budget.categoryId} budget is ${percentage.toFixed(0)}% spent`,
          actionUrl: '/budget'
        });
        localStorage.setItem(alertKey, 'true');
      } else if (percentage >= 75 && percentage < 90 && alreadyAlerted !== '75') {
        logActivity({
          type: 'budget',
          title: 'Budget Warning',
          description: `${budget.categoryId} budget is ${percentage.toFixed(0)}% spent`,
          actionUrl: '/budget'
        });
        localStorage.setItem(alertKey, '75');
      }
    });
  }, [budgets, transactions]);

  // Track goal progress
  useEffect(() => {
    goals.forEach(goal => {
      const percentage = (parseFloat(goal.currentAmount) / parseFloat(goal.targetAmount)) * 100;
      const milestoneKey = `goal_milestone_${goal.id}`;
      const lastMilestone = parseInt(localStorage.getItem(milestoneKey) || '0');
      
      // Check for 25%, 50%, 75%, and 100% milestones
      const milestones = [25, 50, 75, 100];
      for (const milestone of milestones) {
        if (percentage >= milestone && lastMilestone < milestone) {
          logActivity({
            type: 'goal',
            title: milestone === 100 ? 'Goal Achieved!' : 'Goal Milestone',
            description: `${goal.name} is ${milestone}% complete`,
            actionUrl: '/goals'
          });
          localStorage.setItem(milestoneKey, milestone.toString());
          break;
        }
      }
    });
  }, [goals]);

  // Track sync events
  useEffect(() => {
    const handleSyncComplete = (event: CustomEvent) => {
      logActivity({
        type: 'sync',
        title: 'Data Synchronized',
        description: 'Your data has been synced with the cloud',
      });
    };

    const handleSyncError = (event: CustomEvent) => {
      logActivity({
        type: 'system',
        title: 'Sync Error',
        description: 'Failed to sync data. Will retry automatically.',
      });
    };

    window.addEventListener('sync-complete' as any, handleSyncComplete);
    window.addEventListener('sync-error' as any, handleSyncError);

    return () => {
      window.removeEventListener('sync-complete' as any, handleSyncComplete);
      window.removeEventListener('sync-error' as any, handleSyncError);
    };
  }, []);

  // Track system events
  useEffect(() => {
    // Log when app comes online/offline
    const handleOnline = () => {
      logActivity({
        type: 'system',
        title: 'Connection Restored',
        description: 'You are back online',
      });
    };

    const handleOffline = () => {
      logActivity({
        type: 'system',
        title: 'Working Offline',
        description: 'Changes will sync when reconnected',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Log initial load
  useEffect(() => {
    const hasLoggedToday = localStorage.getItem('activity_logged_today');
    const today = new Date().toDateString();
    
    if (hasLoggedToday !== today) {
      logActivity({
        type: 'system',
        title: 'Welcome Back',
        description: 'Your data is up to date',
      });
      localStorage.setItem('activity_logged_today', today);
    }
  }, []);
}