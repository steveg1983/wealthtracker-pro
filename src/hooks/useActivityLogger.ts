import { useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { logActivity } from './useActivityTracking';
import { formatCurrency } from '../utils/currency-decimal';
import { toDecimal } from '../utils/decimal';
import { buildTransactionRegisterPath } from '../utils/transactionDeepLink';

/**
 * Hook that automatically logs activities when app data changes
 *
 * WHERE A NOTIFICATION GOES is decided here, when it is raised, and travels as
 * the `actionUrl` the bell already stores and navigates to. That URL IS the
 * payload: a register deep link names the account and the transaction inside
 * itself (`/accounts/<id>?txn=<id>`, see utils/transactionDeepLink), so nothing
 * new has to be added to a record that is serialised into localStorage and read
 * back by builds that have not shipped yet.
 *
 * That is also what makes the change forward-compatible for free: a
 * notification stored by an older build carries the old `/accounts` or
 * `/transactions` and still lands somewhere sensible — the latter is now a
 * redirect (components/legacyTransactionsDestination) rather than a page —
 * while new ones land on their subject. There is no field to be missing and
 * nothing to migrate.
 */
export function useActivityLogger() {
  const { transactions, accounts, goals } = useApp();

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
          // Onto the row itself, in its own account's register, selected and
          // centred by the register's own deep-link machinery. "A new
          // transaction arrived" used to open the whole transactions list with
          // nothing pointed at, which on fifty thousand rows is not an answer.
          // A row with no account is the only thing that cannot be pointed at,
          // and falls back to the list of accounts rather than to a broken URL
          // (the global transactions list it used to name is retired).
          actionUrl: t.accountId
            ? buildTransactionRegisterPath(t.accountId, t.id, '')
            : '/accounts'
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
            description: `Balance changed by ${formatCurrency(Math.abs(diff))}`,
            amount: diff,
            // THIS account's register, not the list of all of them. The alert
            // names one account and states a movement; the next question is
            // always "which transaction did that?", and the answer is in the
            // register it now opens.
            actionUrl: `/accounts/${account.id}`
          });
        }
      }
      
      localStorage.setItem(`account_balance_${account.id}`, currentBalance);
    });
  }, [accounts]);

  // Budget alerts are NOT raised here. They belong to NotificationContext,
  // which honours the user's own Budget Alerts toggle and their chosen
  // threshold, and which measures spending the same way the Budget page draws
  // its cards. The version that used to live here ignored both settings
  // (hard-coded 90%/75%), summed only whole negative transactions in the
  // matching category — no split lines, no refunds netted, no budget period —
  // and titled the alert with the raw category id. Seen side by side it
  // reported "cat-transportation budget is 917% spent" for a budget the
  // Budget page correctly showed at 140%. Being the only budget alert the user
  // could actually see is what hid the fact that the real one rendered
  // nowhere.

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
