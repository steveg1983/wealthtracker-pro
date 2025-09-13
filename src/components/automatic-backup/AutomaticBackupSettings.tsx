import React, { useEffect, memo } from 'react';
import { useAutomaticBackup } from './useAutomaticBackup';
import { BackupConfiguration } from './BackupConfiguration';
import { BackupHistory } from './BackupHistory';
import { CloudStorageInfo } from './CloudStorageInfo';
import { logger } from '../../services/loggingService';

const AutomaticBackupSettings = memo(function AutomaticBackupSettings(): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AutomaticBackupSettings component initialized', {
      componentName: 'AutomaticBackupSettings'
    });
  }, []);

  const {
    config,
    backupHistory,
    testingBackup,
    handleConfigChange,
    handleTestBackup,
    handleDownloadBackup,
    handleDeleteBackup,
    handleRestoreBackup
  } = useAutomaticBackup();

  return (
    <div className="space-y-6">
      <BackupConfiguration
        config={config}
        onConfigChange={handleConfigChange}
        onTestBackup={handleTestBackup}
        testingBackup={testingBackup}
      />
      
      {config.enabled && <CloudStorageInfo />}
      
      <BackupHistory
        backupHistory={backupHistory}
        onDownload={handleDownloadBackup}
        onDelete={handleDeleteBackup}
        onRestore={handleRestoreBackup}
      />
    </div>
  );
});

export default AutomaticBackupSettings;