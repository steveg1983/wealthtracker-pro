import React, { useEffect, memo } from 'react';
import { ShieldIcon, ClockIcon, SaveIcon as HardDriveIcon, LockIcon, RefreshCwIcon } from '../icons';
import type { BackupConfig } from '../../services/automaticBackupService';
import { logger } from '../../services/loggingService';

interface BackupConfigurationProps {
  config: BackupConfig;
  onConfigChange: (updates: Partial<BackupConfig>) => void;
  onTestBackup: () => void;
  testingBackup: boolean;
}

export const BackupConfiguration = memo(function BackupConfiguration({
  config,
  onConfigChange,
  onTestBackup,
  testingBackup
}: BackupConfigurationProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BackupConfiguration component initialized', {
      componentName: 'BackupConfiguration'
    });
  }, []);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldIcon size={24} className="text-primary" />
        <h2 className="text-xl font-semibold text-theme-heading dark:text-white">
          Automatic Backup Configuration
        </h2>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">Enable Automatic Backups</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Automatically save your financial data at regular intervals
          </p>
        </div>
        <button
          onClick={() => onConfigChange({ enabled: !config.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <>
          {/* Backup Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <ClockIcon size={16} className="inline mr-1" />
                Backup Frequency
              </label>
              <select
                value={config.frequency}
                onChange={(e) => onConfigChange({ frequency: e.target.value as BackupConfig['frequency'] })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="hourly">Every Hour</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Backup Time
              </label>
              <input
                type="time"
                value={config.time}
                onChange={(e) => onConfigChange({ time: e.target.value })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Backup Format */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <HardDriveIcon size={16} className="inline mr-1" />
              Backup Format
            </label>
            <select
              value={config.format || 'json'}
              onChange={(e) => onConfigChange({ format: e.target.value as BackupConfig['format'] })}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="json">JSON (Recommended)</option>
              <option value="csv">CSV (Excel compatible)</option>
              <option value="all">Both JSON and CSV</option>
            </select>
          </div>

          {/* Advanced Options */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <LockIcon size={16} />
                  Encrypt Backups
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Protect your backup files with encryption
                </p>
              </div>
              <button
                onClick={() => onConfigChange({ encryptionEnabled: !config.encryptionEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.encryptionEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.encryptionEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Retention Period
              </label>
              <select
                value={config.retentionDays}
                onChange={(e) => onConfigChange({ retentionDays: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* Test Backup Button */}
      <div className="flex justify-end">
        <button
          onClick={onTestBackup}
          disabled={testingBackup}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testingBackup ? (
            <>
              <RefreshCwIcon size={16} className="animate-spin" />
              Creating Backup...
            </>
          ) : (
            <>
              <HardDriveIcon size={16} />
              Test Backup Now
            </>
          )}
        </button>
      </div>
    </div>
  );
});