/**
 * useRealtimeSync Hook - React integration for Supabase real-time subscriptions
 * 
 * This hook provides:
 * - Automatic subscription management
 * - Redux store integration
 * - Connection state monitoring
 * - Echo prevention for optimistic updates
 * - Cleanup on unmount
 */

import { useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useAppDispatch } from '../store';
import { toast } from 'react-hot-toast';
import realtimeService, { 
  type RealtimeEvent, 
  type ConnectionState,
  type RealtimeCallback 
} from '../services/realtimeService';

// Import Redux actions for real-time updates
import { setTransactions, addTransaction, updateTransaction, deleteTransaction } from '../store/slices/transactionsSlice';
import { setAccounts, addAccount, updateAccount, deleteAccount } from '../store/slices/accountsSlice';
import { setBudgets, addBudget, updateBudget, deleteBudget } from '../store/slices/budgetsSlice';
import { setGoals, addGoal, updateGoal, deleteGoal } from '../store/slices/goalsSlice';

import type { Account, Transaction, Budget, Goal } from '../types';

interface UseRealtimeSyncOptions {
  /**
   * Enable/disable real-time sync
   */
  enabled?: boolean;
  
  /**
   * Show toast notifications for sync events
   */
  showNotifications?: boolean;
  
  /**
   * Prevent echo updates (updates from this client)
   */
  preventEcho?: boolean;
  
  /**
   * Which data types to sync
   */
  syncData?: {
    accounts?: boolean;
    transactions?: boolean;
    budgets?: boolean;
    goals?: boolean;
  };
}

interface UseRealtimeSyncReturn {
  /**
   * Current connection state
   */
  connectionState: ConnectionState;
  
  /**
   * Number of active subscriptions
   */
  subscriptionCount: number;
  
  /**
   * Manually force reconnection
   */
  reconnect: () => void;
  
  /**
   * Check if real-time sync is active
   */
  isActive: boolean;
}

