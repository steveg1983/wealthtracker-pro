import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useBudgets } from '../contexts/BudgetContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { calculateBudgetSpending, calculateBudgetPercentage } from '../utils/calculations-decimal';
import type { DecimalInstance, DecimalBudget } from '../types/decimal-types';
import {
  BellIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  SettingsIcon,
  TrendingUpIcon,
  InfoIcon,
  XIcon,
  FilterIcon,
  VolumeIcon,
  BellOffIcon
} from './icons';

interface AlertConfig {
  id: string;
  name: string;
  enabled: boolean;
  thresholds: {
    warning: number; // Percentage
    critical: number; // Percentage
  };
  notificationTypes: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  frequency: 'realtime' | 'daily' | 'weekly';
  categories: string[]; // Empty means all categories
  sound: boolean;
  vibrate: boolean;
}

interface Alert {
  id: string;
  configId: string;
  budgetId: string;
  category: string;
  type: 'warning' | 'critical';
  percentage: number;
  spent: DecimalInstance;
  budget: DecimalInstance;
  remaining: DecimalInstance;
  message: string;
  timestamp: Date;
  isRead: boolean;
  isDismissed: boolean;
}

interface AlertStats {
  totalAlerts: number;
  unreadAlerts: number;
  warningAlerts: number;
  criticalAlerts: number;
  mostAlertedCategory: string;
  averageSpendingPercentage: number;
}

const DEFAULT_ALERT_CONFIGS: AlertConfig[] = [
  {
    id: '1',
    name: 'Budget Warning',
    enabled: true,
    thresholds: { warning: 75, critical: 90 },
    notificationTypes: { inApp: true, email: false, push: false },
    frequency: 'realtime',
    categories: [],
    sound: false,
    vibrate: false
  },
  {
    id: '2',
    name: 'Overspending Alert',
    enabled: true,
    thresholds: { warning: 90, critical: 100 },
    notificationTypes: { inApp: true, email: true, push: true },
    frequency: 'realtime',
    categories: [],
    sound: true,
    vibrate: true
  },
  {
    id: '3',
    name: 'Weekly Summary',
    enabled: false,
    thresholds: { warning: 50, critical: 80 },
    notificationTypes: { inApp: true, email: true, push: false },
    frequency: 'weekly',
    categories: [],
    sound: false,
    vibrate: false
  }
];

