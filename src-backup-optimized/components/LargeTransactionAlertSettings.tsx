/**
 * LargeTransactionAlertSettings Component - Configure alerts for large transactions
 *
 * Features:
 * - Set thresholds for large transaction alerts
 * - Configure alert delivery methods
 * - Account-specific settings
 * - Time-based rules
 * - Merchant whitelisting
 */

import React, { useState, useEffect } from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

interface LargeTransactionAlert {
  id: string;
  name: string;
  enabled: boolean;
  threshold: number;
  currency: string;
  accounts: string[]; // Account IDs, empty for all accounts
  excludedMerchants: string[];
  timeRestrictions?: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    daysOfWeek: number[]; // 0-6, Sunday = 0
  };
  deliveryMethods: ('email' | 'sms' | 'push' | 'in_app')[];
  cooldownMinutes: number; // Minimum time between alerts for same merchant
  requireConfirmation: boolean; // Require user confirmation for very large amounts
  confirmationThreshold?: number;
  lastTriggered?: Date;
  triggerCount: number;
}

interface LargeTransactionAlertSettingsProps {
  userId?: string;
  onSettingsChange?: (alerts: LargeTransactionAlert[]) => void;
  className?: string;
}

// Mock alert data
const mockAlerts: LargeTransactionAlert[] = [
  {
    id: 'alert-1',
    name: 'Large Purchase Alert',
    enabled: true,
    threshold: 500,
    currency: 'GBP',
    accounts: [],
    excludedMerchants: ['PAYPAL', 'VENMO'],
    deliveryMethods: ['push', 'in_app'],
    cooldownMinutes: 60,
    requireConfirmation: false,
    lastTriggered: new Date('2024-01-18'),
    triggerCount: 5
  },
  {
    id: 'alert-2',
    name: 'Very Large Transaction Warning',
    enabled: true,
    threshold: 2000,
    currency: 'GBP',
    accounts: [],
    excludedMerchants: [],
    timeRestrictions: {
      enabled: true,
      startTime: '22:00',
      endTime: '06:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // All days
    },
    deliveryMethods: ['email', 'sms', 'push'],
    cooldownMinutes: 30,
    requireConfirmation: true,
    confirmationThreshold: 5000,
    triggerCount: 1
  }
];

const deliveryOptions = [
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'sms', label: 'SMS', icon: '💬' },
  { value: 'push', label: 'Push Notification', icon: '📱' },
  { value: 'in_app', label: 'In-App Alert', icon: '🔔' }
];

const daysOfWeek = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
];

