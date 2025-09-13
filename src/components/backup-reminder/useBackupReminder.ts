import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { format, differenceInDays, addDays } from 'date-fns';
import { logger } from '../../services/loggingService';
import { ExportHelpers, downloadExport } from '../../services/export';
import type { BackupSettings } from './types';

const DEFAULT_SETTINGS: BackupSettings = {
  enabled: true,
  frequency: 'weekly',
  autoBackup: false,
  backupFormats: ['json'],
  cloudBackup: false
};

export function useBackupReminder() {
  const { transactions, accounts, budgets, goals } = useApp();
  const [settings, setSettings] = useState<BackupSettings>(DEFAULT_SETTINGS);
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

  const calculateNextReminder = useCallback((frequency: BackupSettings['frequency']): Date => {
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
  }, []);

  const downloadFile = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const performBackup = useCallback(async () => {
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

      setBackupProgress(20);

      for (const format of settings.backupFormats) {
        if (format === 'json') {
          const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
          downloadFile(blob, `wealthtracker_backup_${timestamp}.json`);
        } else if (format === 'csv') {
          const result = await ExportHelpers.toCSV(transactions);
          downloadExport(result);
        } else if (format === 'qif') {
          // Note: exportService.exportToQIF needs to be implemented or imported
          logger.warn('QIF export not implemented');
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
      logger.error('Backup failed:', error);
      alert('Backup failed. Please try again.');
      setIsBackingUp(false);
      setBackupProgress(0);
    }
  }, [transactions, accounts, budgets, goals, settings.backupFormats, settings.frequency, calculateNextReminder, downloadFile]);

  const snoozeReminder = useCallback(() => {
    const snoozeDate = addDays(new Date(), 1);
    setSettings(prev => ({
      ...prev,
      nextReminder: snoozeDate.toISOString()
    }));
    setShowReminder(false);
  }, []);

  const getDaysSinceBackup = useCallback((): number | null => {
    if (!settings.lastBackup) return null;
    return differenceInDays(new Date(), new Date(settings.lastBackup));
  }, [settings.lastBackup]);

  const daysSinceBackup = getDaysSinceBackup();
  const isOverdue = daysSinceBackup !== null && (
    (settings.frequency === 'daily' && daysSinceBackup >= 1) ||
    (settings.frequency === 'weekly' && daysSinceBackup >= 7) ||
    (settings.frequency === 'monthly' && daysSinceBackup >= 30)
  );

  return {
    settings,
    setSettings,
    showReminder,
    setShowReminder,
    showSettings,
    setShowSettings,
    isBackingUp,
    backupProgress,
    performBackup,
    snoozeReminder,
    daysSinceBackup,
    isOverdue,
    transactions,
    accounts,
    budgets,
    goals
  };
}
