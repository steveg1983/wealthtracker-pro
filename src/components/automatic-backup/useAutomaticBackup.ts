import { useState, useEffect } from 'react';
import { automaticBackupService, type BackupConfig } from '../../services/automaticBackupService';
import { useNotifications } from '../../contexts/NotificationContext';
import { logger } from '../../services/loggingService';

export function useAutomaticBackup() {
  const { addNotification } = useNotifications();
  const [config, setConfig] = useState<BackupConfig>(automaticBackupService.getBackupConfig());
  const [backupHistory, setBackupHistory] = useState<unknown[]>([]);
  const [storedBackups, setStoredBackups] = useState<unknown[]>([]);
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

  const handleRestoreBackup = async (backupId: number) => {
    if (!confirm('Are you sure you want to restore this backup? This will overwrite your current data.')) {
      return;
    }
    
    try {
      await automaticBackupService.restoreFromBackup(backupId);
      addNotification({
        type: 'success',
        title: 'Backup Restored',
        message: 'Your data has been restored from the backup'
      });
      window.location.reload(); // Reload to show restored data
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Restore Failed',
        message: error instanceof Error ? error.message : 'Failed to restore backup'
      });
    }
  };

  return {
    config,
    backupHistory,
    storedBackups,
    testingBackup,
    handleConfigChange,
    handleTestBackup,
    handleDownloadBackup,
    handleDeleteBackup,
    handleRestoreBackup
  };
}