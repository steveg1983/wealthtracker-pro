import React, { useState, useEffect } from 'react';
import { mobileService } from '../services/mobileService';
import { 
  BellIcon,
  ClockIcon,
  DollarSignIcon,
  CalendarIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon
} from './icons';
import type { NotificationSettings as NotificationSettingsType } from '../services/mobileService';
import { logger } from '../services/loggingService';

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationSettings({ isOpen, onClose }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettingsType>(
    mobileService.getNotificationSettings()
  );
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(mobileService.getNotificationSettings());
      setHasPermission(Notification.permission === 'granted');
    }
  }, [isOpen]);

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const granted = await mobileService.requestNotificationPermission();
      setHasPermission(granted);
      if (granted) {
        setSettings(prev => ({ ...prev, enabled: true }));
      }
    } catch (error) {
      logger.error('Failed to request notification permission:', error);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleSettingChange = (key: keyof NotificationSettingsType, value: boolean | string | number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    mobileService.updateNotificationSettings(newSettings);
  };

  const handleQuietHoursChange = (key: 'enabled' | 'start' | 'end', value: boolean | string) => {
    const newSettings = {
      ...settings,
      quietHours: {
        ...settings.quietHours,
        [key]: value
      }
    };
    setSettings(newSettings);
    mobileService.updateNotificationSettings(newSettings);
  };

  const sendTestNotification = async () => {
    await mobileService.sendNotification(
      'Test Notification',
      'This is a test notification from Wealth Tracker',
      { type: 'test' }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BellIcon size={20} className="text-gray-600 dark:text-gray-500" />
              Notification Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XIcon size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Permission Request */}
            {!hasPermission && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
                <div className="flex items-start gap-3">
                  <AlertCircleIcon size={20} className="text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      Enable Notifications
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Allow notifications to receive budget alerts and bill reminders
                    </p>
                    <button
                      onClick={handleRequestPermission}
                      disabled={isRequestingPermission}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
                    >
                      {isRequestingPermission ? 'Requesting...' : 'Allow Notifications'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Master Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Enable Notifications
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive all types of notifications
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('enabled', !settings.enabled)}
                disabled={!hasPermission}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.enabled && hasPermission
                    ? 'bg-[var(--color-primary)]'
                    : 'bg-gray-200 dark:bg-gray-700'
                } ${!hasPermission ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.enabled && hasPermission ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Budget Alerts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSignIcon size={20} className="text-yellow-600 dark:text-yellow-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Budget Alerts
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    When you exceed 90% of a budget
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSettingChange('budgetAlerts', !settings.budgetAlerts)}
                disabled={!settings.enabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.budgetAlerts && settings.enabled
                    ? 'bg-[var(--color-primary)]'
                    : 'bg-gray-200 dark:bg-gray-700'
                } ${!settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.budgetAlerts && settings.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Bill Reminders */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarIcon size={20} className="text-green-600 dark:text-green-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Bill Reminders
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Recurring bill payment reminders
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSettingChange('billReminders', !settings.billReminders)}
                disabled={!settings.enabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.billReminders && settings.enabled
                    ? 'bg-[var(--color-primary)]'
                    : 'bg-gray-200 dark:bg-gray-700'
                } ${!settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.billReminders && settings.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Expense Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Large Expense Alert Threshold
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">$</span>
                <input
                  type="number"
                  value={settings.expenseThreshold}
                  onChange={(e) => handleSettingChange('expenseThreshold', Number(e.target.value))}
                  disabled={!settings.enabled}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  min="0"
                  step="10"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Get notified for expenses above this amount
              </p>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClockIcon size={20} className="text-purple-600 dark:text-purple-400" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Quiet Hours
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Disable notifications during these hours
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleQuietHoursChange('enabled', !settings.quietHours.enabled)}
                  disabled={!settings.enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.quietHours.enabled && settings.enabled
                      ? 'bg-[var(--color-primary)]'
                      : 'bg-gray-200 dark:bg-gray-700'
                  } ${!settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.quietHours.enabled && settings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {settings.quietHours.enabled && settings.enabled && (
                <div className="pl-8 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400 w-12">
                      From:
                    </label>
                    <input
                      type="time"
                      value={settings.quietHours.start}
                      onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400 w-12">
                      To:
                    </label>
                    <input
                      type="time"
                      value={settings.quietHours.end}
                      onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Test Notification */}
            {settings.enabled && hasPermission && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={sendTestNotification}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                >
                  Send Test Notification
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}