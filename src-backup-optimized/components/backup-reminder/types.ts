export interface BackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastBackup?: string;
  nextReminder?: string;
  autoBackup: boolean;
  backupFormats: ('csv' | 'json' | 'qif')[];
  cloudBackup: boolean;
}

export interface BackupData {
  version: string;
  timestamp: string;
  data: {
    transactions: any[];
    accounts: any[];
    budgets: any[];
    goals: any[];
  };
}