export function useRealtimeSync(options: UseRealtimeSyncOptions = {}): UseRealtimeSyncReturn {
  const {
    enabled = true,
    showNotifications = true,
    preventEcho = true,
    syncData = {
      accounts: true,
      transactions: true,
      budgets: true,
      goals: true,
    },
  } = options;

  const { user, isLoaded } = useUser();
  const dispatch = useAppDispatch();
  
  // Track connection state
  const connectionStateRef = useRef<ConnectionState>(realtimeService.getConnectionState());
  const subscriptionKeysRef = useRef<string[]>([]);
  const lastActionTimestampRef = useRef<number>(0);

  // Set up echo prevention
  const updateLastActionTimestamp = useCallback(() => {
    lastActionTimestampRef.current = Date.now();
  }, []);

  const isEchoUpdate = useCallback((timestamp?: number): boolean => {
    if (!preventEcho || !timestamp) return false;
    
    // Consider an update an echo if it occurred within 2 seconds of our last action
    const timeDiff = Date.now() - lastActionTimestampRef.current;
    return timeDiff < 2000;
  }, [preventEcho]);

  // Show notification for remote updates
  const showUpdateNotification = useCallback((type: string, action: string, description?: string) => {
    if (!showNotifications) return;
    
    const message = description 
      ? `${type} ${action}: ${description}`
      : `${type} ${action}`;
    
    toast.success(message, {
      duration: 3000,
      position: 'bottom-right',
      style: {
        fontSize: '14px',
        maxWidth: '300px',
      },
    });
  }, [showNotifications]);

  // Helper to transform Supabase account data for addAccount action
  const transformAccountForInsert = useCallback((account: Account) => {
    const { id, lastUpdated, ...accountData } = account;
    return accountData;
  }, []);

  // Accounts event handler
  const handleAccountsEvent: RealtimeCallback<Account> = useCallback((event) => {
    if (isEchoUpdate(event.new?.updatedAt ? new Date(event.new.updatedAt).getTime() : undefined)) {
      return;
    }

    switch (event.eventType) {
      case 'INSERT':
        if (event.new) {
          // Transform the account data to match addAccount action expectations
          const accountData = transformAccountForInsert(event.new);
          dispatch(addAccount(accountData));
          showUpdateNotification('Account', 'added', event.new.name);
        }
        break;
      case 'UPDATE':
        if (event.new) {
          dispatch(updateAccount({ id: event.new.id, updates: event.new }));
          showUpdateNotification('Account', 'updated', event.new.name);
        }
        break;
      case 'DELETE':
        if (event.old) {
          dispatch(deleteAccount(event.old.id));
          showUpdateNotification('Account', 'deleted', event.old.name);
        }
        break;
    }
  }, [dispatch, isEchoUpdate, showUpdateNotification, transformAccountForInsert]);

  // Helper to transform Supabase transaction data for addTransaction action
  const transformTransactionForInsert = useCallback((transaction: Transaction) => {
    const { id, ...transactionData } = transaction;
    return transactionData;
  }, []);

  // Transactions event handler
  const handleTransactionsEvent: RealtimeCallback<Transaction> = useCallback((event) => {
    if (isEchoUpdate(event.new?.updatedAt ? new Date(event.new.updatedAt).getTime() : undefined)) {
      return;
    }

    switch (event.eventType) {
      case 'INSERT':
        if (event.new) {
          const transactionData = transformTransactionForInsert(event.new);
          dispatch(addTransaction(transactionData));
          showUpdateNotification('Transaction', 'added', event.new.description);
        }
        break;
      case 'UPDATE':
        if (event.new) {
          dispatch(updateTransaction({ id: event.new.id, updates: event.new }));
          showUpdateNotification('Transaction', 'updated', event.new.description);
        }
        break;
      case 'DELETE':
        if (event.old) {
          dispatch(deleteTransaction(event.old.id));
          showUpdateNotification('Transaction', 'deleted', event.old.description);
        }
        break;
    }
  }, [dispatch, isEchoUpdate, showUpdateNotification, transformTransactionForInsert]);

  // Helper to transform Supabase budget data for addBudget action
  const transformBudgetForInsert = useCallback((budget: Budget) => {
    const { id, createdAt, updatedAt, ...budgetData } = budget;
    return budgetData;
  }, []);

  // Budgets event handler
  const handleBudgetsEvent: RealtimeCallback<Budget> = useCallback((event) => {
    if (isEchoUpdate(event.new?.updatedAt ? new Date(event.new.updatedAt).getTime() : undefined)) {
      return;
    }

    switch (event.eventType) {
      case 'INSERT':
        if (event.new) {
          const budgetData = transformBudgetForInsert(event.new);
          dispatch(addBudget(budgetData));
          showUpdateNotification('Budget', 'added', event.new.name);
        }
        break;
      case 'UPDATE':
        if (event.new) {
          dispatch(updateBudget({ id: event.new.id, updates: event.new }));
          showUpdateNotification('Budget', 'updated', event.new.name);
        }
        break;
      case 'DELETE':
        if (event.old) {
          dispatch(deleteBudget(event.old.id));
          showUpdateNotification('Budget', 'deleted', event.old.name);
        }
        break;
    }
  }, [dispatch, isEchoUpdate, showUpdateNotification, transformBudgetForInsert]);

  // Helper to transform Supabase goal data for addGoal action
  const transformGoalForInsert = useCallback((goal: Goal) => {
    const { id, createdAt, updatedAt, ...goalData } = goal;
    return goalData;
  }, []);

  // Goals event handler
  const handleGoalsEvent: RealtimeCallback<Goal> = useCallback((event) => {
    if (isEchoUpdate(event.new?.updatedAt ? new Date(event.new.updatedAt).getTime() : undefined)) {
      return;
    }

    switch (event.eventType) {
      case 'INSERT':
        if (event.new) {
          const goalData = transformGoalForInsert(event.new);
          dispatch(addGoal(goalData));
          showUpdateNotification('Goal', 'added', event.new.name);
        }
        break;
      case 'UPDATE':
        if (event.new) {
          dispatch(updateGoal({ id: event.new.id, updates: event.new }));
          showUpdateNotification('Goal', 'updated', event.new.name);
        }
        break;
      case 'DELETE':
        if (event.old) {
          dispatch(deleteGoal(event.old.id));
          showUpdateNotification('Goal', 'deleted', event.old.name);
        }
        break;
    }
  }, [dispatch, isEchoUpdate, showUpdateNotification, transformGoalForInsert]);

  // Initialize real-time service
  useEffect(() => {
    realtimeService.initialize();
  }, []);

  // Set up subscriptions when user is authenticated
  useEffect(() => {
    if (!enabled || !isLoaded || !user?.id) {
      return;
    }

    const userId = user.id;
    let mounted = true;

    const setupSubscriptions = async () => {
      const subscriptionKeys: string[] = [];

      // Subscribe to accounts
      if (syncData.accounts && mounted) {
        const accountsKey = await realtimeService.subscribeToAccounts(userId, handleAccountsEvent);
        if (accountsKey) subscriptionKeys.push(accountsKey);
      }

      // Subscribe to transactions
      if (syncData.transactions && mounted) {
        const transactionsKey = await realtimeService.subscribeToTransactions(userId, handleTransactionsEvent);
        if (transactionsKey) subscriptionKeys.push(transactionsKey);
      }

      // Subscribe to budgets
      if (syncData.budgets && mounted) {
        const budgetsKey = await realtimeService.subscribeToBudgets(userId, handleBudgetsEvent);
        if (budgetsKey) subscriptionKeys.push(budgetsKey);
      }

      // Subscribe to goals
      if (syncData.goals && mounted) {
        const goalsKey = await realtimeService.subscribeToGoals(userId, handleGoalsEvent);
        if (goalsKey) subscriptionKeys.push(goalsKey);
      }

      if (mounted) {
        subscriptionKeysRef.current = subscriptionKeys;
      }
    };

    setupSubscriptions();

    // Cleanup on unmount or user change
    return () => {
      mounted = false;
      subscriptionKeysRef.current.forEach(key => {
        realtimeService.unsubscribe(key);
      });
      subscriptionKeysRef.current = [];
    };
  }, [
    enabled,
    isLoaded,
    user?.id,
    syncData.accounts,
    syncData.transactions,
    syncData.budgets,
    syncData.goals,
    handleAccountsEvent,
    handleTransactionsEvent,
    handleBudgetsEvent,
    handleGoalsEvent,
  ]);

  // Monitor connection state
  useEffect(() => {
    const unsubscribe = realtimeService.onConnectionChange((state) => {
      connectionStateRef.current = state;
      
      // Show connection status notifications
      if (showNotifications) {
        if (state.isConnected && state.connectionCount > 1) {
          toast.success('Real-time sync reconnected', {
            duration: 2000,
            position: 'bottom-right',
          });
        } else if (!state.isConnected && !state.isReconnecting) {
          toast.error('Real-time sync disconnected', {
            duration: 2000,
            position: 'bottom-right',
          });
        }
      }
    });

    return unsubscribe;
  }, [showNotifications]);

  // Provide functions to update action timestamp for echo prevention
  useEffect(() => {
    // Expose the timestamp updater globally for Redux actions to use
    (window as any).__updateRealtimeActionTimestamp = updateLastActionTimestamp;
    
    return () => {
      delete (window as any).__updateRealtimeActionTimestamp;
    };
  }, [updateLastActionTimestamp]);

  const reconnect = useCallback(() => {
    realtimeService.forceReconnect();
  }, []);

  return {
    connectionState: connectionStateRef.current,
    subscriptionCount: realtimeService.getSubscriptionCount(),
    reconnect,
    isActive: enabled && isLoaded && !!user?.id && subscriptionKeysRef.current.length > 0,
  };
}

// Helper hook for connection status only
export function useRealtimeConnectionStatus() {
  const connectionStateRef = useRef<ConnectionState>(realtimeService.getConnectionState());

  useEffect(() => {
    const unsubscribe = realtimeService.onConnectionChange((state) => {
      connectionStateRef.current = state;
    });

    return unsubscribe;
  }, []);

  return connectionStateRef.current;
}

export default useRealtimeSync;