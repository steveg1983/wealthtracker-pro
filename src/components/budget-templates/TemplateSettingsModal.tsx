import { memo, useEffect } from 'react';
import type { RecurringSettings } from '../../services/budgetTemplateService';
import { logger } from '../../services/loggingService';

interface TemplateSettingsModalProps {
  isOpen: boolean;
  settings: RecurringSettings;
  onClose: () => void;
  onUpdateSettings: (settings: RecurringSettings) => void;
}

/**
 * Settings modal for recurring budget templates
 * Extracted from RecurringBudgetTemplates for single responsibility
 */
export const TemplateSettingsModal = memo(function TemplateSettingsModal({
  isOpen,
  settings,
  onClose,
  onUpdateSettings
}: TemplateSettingsModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('TemplateSettingsModal component initialized', {
      componentName: 'TemplateSettingsModal'
    });
  }, []);

  if (!isOpen) return null;

  const handleSave = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recurring Settings
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Auto-apply templates
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automatically apply templates on schedule
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoApply}
              onChange={(e) => onUpdateSettings({
                ...settings,
                autoApply: e.target.checked
              })}
              className="rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notification days before application
            </label>
            <input
              type="number"
              value={settings.notificationDays}
              onChange={(e) => onUpdateSettings({
                ...settings,
                notificationDays: parseInt(e.target.value) || 3
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Skip weekends
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Move weekend dates to Monday
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.skipWeekends}
              onChange={(e) => onUpdateSettings({
                ...settings,
                skipWeekends: e.target.checked
              })}
              className="rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Rollover unspent amounts
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Keep existing budgets when applying
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.rolloverUnspent}
              onChange={(e) => onUpdateSettings({
                ...settings,
                rolloverUnspent: e.target.checked
              })}
              className="rounded"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
});