export default function LargeTransactionAlertSettings({
  userId,
  onSettingsChange,
  className = ''
}: LargeTransactionAlertSettingsProps): React.JSX.Element {
  const [alerts, setAlerts] = useState<LargeTransactionAlert[]>([]);
  const [editingAlert, setEditingAlert] = useState<LargeTransactionAlert | null>(null);
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load alerts
  useEffect(() => {
    const loadAlerts = async () => {
      setIsLoading(true);
      try {
        logger.debug('Loading large transaction alerts for user:', userId);

        // In a real implementation, this would fetch from API
        await new Promise(resolve => setTimeout(resolve, 300));

        setAlerts(mockAlerts);
        onSettingsChange?.(mockAlerts);
        logger.debug('Large transaction alerts loaded successfully');
      } catch (error) {
        logger.error('Error loading large transaction alerts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAlerts();
  }, [userId, onSettingsChange]);

  const createNewAlert = (): LargeTransactionAlert => ({
    id: `alert-${Date.now()}`,
    name: '',
    enabled: true,
    threshold: 1000,
    currency: 'GBP',
    accounts: [],
    excludedMerchants: [],
    deliveryMethods: ['push'],
    cooldownMinutes: 60,
    requireConfirmation: false,
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

  const handleDeliveryMethodToggle = (method: 'email' | 'sms' | 'push' | 'in_app') => {
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

  const handleTimeRestrictionToggle = (day: number) => {
    if (!editingAlert || !editingAlert.timeRestrictions) return;

    const currentDays = editingAlert.timeRestrictions.daysOfWeek;
    const updatedDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();

    setEditingAlert({
      ...editingAlert,
      timeRestrictions: {
        ...editingAlert.timeRestrictions,
        daysOfWeek: updatedDays
      }
    });
  };

  const addExcludedMerchant = (merchant: string) => {
    if (!editingAlert || !merchant.trim()) return;

    const updatedMerchants = [...editingAlert.excludedMerchants, merchant.trim().toUpperCase()];
    setEditingAlert({
      ...editingAlert,
      excludedMerchants: updatedMerchants
    });
  };

  const removeExcludedMerchant = (index: number) => {
    if (!editingAlert) return;

    const updatedMerchants = editingAlert.excludedMerchants.filter((_, i) => i !== index);
    setEditingAlert({
      ...editingAlert,
      excludedMerchants: updatedMerchants
    });
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

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          {[1, 2].map(i => (
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
            Large Transaction Alerts
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Get notified when transactions exceed your specified thresholds
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
          Global Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable All Large Transaction Monitoring
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Master switch for all large transaction alerts
              </p>
            </div>
            <button className="w-10 h-6 bg-blue-600 rounded-full relative">
              <div className="w-4 h-4 bg-white rounded-full absolute top-1 translate-x-5 transition-transform duration-200" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enhanced Security for Large Amounts
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Require additional verification for very large transactions
              </p>
            </div>
            <button className="w-10 h-6 bg-blue-600 rounded-full relative">
              <div className="w-4 h-4 bg-white rounded-full absolute top-1 translate-x-5 transition-transform duration-200" />
            </button>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">💰</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No large transaction alerts configured
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first alert to monitor large transactions.
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
                      Alert when transactions exceed {formatCurrency(alert.threshold)}
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
                  <span className="font-medium text-gray-700 dark:text-gray-300">Threshold:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {formatCurrency(alert.threshold)}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Cooldown:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {alert.cooldownMinutes} minutes
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Last Triggered:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {formatLastTriggered(alert.lastTriggered)}
                  </span>
                </div>
              </div>

              {alert.timeRestrictions?.enabled && (
                <div className="mt-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Time Restrictions:
                  </span>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {alert.timeRestrictions.startTime} - {alert.timeRestrictions.endTime}
                  </span>
                </div>
              )}

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

              {alert.excludedMerchants.length > 0 && (
                <div className="mt-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Excluded Merchants:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {alert.excludedMerchants.map(merchant => (
                      <span
                        key={merchant}
                        className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                      >
                        {merchant}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Edit Alert Modal */}
      {editingAlert && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setEditingAlert(null)}></div>

            <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {isCreatingAlert ? 'Create Large Transaction Alert' : 'Edit Alert'}
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

              <div className="space-y-6 max-h-96 overflow-y-auto">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Alert Name
                    </label>
                    <input
                      type="text"
                      value={editingAlert.name}
                      onChange={(e) => setEditingAlert({ ...editingAlert, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="e.g., Large Purchase Alert"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Threshold Amount
                      </label>
                      <input
                        type="number"
                        value={editingAlert.threshold}
                        onChange={(e) => setEditingAlert({ ...editingAlert, threshold: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        min="0"
                        step="10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cooldown (minutes)
                      </label>
                      <input
                        type="number"
                        value={editingAlert.cooldownMinutes}
                        onChange={(e) => setEditingAlert({ ...editingAlert, cooldownMinutes: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        min="0"
                        step="5"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Methods */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Delivery Methods
                  </label>
                  <div className="grid grid-cols-2 gap-2">
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

                {/* Excluded Merchants */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Excluded Merchants
                  </label>
                  <div className="space-y-2">
                    {editingAlert.excludedMerchants.map((merchant, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
                          {merchant}
                        </span>
                        <button
                          onClick={() => removeExcludedMerchant(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Add merchant to exclude..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addExcludedMerchant(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Confirmation Settings */}
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingAlert.requireConfirmation}
                      onChange={(e) => setEditingAlert({ ...editingAlert, requireConfirmation: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Require confirmation for very large amounts
                    </span>
                  </label>
                  {editingAlert.requireConfirmation && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Confirmation Threshold
                      </label>
                      <input
                        type="number"
                        value={editingAlert.confirmationThreshold || 0}
                        onChange={(e) => setEditingAlert({ ...editingAlert, confirmationThreshold: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        min="0"
                        step="100"
                      />
                    </div>
                  )}
                </div>

                {/* Save/Cancel */}
                <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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