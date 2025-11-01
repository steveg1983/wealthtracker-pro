import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { notificationService } from '../services/notificationService';
import type { Goal, Budget, Transaction, Category } from '../types';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface BudgetAlert {
  budgetId: string;
  categoryName: string;
  percentage: number;
  spent: number;
  budget: number;
  period: string;
  type: 'warning' | 'danger';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  budgetAlertsEnabled: boolean;
  setBudgetAlertsEnabled: (enabled: boolean) => void;
  alertThreshold: number;
  setAlertThreshold: (threshold: number) => void;
  largeTransactionAlertsEnabled: boolean;
  setLargeTransactionAlertsEnabled: (enabled: boolean) => void;
  largeTransactionThreshold: number;
  setLargeTransactionThreshold: (threshold: number) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  addNotifications: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  checkBudgetAlerts: (budgetAlerts: BudgetAlert[]) => void;
  checkLargeTransaction: (amount: number, description: string) => void;
  checkEnhancedBudgetAlerts: (budgets: Budget[], transactions: Transaction[], categories: Category[]) => void;
  checkEnhancedTransactionAlerts: (transaction: Transaction, allTransactions: Transaction[]) => void;
  checkGoalProgress: (goals: Goal[], previousGoals?: Goal[]) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>((): Notification[] => {
    try {
      const saved = localStorage.getItem('money_management_notifications');
      const parsed = saved ? JSON.parse(saved) : [];
      // Limit to 20 most recent notifications on initialization to prevent excessive notifications
      // Also clear very old notifications (older than 7 days)
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const filtered = Array.isArray(parsed) 
        ? parsed.filter((n: any) => {
            try {
              const timestamp = new Date(n.timestamp).getTime();
              return timestamp > sevenDaysAgo;
            } catch {
              return false;
            }
          })
        : [];
      return filtered.slice(0, 20);
    } catch {
      return [];
    }
  });

  const [budgetAlertsEnabled, setBudgetAlertsEnabled] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_budget_alerts_enabled');
      return saved === 'true';
    } catch {
      return true;
    }
  });

  const [alertThreshold, setAlertThreshold] = useState((): number => {
    try {
      const saved = localStorage.getItem('money_management_alert_threshold');
      return saved ? parseInt(saved, 10) : 80;
    } catch {
      return 80;
    }
  });

  const [largeTransactionAlertsEnabled, setLargeTransactionAlertsEnabled] = useState((): boolean => {
    try {
      const saved = localStorage.getItem('money_management_large_transaction_alerts_enabled');
      return saved === 'true';
    } catch {
      return true;
    }
  });

  const [largeTransactionThreshold, setLargeTransactionThreshold] = useState((): number => {
    try {
      const saved = localStorage.getItem('money_management_large_transaction_threshold');
      return saved ? parseInt(saved, 10) : 500;
    } catch {
      return 500;
    }
  });
  const { formatCurrency } = useCurrencyDecimal();

  const unreadCount = notifications.filter((n): boolean => !n.read).length;

  useEffect((): void => {
    localStorage.setItem('money_management_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect((): void => {
    localStorage.setItem('money_management_budget_alerts_enabled', budgetAlertsEnabled.toString());
  }, [budgetAlertsEnabled]);

  useEffect((): void => {
    localStorage.setItem('money_management_alert_threshold', alertThreshold.toString());
  }, [alertThreshold]);

  useEffect((): void => {
    localStorage.setItem('money_management_large_transaction_alerts_enabled', largeTransactionAlertsEnabled.toString());
  }, [largeTransactionAlertsEnabled]);

  useEffect((): void => {
    localStorage.setItem('money_management_large_transaction_threshold', largeTransactionThreshold.toString());
  }, [largeTransactionThreshold]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void => {
    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}`,
      timestamp: new Date(),
      read: false
    };
    
    setNotifications((prev): Notification[] => {
      // Limit to 50 notifications to prevent spam
      const updated = [newNotification, ...prev];
      return updated.slice(0, 50);
    });
  }, []);

  const addNotifications = useCallback((newNotifications: Notification[]): void => {
    setNotifications((prev): Notification[] => {
      // Limit to 50 notifications to prevent spam
      const updated = [...newNotifications, ...prev];
      return updated.slice(0, 50);
    });
  }, []);

  const markAsRead = useCallback((id: string): void => {
    setNotifications((prev): Notification[] => 
      prev.map((n): Notification => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback((): void => {
    setNotifications((prev): Notification[] => 
      prev.map((n): Notification => ({ ...n, read: true }))
    );
  }, []);

  const removeNotification = useCallback((id: string): void => {
    setNotifications((prev): Notification[] => prev.filter((n): boolean => n.id !== id));
  }, []);

  const clearAll = useCallback((): void => {
    setNotifications([]);
  }, []);

  const checkBudgetAlerts = useCallback((budgetAlerts: BudgetAlert[]): void => {
    if (!budgetAlertsEnabled) return;

    // Check for existing alerts to avoid duplicates
    const existingAlertIds = new Set(
      notifications
        .filter((n): boolean => n.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)) // Within last 24 hours
        .map((n): string | undefined => n.message)
    );

    budgetAlerts.forEach((alert): void => {
      const alertKey = `budget-${alert.budgetId}-${alert.percentage}`;
      
      if (!existingAlertIds.has(alertKey)) {
        const type = alert.type === 'danger' ? 'error' : 'warning';
        const title = alert.type === 'danger' 
          ? `Budget Exceeded: ${alert.categoryName}`
          : `Budget Warning: ${alert.categoryName}`;
        
        const message = alert.type === 'danger'
          ? `You've spent ${alert.percentage}% of your ${alert.period} budget (${formatCurrency(alert.spent)} of ${formatCurrency(alert.budget)})`
          : `You've spent ${alert.percentage}% of your ${alert.period} budget. Consider slowing down spending in this category.`;

        addNotification({
          type,
          title,
          message: alertKey, // Store key in message for duplicate detection
          action: {
            label: 'View Budget',
            onClick: (): void => {
              window.location.href = '/budget';
            }
          }
        });
      }
    });
  }, [budgetAlertsEnabled, notifications, addNotification]);

  const checkLargeTransaction = useCallback((amount: number, description: string): void => {
    if (!largeTransactionAlertsEnabled) return;
    
    if (amount >= largeTransactionThreshold) {
      addNotification({
        type: 'warning',
        title: 'Large Transaction Detected',
        message: `A large transaction of ${formatCurrency(amount)} was added: ${description}`,
        action: {
          label: 'View Transactions',
          onClick: (): void => {
            window.location.href = '/transactions';
          }
        }
      });
    }
  }, [largeTransactionAlertsEnabled, largeTransactionThreshold, addNotification]);

  const checkEnhancedBudgetAlerts = useCallback((budgets: Budget[], transactions: Transaction[], categories: Category[]): void => {
    if (!budgetAlertsEnabled) return;
    
    const newNotifications = notificationService.checkBudgetAlerts(budgets, transactions, categories);
    if (newNotifications.length > 0) {
      addNotifications(newNotifications);
    }
  }, [budgetAlertsEnabled, addNotifications]);

  const checkEnhancedTransactionAlerts = useCallback((transaction: Transaction, allTransactions: Transaction[]): void => {
    if (!largeTransactionAlertsEnabled) return;
    
    const newNotifications = notificationService.checkTransactionAlerts(transaction, allTransactions);
    if (newNotifications.length > 0) {
      addNotifications(newNotifications);
    }
  }, [largeTransactionAlertsEnabled, addNotifications]);

  const checkGoalProgress = useCallback((goals: Goal[], previousGoals?: Goal[]): void => {
    const newNotifications = notificationService.checkGoalProgress(goals, previousGoals);
    if (newNotifications.length > 0) {
      addNotifications(newNotifications);
    }
  }, [addNotifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      budgetAlertsEnabled,
      setBudgetAlertsEnabled,
      alertThreshold,
      setAlertThreshold,
      largeTransactionAlertsEnabled,
      setLargeTransactionAlertsEnabled,
      largeTransactionThreshold,
      setLargeTransactionThreshold,
      addNotification,
      addNotifications,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll,
      checkBudgetAlerts,
      checkLargeTransaction,
      checkEnhancedBudgetAlerts,
      checkEnhancedTransactionAlerts,
      checkGoalProgress
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
