import type { BackupConfig } from '../../services/automaticBackupService';

export interface BackupHistoryItem {
  id: number;
  timestamp: string;
  size: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface StoredBackup {
  id: number;
  timestamp: string;
  size: number;
  type: string;
  encrypted?: boolean;
}

export interface BackupSettingsState {
  config: BackupConfig;
  backupHistory: BackupHistoryItem[];
  storedBackups: StoredBackup[];
  testingBackup: boolean;
}