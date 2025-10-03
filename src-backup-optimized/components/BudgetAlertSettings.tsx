/**
 * BudgetAlertSettings Component - Configure budget alerts and notifications
 *
 * Features:
 * - Budget threshold alerts
 * - Spending limit notifications
 * - Alert delivery preferences
 * - Custom alert rules
 * - Alert frequency settings
 */

import React, { useState, useEffect } from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

interface BudgetAlert {
  id: string;
  name: string;
  budgetCategory?: string;
  alertType: 'threshold' | 'overspend' | 'trend' | 'recurring';
  threshold: number; // Percentage for threshold alerts, absolute amount for overspend
  frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
  deliveryMethods: ('email' | 'push' | 'in_app')[];
  enabled: boolean;
  conditions?: {
    timeframe?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    categories?: string[];
    accounts?: string[];
  };
  lastTriggered?: Date;
  triggerCount: number;
}

interface BudgetAlertSettingsProps {
  userId?: string;
  onSettingsChange?: (alerts: BudgetAlert[]) => void;
  className?: string;
}

// Mock alert data
const mockAlerts: BudgetAlert[] = [
  {
    id: 'alert-1',
    name: 'Grocery Budget Warning',
    budgetCategory: 'groceries',
    alertType: 'threshold',
    threshold: 80, // 80% of budget
    frequency: 'immediate',
    deliveryMethods: ['push', 'in_app'],
    enabled: true,
    conditions: {
      timeframe: 'monthly',
      categories: ['groceries']
    },
    lastTriggered: new Date('2024-01-18'),
    triggerCount: 3
  },
  {
    id: 'alert-2',
    name: 'Entertainment Overspend',
    budgetCategory: 'entertainment',
    alertType: 'overspend',
    threshold: 0, // Any overspend
    frequency: 'immediate',
    deliveryMethods: ['email', 'push'],
    enabled: true,
    conditions: {
      timeframe: 'monthly',
      categories: ['entertainment']
    },
    triggerCount: 1
  },
  {
    id: 'alert-3',
    name: 'Weekly Spending Summary',
    alertType: 'recurring',
    threshold: 0,
    frequency: 'weekly',
    deliveryMethods: ['email'],
    enabled: true,
    conditions: {
      timeframe: 'weekly'
    },
    triggerCount: 12
  }
];

const alertTypes = [
  { value: 'threshold', label: 'Budget Threshold', description: 'Alert when spending reaches a percentage of budget' },
  { value: 'overspend', label: 'Budget Overspend', description: 'Alert when spending exceeds budget' },
  { value: 'trend', label: 'Spending Trend', description: 'Alert for unusual spending patterns' },
  { value: 'recurring', label: 'Recurring Summary', description: 'Regular spending summaries' }
];

const frequencies = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'daily', label: 'Daily Digest' },
  { value: 'weekly', label: 'Weekly Summary' },
  { value: 'monthly', label: 'Monthly Report' }
];

const deliveryOptions = [
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'push', label: 'Push Notification', icon: '📱' },
  { value: 'in_app', label: 'In-App Alert', icon: '🔔' }
];