export default function SpendingAlerts() {
  const { categories, getDecimalTransactions, getDecimalBudgets } = useApp();
  const { budgets } = useBudgets();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [alertConfigs, setAlertConfigs] = useLocalStorage<AlertConfig[]>('alert-configs', DEFAULT_ALERT_CONFIGS);
  const [alerts, setAlerts] = useLocalStorage<Alert[]>('spending-alerts', []);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<AlertConfig | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'warning' | 'critical'>('all');
  const [mutedCategories, setMutedCategories] = useState<string[]>([]);

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
        if (mutedCategories.includes(budget.category)) return;
        
        const decimalBudget = decimalBudgets.find((db: DecimalBudget) => db.id === budget.id);
        if (!decimalBudget || !budget.isActive) return;
        
        const spent = calculateBudgetSpending(decimalBudget, decimalTransactions, startDate, endDate);
        const percentage = calculateBudgetPercentage(decimalBudget, spent);
        const remaining = decimalBudget.amount.minus(spent);
        
        alertConfigs.forEach(config => {
          if (!config.enabled) return;
          if (config.categories.length > 0 && !config.categories.includes(budget.category)) return;
          
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
            message = `Critical: ${budget.category} has reached ${percentage.toFixed(0)}% of budget!`;
          } else if (percentage >= config.thresholds.warning) {
            alertType = 'warning';
            message = `Warning: ${budget.category} is at ${percentage.toFixed(0)}% of budget`;
          }
          
          if (alertType && !existingAlert) {
            const newAlert: Alert = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              configId: config.id,
              budgetId: budget.id,
              category: budget.category,
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
            
            // Play sound if enabled
            if (config.sound && 'Audio' in window) {
              try {
                const audio = new Audio('/notification.mp3');
                audio.play().catch(() => {});
              } catch (e) {
                // Ignore audio play errors - notification sound is optional
              }
            }
            
            // Vibrate if enabled
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
  }, [budgets, alertConfigs, mutedCategories]);

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

  const markAsRead = (alertId: string) => {
    setAlerts(alerts.map(a => 
      a.id === alertId ? { ...a, isRead: true } : a
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(alerts.map(a => 
      a.id === alertId ? { ...a, isDismissed: true } : a
    ));
  };

  const markAllAsRead = () => {
    setAlerts(alerts.map(a => ({ ...a, isRead: true })));
  };

  const toggleMuteCategory = (category: string) => {
    if (mutedCategories.includes(category)) {
      setMutedCategories(mutedCategories.filter(c => c !== category));
    } else {
      setMutedCategories([...mutedCategories, category]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Spending Alerts</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time notifications when approaching budget limits
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <SettingsIcon size={16} />
              Configure
            </button>
            {alertStats.unreadAlerts > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700"
              >
                <CheckCircleIcon size={16} />
                Mark All Read
              </button>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <BellIcon size={16} className="text-gray-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Total Alerts</span>
            </div>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {alertStats.totalAlerts}
            </p>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <InfoIcon size={16} className="text-blue-500" />
              <span className="text-xs text-blue-700 dark:text-blue-300">Unread</span>
            </div>
            <p className="text-xl font-semibold text-blue-900 dark:text-blue-100">
              {alertStats.unreadAlerts}
            </p>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircleIcon size={16} className="text-yellow-500" />
              <span className="text-xs text-yellow-700 dark:text-yellow-300">Warnings</span>
            </div>
            <p className="text-xl font-semibold text-yellow-900 dark:text-yellow-100">
              {alertStats.warningAlerts}
            </p>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircleIcon size={16} className="text-red-500" />
              <span className="text-xs text-red-700 dark:text-red-300">Critical</span>
            </div>
            <p className="text-xl font-semibold text-red-900 dark:text-red-100">
              {alertStats.criticalAlerts}
            </p>
          </div>
        </div>

        {/* Most Alerted Category */}
        {alertStats.totalAlerts > 0 && (
          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Most alerts in <strong>{alertStats.mostAlertedCategory}</strong> • 
              Average spending: <strong>{alertStats.averageSpendingPercentage.toFixed(0)}%</strong>
            </p>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FilterIcon size={16} className="text-gray-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Filter:</span>
        </div>
        <div className="flex gap-2">
          {(['all', 'unread', 'warning', 'critical'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === f
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-lg shadow border border-white/20 dark:border-gray-700/50 p-4 transition-all ${
              !alert.isRead ? 'border-l-4 border-l-blue-500' : ''
            }`}
            onClick={() => markAsRead(alert.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`mt-1 ${
                  alert.type === 'critical' ? 'text-red-500' : 'text-yellow-500'
                }`}>
                  <AlertCircleIcon size={20} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium text-gray-900 dark:text-white ${
                    !alert.isRead ? 'font-semibold' : ''
                  }`}>
                    {alert.message}
                  </h4>
                  <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <p>
                      Spent: {formatCurrency(alert.spent)} of {formatCurrency(alert.budget)} 
                      ({alert.percentage.toFixed(0)}%)
                    </p>
                    <p>
                      Remaining: <span className={alert.remaining.greaterThan(0) ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(alert.remaining)}
                      </span>
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissAlert(alert.id);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XIcon size={16} />
              </button>
            </div>
          </div>
        ))}
        
        {filteredAlerts.length === 0 && (
          <div className="text-center py-12 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
            <BellIcon className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No alerts to show
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'all' 
                ? "You're staying within your budgets! Great job!"
                : `No ${filter} alerts found`}
            </p>
          </div>
        )}
      </div>

      {/* Muted Categories */}
      {mutedCategories.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BellOffIcon size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Muted Categories
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {mutedCategories.map(category => (
              <span
                key={category}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full text-xs"
              >
                {category}
                <button
                  onClick={() => toggleMuteCategory(category)}
                  className="hover:text-red-500"
                >
                  <XIcon size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Alert Configuration
            </h3>
            
            <div className="space-y-4">
              {alertConfigs.map((config) => (
                <div
                  key={config.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">{config.name}</h4>
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => {
                        setAlertConfigs(alertConfigs.map(c => 
                          c.id === config.id ? { ...c, enabled: e.target.checked } : c
                        ));
                      }}
                      className="rounded"
                    />
                  </div>
                  
                  {config.enabled && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Warning Threshold (%)
                          </label>
                          <input
                            type="number"
                            value={config.thresholds.warning}
                            onChange={(e) => {
                              setAlertConfigs(alertConfigs.map(c => 
                                c.id === config.id 
                                  ? { ...c, thresholds: { ...c.thresholds, warning: parseInt(e.target.value) || 0 }}
                                  : c
                              ));
                            }}
                            min="0"
                            max="100"
                            className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Critical Threshold (%)
                          </label>
                          <input
                            type="number"
                            value={config.thresholds.critical}
                            onChange={(e) => {
                              setAlertConfigs(alertConfigs.map(c => 
                                c.id === config.id 
                                  ? { ...c, thresholds: { ...c.thresholds, critical: parseInt(e.target.value) || 0 }}
                                  : c
                              ));
                            }}
                            min="0"
                            max="100"
                            className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={config.notificationTypes.inApp}
                            onChange={(e) => {
                              setAlertConfigs(alertConfigs.map(c => 
                                c.id === config.id 
                                  ? { ...c, notificationTypes: { ...c.notificationTypes, inApp: e.target.checked }}
                                  : c
                              ));
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={config.sound}
                            onChange={(e) => {
                              setAlertConfigs(alertConfigs.map(c => 
                                c.id === config.id ? { ...c, sound: e.target.checked } : c
                              ));
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Sound</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={config.vibrate}
                            onChange={(e) => {
                              setAlertConfigs(alertConfigs.map(c => 
                                c.id === config.id ? { ...c, vibrate: e.target.checked } : c
                              ));
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Vibrate</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Mute Categories</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {categories.map(category => (
                  <label key={category.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mutedCategories.includes(category.name)}
                      onChange={() => toggleMuteCategory(category.name)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{category.name}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}