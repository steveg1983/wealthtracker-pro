import React, { useState, useEffect } from 'react';
import { automaticBackupService, type BackupConfig } from '../services/automaticBackupService';
import { useNotifications } from '../contexts/NotificationContext';
import { logger } from '../services/loggingService';
import {
  ShieldIcon,
  ClockIcon,
  SaveIcon as HardDriveIcon,
  DatabaseIcon as CloudIcon,
  DownloadIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  LockIcon
  // CalendarIcon // Currently unused
} from './icons';

export default function AutomaticBackupSettings() {
  const { addNotification } = useNotifications();
  const [config, setConfig] = useState<BackupConfig>(automaticBackupService.getBackupConfig());
  const [backupHistory, setBackupHistory] = useState<unknown[]>([]);
  const [storedBackups, setStoredBackups] = useState<unknown[]>([]);
  // const [loading, setLoading] = useState(false); // Currently unused
  const [testingBackup, setTestingBackup] = useState(false);

  useEffect(() => {
    loadBackupData();
  }, []);

  const loadBackupData = async () => {
    try {
      const history = JSON.parse(localStorage.getItem('money_management_backup_history') || '[]');
      setBackupHistory(history.slice(0, 10)); // Show last 10 entries
      
      const stored = await automaticBackupService.getStoredBackups();
      setStoredBackups(stored);
    } catch (error) {
      logger.error('Failed to load backup data:', error);
    }
  };

  const handleConfigChange = (updates: Partial<BackupConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    automaticBackupService.updateBackupConfig(updates);
    
    if (updates.enabled !== undefined) {
      addNotification({
        type: 'success',
        title: updates.enabled ? 'Automatic Backups Enabled' : 'Automatic Backups Disabled',
        message: updates.enabled 
          ? `Backups will run ${newConfig.frequency} at ${newConfig.time}`
          : 'Automatic backups have been disabled'
      });
    }
  };

  const handleTestBackup = async () => {
    setTestingBackup(true);
    try {
      await automaticBackupService.performBackup();
      await loadBackupData();
      addNotification({
        type: 'success',
        title: 'Test Backup Completed',
        message: 'Your data has been backed up successfully'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Backup Failed',
        message: error instanceof Error ? error.message : 'Failed to create backup'
      });
    } finally {
      setTestingBackup(false);
    }
  };

  const handleDownloadBackup = async (backupId: number) => {
    try {
      await automaticBackupService.downloadBackup(backupId);
      addNotification({
        type: 'success',
        title: 'Backup Downloaded',
        message: 'The backup file has been downloaded'
      });
    } catch {
      addNotification({
        type: 'error',
        title: 'Download Failed',
        message: 'Failed to download backup file'
      });
    }
  };

  const handleDeleteBackup = async (backupId: number) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return;
    }
    
    try {
      await automaticBackupService.deleteBackup(backupId);
      await loadBackupData();
      addNotification({
        type: 'success',
        title: 'Backup Deleted',
        message: 'The backup has been deleted'
      });
    } catch {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete backup'
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Backup Configuration */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <ShieldIcon size={24} className="text-primary" />
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white">
            Automatic Backups
          </h2>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Enable Automatic Backups</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Automatically backup your data at scheduled intervals
            </p>
          </div>
          <button
            onClick={() => handleConfigChange({ enabled: !config.enabled })}
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
            {/* Backup Frequency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Backup Frequency
                </label>
                <select
                  value={config.frequency}
                  onChange={(e) => handleConfigChange({ frequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
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
                  onChange={(e) => handleConfigChange({ time: e.target.value })}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Backup Format */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Backup Format
              </label>
              <select
                value={config.format}
                onChange={(e) => handleConfigChange({ format: e.target.value as 'json' | 'csv' | 'all' })}
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
                  onClick={() => handleConfigChange({ encryptionEnabled: !config.encryptionEnabled })}
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
                  onChange={(e) => handleConfigChange({ retentionDays: parseInt(e.target.value) })}
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

            {/* Cloud Storage (Coming Soon) */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <CloudIcon size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    Cloud Storage Integration Coming Soon
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Future updates will include automatic sync to Google Drive, Dropbox, and OneDrive
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Test Backup Button */}
        <div className="flex justify-end">
          <button
            onClick={handleTestBackup}
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

      {/* Backup History */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <ClockIcon size={24} className="text-primary" />
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white">
            Backup History
          </h2>
        </div>

        {backupHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            No backup history available
          </div>
        ) : (
          <div className="space-y-2">
            {backupHistory.map((entry, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {entry.success ? (
                    <CheckCircleIcon size={20} className="text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircleIcon size={20} className="text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {entry.success ? 'Backup Successful' : 'Backup Failed'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                {entry.filesCreated && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {entry.filesCreated} file{entry.filesCreated > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stored Backups */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <HardDriveIcon size={24} className="text-primary" />
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white">
            Stored Backups
          </h2>
        </div>

        {storedBackups.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            No stored backups available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Filename
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Size
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Format
                  </th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {storedBackups.map((backup) => (
                  <tr key={backup.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 px-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {backup.filename}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(backup.timestamp).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatFileSize(backup.size)}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {backup.format.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownloadBackup(backup.id)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
                          title="Download"
                        >
                          <DownloadIcon size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.id)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <AlertCircleIcon size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              About Automatic Backups
            </h3>
            <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li>• Backups run automatically at your scheduled time</li>
              <li>• Your data is stored locally in your browser's storage</li>
              <li>• Encrypted backups add an extra layer of security</li>
              <li>• Old backups are automatically cleaned up based on retention settings</li>
              <li>• Download backups regularly for external storage</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}