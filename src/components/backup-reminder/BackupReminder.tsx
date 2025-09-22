import React, { useEffect, memo } from 'react';
import { useBackupReminder } from './useBackupReminder';
import { BackupStatusIndicator } from './BackupStatusIndicator';
import { BackupReminderModal } from './BackupReminderModal';
import { BackupSettingsModal } from './BackupSettingsModal';
import { useLogger } from '../services/ServiceProvider';

const BackupReminder = memo(function BackupReminder(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BackupReminder component initialized', {
      componentName: 'BackupReminder'
    });
  }, []);

  const {
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
  } = useBackupReminder();

  return (
    <>
      <BackupStatusIndicator
        enabled={settings.enabled}
        isOverdue={isOverdue}
        daysSinceBackup={daysSinceBackup}
        onClick={() => setShowReminder(true)}
      />

      <BackupReminderModal
        isOpen={showReminder}
        isOverdue={isOverdue}
        daysSinceBackup={daysSinceBackup}
        {...(settings.lastBackup ? { lastBackup: settings.lastBackup } : {})}
        isBackingUp={isBackingUp}
        backupProgress={backupProgress}
        transactions={transactions}
        accounts={accounts}
        budgets={budgets}
        goals={goals}
        onClose={() => setShowReminder(false)}
        onBackup={performBackup}
        onSnooze={snoozeReminder}
        onOpenSettings={() => setShowSettings(true)}
      />

      <BackupSettingsModal
        isOpen={showSettings}
        settings={settings}
        onSettingsChange={setSettings}
        onClose={() => {
          setShowSettings(false);
          setShowReminder(false);
        }}
      />
    </>
  );
});

export default BackupReminder;
