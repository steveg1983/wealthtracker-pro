import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { logActivity } from './useActivityTracking';
import { formatDecimal } from '../utils/decimal-format';
import { toDecimal } from '../utils/decimal';

/**
 * Hook that automatically logs activities when app data changes
 */
export function useActivityLogger() {
  const { transactions, accounts, budgets, goals } = useApp();

  // "New transaction" means a row that APPEARED during this session — never
  // one that merely loaded. The previous check compared the newest row's DATE
  // against the wall clock, but a date says when the money moved, not when
  // the row was created: any transaction dated in the future (a standing
  // order entered ahead of time) made `now - date` negative, which is always
  // "within the last minute", so the same row was announced as new on every
  // refresh, forever. Tracked by id instead: the first population is the
  // baseline and says nothing; only ids not seen before get announced.
  const seenTransactionIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (transactions.length === 0) return;

    if (seenTransactionIds.current === null) {
      seenTransactionIds.current = new Set(transactions.map(t => t.id));
      return;
    }

    for (const t of transactions) {
      if (!seenTransactionIds.current.has(t.id)) {
        seenTransactionIds.current.add(t.id);
        logActivity({
          type: 'transaction',
          title: 'New Transaction',
          description: t.description,
          category: t.category,
          amount: t.amount,
          actionUrl: '/transactions'
        });
      }
    }
  }, [transactions]);

  // Track account balance changes
  useEffect(() => {
    accounts.forEach(account => {
      // Check for significant balance changes
      const prevBalance = localStorage.getItem(`account_balance_${account.id}`);
      const currentBalance = account.balance.toString();
      
      if (prevBalance && prevBalance !== currentBalance) {
        const diff = toDecimal(currentBalance).minus(toDecimal(prevBalance)).toNumber();
        if (Math.abs(diff) > 0.01) {
          logActivity({
            type: 'account',
            title: `${account.name} Balance Updated`,
            description: `Balance changed by £${formatDecimal(Math.abs(diff), 2)}`,
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
        .filter(t => t.category === budget.categoryId && t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0));

      const percentage = (spent / budget.amount) * 100;
      const alertKey = `budget_alert_${budget.id}_${new Date().getMonth()}`;
      const alreadyAlerted = localStorage.getItem(alertKey);

      if (percentage >= 90 && !alreadyAlerted) {
        logActivity({
          type: 'budget',
          title: 'Budget Alert',
          description: `${budget.categoryId} budget is ${formatDecimal(percentage, 0)}% spent`,
          actionUrl: '/budget'
        });
        localStorage.setItem(alertKey, 'true');
      } else if (percentage >= 75 && percentage < 90 && alreadyAlerted !== '75') {
        logActivity({
          type: 'budget',
          title: 'Budget Warning',
          description: `${budget.categoryId} budget is ${formatDecimal(percentage, 0)}% spent`,
          actionUrl: '/budget'
        });
        localStorage.setItem(alertKey, '75');
      }
    });
  }, [budgets, transactions]);

  // Track goal progress
  useEffect(() => {
    goals.forEach(goal => {
      const percentage = (goal.currentAmount / goal.targetAmount) * 100;
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
    const handleSyncComplete = (_event: Event) => {
      logActivity({
        type: 'sync',
        title: 'Data Synchronized',
        description: 'Your data has been synced with the cloud',
      });
    };

    const handleSyncError = (_event: Event) => {
      logActivity({
        type: 'system',
        title: 'Sync Error',
        description: 'Failed to sync data. Will retry automatically.',
      });
    };

    window.addEventListener('sync-complete', handleSyncComplete);
    window.addEventListener('sync-error', handleSyncError);

    return () => {
      window.removeEventListener('sync-complete', handleSyncComplete);
      window.removeEventListener('sync-error', handleSyncError);
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
