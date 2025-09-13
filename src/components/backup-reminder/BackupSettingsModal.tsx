import React, { useEffect, memo } from 'react';
import type { BackupSettings } from './types';
import { logger } from '../../services/loggingService';

interface BackupSettingsModalProps {
  isOpen: boolean;
  settings: BackupSettings;
  onSettingsChange: (settings: BackupSettings) => void;
  onClose: () => void;
}

export const BackupSettingsModal = memo(function BackupSettingsModal({
  isOpen,
  settings,
  onSettingsChange,
  onClose
}: BackupSettingsModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('BackupSettingsModal component initialized', {
      componentName: 'BackupSettingsModal'
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Backup Settings
        </h3>

        <div className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Backup Reminders
            </label>
            <button
              onClick={() => onSettingsChange({ ...settings, enabled: !settings.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enabled ? 'bg-gray-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reminder Frequency
            </label>
            <select
              value={settings.frequency}
              onChange={(e) => onSettingsChange({ 
                ...settings, 
                frequency: e.target.value as BackupSettings['frequency'] 
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Backup Formats */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Backup Formats
            </label>
            <div className="space-y-2">
              {(['json', 'csv', 'qif'] as const).map(format => (
                <label key={format} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.backupFormats.includes(format)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSettingsChange({
                          ...settings,
                          backupFormats: [...settings.backupFormats, format]
                        });
                      } else {
                        onSettingsChange({
                          ...settings,
                          backupFormats: settings.backupFormats.filter(f => f !== format)
                        });
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {format.toUpperCase()} {format === 'json' && '(Full backup)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Auto Backup */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Auto-backup
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automatically backup when reminded
              </p>
            </div>
            <button
              onClick={() => onSettingsChange({ ...settings, autoBackup: !settings.autoBackup })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoBackup ? 'bg-gray-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoBackup ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
});
