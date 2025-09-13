export type ModalType = 
  | 'deleteConfirm' | 'importModal' | 'testDataConfirm' | 'csvImport' 
  | 'ofxImport' | 'qifImport' | 'duplicateDetection' | 'excelExport'
  | 'bulkEdit' | 'reconciliation' | 'dataValidation' | 'smartCategorization'
  | 'batchImport' | 'importRules' | 'bankConnections' | 'bankAPISettings' 
  | 'migrationWizard';

export interface DataStats {
  accountsCount: number;
  transactionsCount: number;
  budgetsCount: number;
}

class DataManagementService {
  exportDataAsJSON(exportFunction: () => string): void {
    const dataStr = exportFunction();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `money-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getImportButtons(): Array<{
    id: string;
    label: string;
    icon: string;
    color: string;
    modalType: ModalType;
    fullWidth?: boolean;
  }> {
    return [
      {
        id: 'migration',
        label: 'Data Migration Wizard (Mint, Quicken, YNAB, etc.)',
        icon: 'DatabaseIcon',
        color: 'bg-gradient-to-r from-gray-600 to-purple-600',
        modalType: 'migrationWizard',
        fullWidth: true
      },
      {
        id: 'batch',
        label: 'Batch Import Multiple Files',
        icon: 'FolderIcon',
        color: 'bg-green-600',
        modalType: 'batchImport'
      },
      {
        id: 'csv',
        label: 'CSV Import (Bank Statements)',
        icon: 'FileTextIcon',
        color: 'bg-indigo-500',
        modalType: 'csvImport'
      },
      {
        id: 'ofx',
        label: 'OFX Import (Auto Match)',
        icon: 'CreditCardIcon',
        color: 'bg-purple-500',
        modalType: 'ofxImport'
      },
      {
        id: 'qif',
        label: 'QIF Import (Quicken)',
        icon: 'DatabaseIcon',
        color: 'bg-teal-500',
        modalType: 'qifImport'
      },
      {
        id: 'legacy',
        label: 'Legacy Import (MNY/MBF)',
        icon: 'UploadIcon',
        color: 'bg-gray-500',
        modalType: 'importModal'
      }
    ];
  }

  getAdvancedOptions(): Array<{
    id: string;
    label: string;
    icon: string;
    color: string;
    modalType: ModalType;
  }> {
    return [
      {
        id: 'smartCategorization',
        label: 'Smart Categorization (AI)',
        icon: 'LightbulbIcon',
        color: 'bg-indigo-600',
        modalType: 'smartCategorization'
      },
      {
        id: 'importRules',
        label: 'Import Rules & Transformations',
        icon: 'WrenchIcon',
        color: 'bg-purple-600',
        modalType: 'importRules'
      },
      {
        id: 'duplicateDetection',
        label: 'Find Duplicate Transactions',
        icon: 'SearchIcon',
        color: 'bg-yellow-500',
        modalType: 'duplicateDetection'
      },
      {
        id: 'bulkEdit',
        label: 'Bulk Edit Transactions',
        icon: 'EditIcon',
        color: 'bg-indigo-500',
        modalType: 'bulkEdit'
      },
      {
        id: 'reconciliation',
        label: 'Reconcile Accounts',
        icon: 'LinkIcon',
        color: 'bg-cyan-500',
        modalType: 'reconciliation'
      },
      {
        id: 'dataValidation',
        label: 'Validate & Clean Data',
        icon: 'WrenchIcon',
        color: 'bg-orange-500',
        modalType: 'dataValidation'
      }
    ];
  }

  getBankConnectionButtons(): Array<{
    id: string;
    label: string;
    icon: string;
    modalType: ModalType;
  }> {
    return [
      {
        id: 'connections',
        label: 'Manage Bank Connections',
        icon: 'Building2Icon',
        modalType: 'bankConnections'
      },
      {
        id: 'apiKeys',
        label: 'Configure API Keys',
        icon: 'KeyIcon',
        modalType: 'bankAPISettings'
      }
    ];
  }
}

export const dataManagementService = new DataManagementService();