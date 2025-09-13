import React, { useEffect, memo } from 'react';
import { 
  ShieldIcon as Shield,
  DownloadIcon as Download,
  ClockIcon as Clock,
  CheckCircleIcon as CheckCircle,
  AlertTriangleIcon as AlertTriangle,
  XIcon as X,
  CloudIcon as Cloud,
  SettingsIcon as Settings
} from '../icons';
import { format } from 'date-fns';
import type { BackupSettings } from './types';
import type { Transaction, Account, Budget, Goal } from '../../types';
import { logger } from '../../services/loggingService';

interface BackupReminderModalProps {
  isOpen: boolean;
  isOverdue: boolean;
  daysSinceBackup: number | null;
  lastBackup?: string;
  isBackingUp: boolean;
  backupProgress: number;
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  onClose: () => void;
  onBackup: () => void;
  onSnooze: () => void;
  onOpenSettings: () => void;
}

export const BackupReminderModal = memo(function BackupReminderModal({
  isOpen,
  isOverdue,
  daysSinceBackup,
  lastBackup,
  isBackingUp,
  backupProgress,
  transactions,
  accounts,
  budgets,
  goals,
  onClose,
  onBackup,
  onSnooze,
  onOpenSettings
}: BackupReminderModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('BackupReminderModal component initialized', {
      componentName: 'BackupReminderModal'
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {isOverdue ? (
              <AlertTriangle className="text-red-500" size={24} />
            ) : (
              <Shield className="text-gray-500" size={24} />
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isOverdue ? 'Backup Overdue!' : 'Time to Backup'}
            </h2>
          </div>
          <button
            onClick={onClose}
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

              {lastBackup && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock size={16} />
                    <span>Last backup: {format(new Date(lastBackup), 'MMM d, yyyy h:mm a')}</span>
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
                onClick={onBackup}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={20} />
                Backup Now
              </button>
              <button
                onClick={onSnooze}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Remind Later
              </button>
              <button
                onClick={onOpenSettings}
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
                <Cloud size={48} className="text-gray-500 mb-4 animate-pulse" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Creating Backup...
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Please wait while we secure your data
                </p>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gray-600 h-2 rounded-full transition-all duration-500"
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
  );
});
