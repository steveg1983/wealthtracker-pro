import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { calculateBudgetSpending, calculateBudgetPercentage } from '../../utils/calculations-decimal';
import { DEFAULT_ALERT_CONFIGS } from './alertConfigs';
import type { Alert, AlertConfig, AlertStats } from './types';
import type { DecimalBudget } from '../../types/decimal-types';

export function useSpendingAlerts() {
  const { categories, getDecimalTransactions, getDecimalBudgets, budgets } = useApp();
  
  const [alertConfigs, setAlertConfigs] = useLocalStorage<AlertConfig[]>(
    'alert-configs', 
    DEFAULT_ALERT_CONFIGS
  );
  const [alerts, setAlerts] = useLocalStorage<Alert[]>('spending-alerts', []);
  const [filter, setFilter] = useState<'all' | 'unread' | 'warning' | 'critical'>('all');
  const [mutedCategories, setMutedCategories] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Check for new alerts
  useEffect(() => {
    const checkAlerts = () => {
      const decimalBudgets = getDecimalBudgets();
      const decimalTransactions = getDecimalTransactions();
      const newAlerts: Alert[] = [];
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0);
      
      budgets.forEach(budget => {
        const categoryId = (budget as any).categoryId || budget.category;
        if (mutedCategories.includes(categoryId)) return;
        
        const decimalBudget = decimalBudgets.find((db: DecimalBudget) => db.id === budget.id);
        if (!decimalBudget || !budget.isActive) return;
        
        const spent = calculateBudgetSpending(decimalBudget, decimalTransactions, startDate, endDate);
        const percentage = calculateBudgetPercentage(decimalBudget, spent);
        const remaining = decimalBudget.amount.minus(spent);
        
        alertConfigs.forEach(config => {
          if (!config.enabled) return;
          if (config.categories.length > 0 && !config.categories.includes(categoryId)) return;
          
          // Check if we already have this alert
          const existingAlert = alerts.find(a => 
            a.budgetId === budget.id && 
            a.configId === config.id &&
            a.timestamp.getMonth() === currentMonth &&
            a.timestamp.getFullYear() === currentYear
          );
          
          if (existingAlert && existingAlert.isDismissed) return;
          
          let alertType: 'warning' | 'critical' | null = null;
          let message = '';
          
          if (percentage >= config.thresholds.critical) {
            alertType = 'critical';
            message = `Critical: ${categories.find(c => c.id === categoryId)?.name || categoryId} has reached ${percentage.toFixed(0)}% of budget!`;
          } else if (percentage >= config.thresholds.warning) {
            alertType = 'warning';
            message = `Warning: ${categories.find(c => c.id === categoryId)?.name || categoryId} is at ${percentage.toFixed(0)}% of budget`;
          }
          
          if (alertType && !existingAlert) {
            const newAlert: Alert = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              configId: config.id,
              budgetId: budget.id,
              category: categoryId,
              type: alertType,
              percentage,
              spent,
              budget: decimalBudget.amount,
              remaining,
              message,
              timestamp: now,
              isRead: false,
              isDismissed: false
            };
            
            newAlerts.push(newAlert);
            
            // Trigger notification effects
            if (config.sound && 'Audio' in window) {
              try {
                const audio = new Audio('/notification.mp3');
                audio.play().catch(() => {});
              } catch (e) {
                // Ignore audio errors
              }
            }
            
            if (config.vibrate && 'vibrate' in navigator) {
              navigator.vibrate(200);
            }
          }
        });
      });
      
      if (newAlerts.length > 0) {
        setAlerts([...newAlerts, ...alerts]);
      }
    };
    
    checkAlerts();
    const interval = setInterval(checkAlerts, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [budgets, alertConfigs, mutedCategories, alerts, getDecimalBudgets, getDecimalTransactions]);

  // Calculate alert statistics
  const alertStats = useMemo((): AlertStats => {
    const activeAlerts = alerts.filter(a => !a.isDismissed);
    const categoryCount: Record<string, number> = {};
    
    activeAlerts.forEach(alert => {
      categoryCount[alert.category] = (categoryCount[alert.category] || 0) + 1;
    });
    
    const mostAlertedCategory = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'None';
    
    const avgPercentage = activeAlerts.length > 0
      ? activeAlerts.reduce((sum, a) => sum + a.percentage, 0) / activeAlerts.length
      : 0;
    
    return {
      totalAlerts: activeAlerts.length,
      unreadAlerts: activeAlerts.filter(a => !a.isRead).length,
      warningAlerts: activeAlerts.filter(a => a.type === 'warning').length,
      criticalAlerts: activeAlerts.filter(a => a.type === 'critical').length,
      mostAlertedCategory,
      averageSpendingPercentage: avgPercentage
    };
  }, [alerts]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    let filtered = alerts.filter(a => !a.isDismissed);
    
    switch (filter) {
      case 'unread':
        filtered = filtered.filter(a => !a.isRead);
        break;
      case 'warning':
        filtered = filtered.filter(a => a.type === 'warning');
        break;
      case 'critical':
        filtered = filtered.filter(a => a.type === 'critical');
        break;
    }
    
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [alerts, filter]);

  const markAsRead = useCallback((alertId: string) => {
    setAlerts(alerts => alerts.map(a => 
      a.id === alertId ? { ...a, isRead: true } : a
    ));
  }, [setAlerts]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(alerts => alerts.map(a => 
      a.id === alertId ? { ...a, isDismissed: true } : a
    ));
  }, [setAlerts]);

  const markAllAsRead = useCallback(() => {
    setAlerts(alerts => alerts.map(a => ({ ...a, isRead: true })));
  }, [setAlerts]);

  const toggleMuteCategory = useCallback((category: string) => {
    setMutedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }, []);

  const updateAlertConfig = useCallback((configId: string, updates: Partial<AlertConfig>) => {
    setAlertConfigs(configs => configs.map(c => 
      c.id === configId ? { ...c, ...updates } : c
    ));
  }, [setAlertConfigs]);

  return {
    // State
    alerts,
    alertConfigs,
    filteredAlerts,
    alertStats,
    filter,
    mutedCategories,
    showSettings,
    categories,
    
    // Actions
    setFilter,
    setShowSettings,
    markAsRead,
    dismissAlert,
    markAllAsRead,
    toggleMuteCategory,
    updateAlertConfig,
    setAlertConfigs
  };
}
