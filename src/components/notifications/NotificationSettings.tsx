import React, { useEffect, memo } from 'react';
import { notificationService } from '../../services/notificationService';
import { useLogger } from '../services/ServiceProvider';

export const NotificationSettings = memo(function NotificationSettings(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('NotificationSettings component initialized', {
      componentName: 'NotificationSettings'
    });
  }, []);

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Notification Settings
      </h3>
      
      {/* Global Settings */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Budget Alerts
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Warning threshold (% of budget)
              </span>
              <input
                type="number"
                min="1"
                max="100"
                value={notificationService.getBudgetConfig().warningThreshold}
                onChange={(e) => {
                  notificationService.updateBudgetConfig({
                    warningThreshold: parseInt(e.target.value) || 80
                  });
                }}
                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Danger threshold (% of budget)
              </span>
              <input
                type="number"
                min="1"
                max="200"
                value={notificationService.getBudgetConfig().dangerThreshold}
                onChange={(e) => {
                  notificationService.updateBudgetConfig({
                    dangerThreshold: parseInt(e.target.value) || 100
                  });
                }}
                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Transaction Alerts
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Large transaction threshold (£)
              </span>
              <input
                type="number"
                min="0"
                step="10"
                value={notificationService.getTransactionConfig().largeTransactionThreshold}
                onChange={(e) => {
                  notificationService.updateTransactionConfig({
                    largeTransactionThreshold: parseInt(e.target.value) || 500
                  });
                }}
                className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Duplicate detection
              </span>
              <ToggleSwitch
                enabled={notificationService.getTransactionConfig().duplicateDetectionEnabled}
                onChange={(enabled) => {
                  notificationService.updateTransactionConfig({
                    duplicateDetectionEnabled: enabled
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Goal Celebrations
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Milestone notifications
              </span>
              <ToggleSwitch
                enabled={notificationService.getGoalConfig().enableMilestoneNotifications}
                onChange={(enabled) => {
                  notificationService.updateGoalConfig({
                    enableMilestoneNotifications: enabled
                  });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Completion celebrations
              </span>
              <ToggleSwitch
                enabled={notificationService.getGoalConfig().enableCompletionCelebration}
                onChange={(enabled) => {
                  notificationService.updateGoalConfig({
                    enableCompletionCelebration: enabled
                  });
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Toggle Switch Component
interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

const ToggleSwitch = memo(function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? 'bg-gray-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
});