import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Download, 
  AlertTriangle, 
  CheckCircle,
  X,
  Clock,
  Cloud,
  Settings
} from 'lucide-react';
import { useApp } from '../contexts/AppContextSupabase';
import { exportService } from '../services/exportService';
import { format, differenceInDays, addDays } from 'date-fns';
import { createScopedLogger } from '../loggers/scopedLogger';

interface BackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastBackup?: string;
  nextReminder?: string;
  autoBackup: boolean;
  backupFormats: ('csv' | 'json' | 'qif')[];
  cloudBackup: boolean;
}

export default function BackupReminder(): React.JSX.Element {
  const { transactions, accounts, budgets, goals } = useApp();
  const logger = useMemo(() => createScopedLogger('BackupReminder'), []);
  const [settings, setSettings] = useState<BackupSettings>({
    enabled: true,
    frequency: 'weekly',
    autoBackup: false,
    backupFormats: ['json'],
    cloudBackup: false
  });
  const [showReminder, setShowReminder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('backupSettings');
    if (stored) {
      const parsedSettings = JSON.parse(stored);
      setSettings(parsedSettings);
      
      // Check if reminder is due
      if (parsedSettings.enabled && parsedSettings.nextReminder) {
        const nextReminderDate = new Date(parsedSettings.nextReminder);
        if (new Date() >= nextReminderDate) {
          setShowReminder(true);
        }
      }
    } else {
      // First time setup - show reminder
      setShowReminder(true);
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('backupSettings', JSON.stringify(settings));
  }, [settings]);

  // Check for reminders periodically (every hour)
  useEffect(() => {
    const checkReminder = () => {
      if (settings.enabled && settings.nextReminder) {
        const nextReminderDate = new Date(settings.nextReminder);
        if (new Date() >= nextReminderDate) {
          setShowReminder(true);
        }
      }
    };

    const interval = setInterval(checkReminder, 3600000); // Check every hour
    return () => clearInterval(interval);
  }, [settings]);

  const performBackup = async () => {
    setIsBackingUp(true);
    setBackupProgress(0);

    try {
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          transactions,
          accounts,
          budgets,
          goals
        }
      };

      // Simulate progress for better UX
      setBackupProgress(20);

      for (const format of settings.backupFormats) {
        if (format === 'json') {
          const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `wealthtracker_backup_${timestamp}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } else if (format === 'csv') {
          const csv = await exportService.exportToCSV(transactions);
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `wealthtracker_transactions_${timestamp}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        } else if (format === 'qif') {
          const qif = exportService.exportToQIF({ transactions, accounts });
          const blob = new Blob([qif], { type: 'application/qif' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `wealthtracker_transactions_${timestamp}.qif`;
          a.click();
          URL.revokeObjectURL(url);
        }
        
        setBackupProgress(prev => prev + (60 / settings.backupFormats.length));
      }

      // Update last backup and next reminder
      const now = new Date();
      const nextReminderDate = calculateNextReminder(settings.frequency);
      
      setSettings(prev => ({
        ...prev,
        lastBackup: now.toISOString(),
        nextReminder: nextReminderDate.toISOString()
      }));

      setBackupProgress(100);
      
      // Auto-close reminder after successful backup
      setTimeout(() => {
        setShowReminder(false);
        setIsBackingUp(false);
        setBackupProgress(0);
      }, 1500);

    } catch (error) {
      logger.error('Backup failed', error as Error);
      alert('Backup failed. Please try again.');
      setIsBackingUp(false);
      setBackupProgress(0);
    }
  };

  const calculateNextReminder = (frequency: BackupSettings['frequency']): Date => {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return addDays(now, 1);
      case 'weekly':
        return addDays(now, 7);
      case 'monthly':
        return addDays(now, 30);
      default:
        return addDays(now, 7);
    }
  };

  const snoozeReminder = () => {
    const snoozeDate = addDays(new Date(), 1);
    setSettings(prev => ({
      ...prev,
      nextReminder: snoozeDate.toISOString()
    }));
    setShowReminder(false);
  };

  const getDaysSinceBackup = (): number | null => {
    if (!settings.lastBackup) return null;
    return differenceInDays(new Date(), new Date(settings.lastBackup));
  };

  const daysSinceBackup = getDaysSinceBackup();
  const isOverdue = daysSinceBackup !== null && (
    (settings.frequency === 'daily' && daysSinceBackup >= 1) ||
    (settings.frequency === 'weekly' && daysSinceBackup >= 7) ||
    (settings.frequency === 'monthly' && daysSinceBackup >= 30)
  );

  return (
    <>
      {/* Floating Backup Status Indicator */}
      {settings.enabled && (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            onClick={() => setShowReminder(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all hover:scale-105 ${
              isOverdue
                ? 'bg-red-500 text-white'
                : daysSinceBackup === null
                ? 'bg-yellow-500 text-white'
                : 'bg-green-500 text-white'
            }`}
          >
            <Shield size={20} />
            <span className="text-sm font-medium">
              {daysSinceBackup === null
                ? 'No backup yet'
                : isOverdue
                ? 'Backup overdue!'
                : `Backed up ${daysSinceBackup}d ago`}
            </span>
          </button>
        </div>
      )}

      {/* Backup Reminder Modal */}
      {showReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-2xl shadow-2xl w-full max-w-md p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {isOverdue ? (
                  <AlertTriangle className="text-red-500" size={24} />
                ) : (
                  <Shield className="text-blue-500" size={24} />
                )}
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isOverdue ? 'Backup Overdue!' : 'Time to Backup'}
                </h2>
              </div>
              <button
                onClick={() => setShowReminder(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            {!isBackingUp ? (
              <>
                <div className="mb-6">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {daysSinceBackup === null
                      ? "You haven't created a backup yet. Protect your financial data by creating one now."
                      : isOverdue
                      ? `It's been ${daysSinceBackup} days since your last backup. Don't risk losing your data!`
                      : 'Regular backups ensure your financial data is always safe and recoverable.'}
                  </p>

                  {settings.lastBackup && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock size={16} />
                        <span>Last backup: {format(new Date(settings.lastBackup), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Backup will include:
                    </p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" />
                        {transactions.length} transactions
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" />
                        {accounts.length} accounts
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" />
                        {budgets.length} budgets
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" />
                        {goals.length} goals
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={performBackup}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    Backup Now
                  </button>
                  <button
                    onClick={snoozeReminder}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Remind Later
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Settings size={20} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Backup Progress */}
                <div className="py-8">
                  <div className="flex flex-col items-center">
                    <Cloud size={48} className="text-blue-500 mb-4 animate-pulse" />
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Creating Backup...
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Please wait while we secure your data
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${backupProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {backupProgress}% complete
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-2xl shadow-2xl w-full max-w-md p-6">
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
                  onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
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
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    frequency: e.target.value as BackupSettings['frequency'] 
                  }))}
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
                            setSettings(prev => ({
                              ...prev,
                              backupFormats: [...prev.backupFormats, format]
                            }));
                          } else {
                            setSettings(prev => ({
                              ...prev,
                              backupFormats: prev.backupFormats.filter(f => f !== format)
                            }));
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
                  onClick={() => setSettings(prev => ({ ...prev, autoBackup: !prev.autoBackup }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoBackup ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
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
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowReminder(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