export default function BudgetAlertSettings({
  userId,
  onSettingsChange,
  className = ''
}: BudgetAlertSettingsProps): React.JSX.Element {
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [editingAlert, setEditingAlert] = useState<BudgetAlert | null>(null);
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load alerts
  useEffect(() => {
    const loadAlerts = async () => {
      setIsLoading(true);
      try {
        logger.debug('Loading budget alerts for user:', userId);

        // In a real implementation, this would fetch from API
        await new Promise(resolve => setTimeout(resolve, 300));

        setAlerts(mockAlerts);
        onSettingsChange?.(mockAlerts);
        logger.debug('Budget alerts loaded successfully');
      } catch (error) {
        logger.error('Error loading budget alerts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAlerts();
  }, [userId, onSettingsChange]);

  const createNewAlert = (): BudgetAlert => ({
    id: `alert-${Date.now()}`,
    name: '',
    alertType: 'threshold',
    threshold: 80,
    frequency: 'immediate',
    deliveryMethods: ['in_app'],
    enabled: true,
    conditions: {
      timeframe: 'monthly'
    },
    triggerCount: 0
  });

  const handleCreateAlert = () => {
    const newAlert = createNewAlert();
    setEditingAlert(newAlert);
    setIsCreatingAlert(true);
  };

  const handleSaveAlert = () => {
    if (!editingAlert || !editingAlert.name.trim()) return;

    const updatedAlerts = isCreatingAlert
      ? [...alerts, editingAlert]
      : alerts.map(alert => alert.id === editingAlert.id ? editingAlert : alert);

    setAlerts(updatedAlerts);
    onSettingsChange?.(updatedAlerts);
    setEditingAlert(null);
    setIsCreatingAlert(false);

    logger.debug(isCreatingAlert ? 'Alert created' : 'Alert updated', editingAlert);
  };

  const handleDeleteAlert = (alertId: string) => {
    const updatedAlerts = alerts.filter(alert => alert.id !== alertId);
    setAlerts(updatedAlerts);
    onSettingsChange?.(updatedAlerts);
    logger.debug('Alert deleted', alertId);
  };

  const handleToggleAlert = (alertId: string) => {
    const updatedAlerts = alerts.map(alert =>
      alert.id === alertId ? { ...alert, enabled: !alert.enabled } : alert
    );
    setAlerts(updatedAlerts);
    onSettingsChange?.(updatedAlerts);
  };

  const handleDeliveryMethodToggle = (method: 'email' | 'push' | 'in_app') => {
    if (!editingAlert) return;

    const currentMethods = editingAlert.deliveryMethods;
    const updatedMethods = currentMethods.includes(method)
      ? currentMethods.filter(m => m !== method)
      : [...currentMethods, method];

    setEditingAlert({
      ...editingAlert,
      deliveryMethods: updatedMethods
    });
  };

  const getAlertTypeDescription = (type: BudgetAlert['alertType']): string => {
    return alertTypes.find(t => t.value === type)?.description || '';
  };

  const formatLastTriggered = (date?: Date): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Budget Alert Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure notifications for budget tracking and spending limits
          </p>
        </div>
        <button
          onClick={handleCreateAlert}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
        >
          Create Alert
        </button>
      </div>

      {/* Global Settings */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Global Notification Preferences
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Notifications
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Receive budget alerts via email
              </p>
            </div>
            <button className="w-10 h-6 bg-blue-600 rounded-full relative">
              <div className="w-4 h-4 bg-white rounded-full absolute top-1 translate-x-5 transition-transform duration-200" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Push Notifications
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Receive mobile push notifications
              </p>
            </div>
            <button className="w-10 h-6 bg-blue-600 rounded-full relative">
              <div className="w-4 h-4 bg-white rounded-full absolute top-1 translate-x-5 transition-transform duration-200" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Quiet Hours
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No notifications between 10 PM - 8 AM
              </p>
            </div>
            <button className="w-10 h-6 bg-gray-300 dark:bg-gray-600 rounded-full relative">
              <div className="w-4 h-4 bg-white rounded-full absolute top-1 translate-x-1 transition-transform duration-200" />
            </button>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">🔔</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No budget alerts configured
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first alert to stay on top of your spending.
            </p>
            <button
              onClick={handleCreateAlert}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              Create First Alert
            </button>
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleToggleAlert(alert.id)}
                    className={`w-10 h-6 rounded-full ${
                      alert.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    } relative transition-colors duration-200`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform duration-200 ${
                        alert.enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {alert.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getAlertTypeDescription(alert.alertType)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Triggered {alert.triggerCount} times
                  </span>
                  <button
                    onClick={() => setEditingAlert(alert)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Type:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {alertTypes.find(t => t.value === alert.alertType)?.label}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Frequency:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {frequencies.find(f => f.value === alert.frequency)?.label}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Last Triggered:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {formatLastTriggered(alert.lastTriggered)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Delivery:
                </span>
                {alert.deliveryMethods.map(method => {
                  const option = deliveryOptions.find(o => o.value === method);
                  return (
                    <span
                      key={method}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200"
                    >
                      <span className="mr-1">{option?.icon}</span>
                      {option?.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Alert Modal */}
      {editingAlert && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setEditingAlert(null)}></div>

            <div className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {isCreatingAlert ? 'Create Alert' : 'Edit Alert'}
                </h3>
                <button
                  onClick={() => setEditingAlert(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Alert Name
                  </label>
                  <input
                    type="text"
                    value={editingAlert.name}
                    onChange={(e) => setEditingAlert({ ...editingAlert, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="e.g., Grocery Budget Warning"
                  />
                </div>

                {/* Alert Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Alert Type
                  </label>
                  <select
                    value={editingAlert.alertType}
                    onChange={(e) => setEditingAlert({ ...editingAlert, alertType: e.target.value as BudgetAlert['alertType'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  >
                    {alertTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {getAlertTypeDescription(editingAlert.alertType)}
                  </p>
                </div>

                {/* Threshold */}
                {(editingAlert.alertType === 'threshold' || editingAlert.alertType === 'overspend') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {editingAlert.alertType === 'threshold' ? 'Threshold (%)' : 'Amount (£)'}
                    </label>
                    <input
                      type="number"
                      value={editingAlert.threshold}
                      onChange={(e) => setEditingAlert({ ...editingAlert, threshold: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      min="0"
                      step={editingAlert.alertType === 'threshold' ? '5' : '0.01'}
                    />
                  </div>
                )}

                {/* Frequency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={editingAlert.frequency}
                    onChange={(e) => setEditingAlert({ ...editingAlert, frequency: e.target.value as BudgetAlert['frequency'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  >
                    {frequencies.map(freq => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delivery Methods */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Delivery Methods
                  </label>
                  <div className="space-y-2">
                    {deliveryOptions.map(option => (
                      <label key={option.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editingAlert.deliveryMethods.includes(option.value as any)}
                          onChange={() => handleDeliveryMethodToggle(option.value as any)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          {option.icon} {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Budget Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Budget Category (Optional)
                  </label>
                  <input
                    type="text"
                    value={editingAlert.budgetCategory || ''}
                    onChange={(e) => setEditingAlert({ ...editingAlert, budgetCategory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="e.g., groceries, entertainment"
                  />
                </div>

                {/* Save/Cancel */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleSaveAlert}
                    disabled={!editingAlert.name.trim() || editingAlert.deliveryMethods.length === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200"
                  >
                    {isCreatingAlert ? 'Create Alert' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditingAlert(null)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}