export type DataManagementTab = 'import' | 'export' | 'tools' | 'backup';

export interface ImportOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  onClick: () => void;
}

export interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  fileType: string;
  onClick: () => void;
}

export interface DataTool {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  onClick: () => void;
  badge?: string;
}

export interface DataStats {
  accounts: number;
  transactions: number;
  budgets: number;
  categories: number;
  goals: number;
}

class DataManagementPageService {
  /**
   * Export data to JSON file
   */
  exportToJSON(exportData: () => string): void {
    const dataStr = exportData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wealthtracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get import options configuration
   */
  getImportOptions(handlers: Record<string, () => void>): ImportOption[] {
    return [
      {
        id: 'csv',
        title: 'CSV Import',
        description: 'Import transactions from CSV files',
        icon: 'FileTextIcon',
        iconColor: 'text-green-600',
        onClick: handlers.csv
      },
      {
        id: 'ofx',
        title: 'OFX Import',
        description: 'Import from OFX/QFX bank files',
        icon: 'CreditCardIcon',
        iconColor: 'text-blue-600',
        onClick: handlers.ofx
      },
      {
        id: 'qif',
        title: 'QIF Import',
        description: 'Import from Quicken QIF files',
        icon: 'DatabaseIcon',
        iconColor: 'text-purple-600',
        onClick: handlers.qif
      },
      {
        id: 'batch',
        title: 'Batch Import',
        description: 'Import multiple files at once',
        icon: 'FolderIcon',
        iconColor: 'text-orange-600',
        onClick: handlers.batch
      },
      {
        id: 'json',
        title: 'JSON Import',
        description: 'Import from WealthTracker backup',
        icon: 'UploadIcon',
        iconColor: 'text-gray-600',
        onClick: handlers.json
      },
      {
        id: 'bank',
        title: 'Bank Connection',
        description: 'Connect directly to your bank',
        icon: 'Building2Icon',
        iconColor: 'text-indigo-600',
        onClick: handlers.bank
      }
    ];
  }

  /**
   * Get export options configuration
   */
  getExportOptions(handlers: Record<string, () => void>): ExportOption[] {
    return [
      {
        id: 'json',
        title: 'JSON Export',
        description: 'Full backup in JSON format',
        icon: 'DownloadIcon',
        iconColor: 'text-gray-600',
        fileType: '.json',
        onClick: handlers.json
      },
      {
        id: 'excel',
        title: 'Excel Export',
        description: 'Export to Excel spreadsheet',
        icon: 'GridIcon',
        iconColor: 'text-green-600',
        fileType: '.xlsx',
        onClick: handlers.excel
      },
      {
        id: 'csv',
        title: 'CSV Export',
        description: 'Export transactions as CSV',
        icon: 'FileTextIcon',
        iconColor: 'text-blue-600',
        fileType: '.csv',
        onClick: handlers.csv
      },
      {
        id: 'pdf',
        title: 'PDF Reports',
        description: 'Generate PDF financial reports',
        icon: 'FileTextIcon',
        iconColor: 'text-red-600',
        fileType: '.pdf',
        onClick: handlers.pdf
      }
    ];
  }

  /**
   * Get data tools configuration
   */
  getDataTools(handlers: Record<string, () => void>): DataTool[] {
    return [
      {
        id: 'duplicate',
        title: 'Duplicate Detection',
        description: 'Find and merge duplicate transactions',
        icon: 'SearchIcon',
        iconColor: 'text-yellow-600',
        onClick: handlers.duplicate
      },
      {
        id: 'bulk',
        title: 'Bulk Edit',
        description: 'Edit multiple transactions at once',
        icon: 'EditIcon',
        iconColor: 'text-purple-600',
        onClick: handlers.bulk
      },
      {
        id: 'reconcile',
        title: 'Reconciliation',
        description: 'Reconcile transactions with statements',
        icon: 'LinkIcon',
        iconColor: 'text-green-600',
        onClick: handlers.reconcile
      },
      {
        id: 'validate',
        title: 'Data Validation',
        description: 'Check data integrity and fix issues',
        icon: 'AlertCircleIcon',
        iconColor: 'text-orange-600',
        onClick: handlers.validate,
        badge: 'New'
      },
      {
        id: 'categorize',
        title: 'Smart Categorization',
        description: 'Auto-categorize transactions',
        icon: 'LightbulbIcon',
        iconColor: 'text-blue-600',
        onClick: handlers.categorize
      },
      {
        id: 'rules',
        title: 'Import Rules',
        description: 'Manage import transformation rules',
        icon: 'WrenchIcon',
        iconColor: 'text-gray-600',
        onClick: handlers.rules
      },
      {
        id: 'migration',
        title: 'Data Migration',
        description: 'Migrate from other finance apps',
        icon: 'DatabaseIcon',
        iconColor: 'text-indigo-600',
        onClick: handlers.migration
      },
      {
        id: 'api',
        title: 'API Settings',
        description: 'Configure bank API connections',
        icon: 'KeyIcon',
        iconColor: 'text-red-600',
        onClick: handlers.api
      }
    ];
  }

  /**
   * Get backup options
   */
  getBackupOptions(handlers: Record<string, () => void>) {
    return [
      {
        id: 'automatic',
        title: 'Automatic Backups',
        description: 'Configure automatic backup schedule',
        icon: 'RefreshCwIcon',
        iconColor: 'text-green-600',
        onClick: handlers.automatic
      },
      {
        id: 'manual',
        title: 'Manual Backup',
        description: 'Create backup now',
        icon: 'DownloadIcon',
        iconColor: 'text-blue-600',
        onClick: handlers.manual
      },
      {
        id: 'restore',
        title: 'Restore Backup',
        description: 'Restore from previous backup',
        icon: 'UploadIcon',
        iconColor: 'text-purple-600',
        onClick: handlers.restore
      }
    ];
  }

  /**
   * Calculate data statistics
   */
  calculateDataStats(data: {
    accounts?: any[];
    transactions?: any[];
    budgets?: any[];
    categories?: any[];
    goals?: any[];
  }): DataStats {
    return {
      accounts: data.accounts?.length || 0,
      transactions: data.transactions?.length || 0,
      budgets: data.budgets?.length || 0,
      categories: data.categories?.length || 0,
      goals: data.goals?.length || 0
    };
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get confirmation message for data clear
   */
  getClearDataMessage(hasTestData: boolean): string {
    if (hasTestData) {
      return 'This will clear all test data. Are you sure you want to continue?';
    }
    return 'This will permanently delete all your data. This action cannot be undone. Are you sure?';
  }

  /**
   * Get tab configs
   */
  getTabConfigs() {
    return [
      {
        id: 'import' as const,
        label: 'Import',
        icon: 'UploadIcon',
        description: 'Import data from files or banks'
      },
      {
        id: 'export' as const,
        label: 'Export',
        icon: 'DownloadIcon',
        description: 'Export your data'
      },
      {
        id: 'tools' as const,
        label: 'Tools',
        icon: 'WrenchIcon',
        description: 'Data management tools'
      },
      {
        id: 'backup' as const,
        label: 'Backup',
        icon: 'DatabaseIcon',
        description: 'Backup and restore'
      }
    ];
  }
}

export const dataManagementPageService = new DataManagementPageService();