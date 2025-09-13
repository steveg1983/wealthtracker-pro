/**
 * Migration Wizard Service
 * Handles data migration configuration and processing
 */

import type { 
  CreditCardIcon,
  TrendingUpIcon,
  UsersIcon,
  ShieldIcon,
  FileTextIcon,
  DatabaseIcon
} from '../components/icons';

export type MigrationSource = 'mint' | 'quicken' | 'ynab' | 'personalcapital' | 'excel' | 'csv' | 'other';

export interface MigrationStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

export interface MigrationSourceConfig {
  id: MigrationSource;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  fileTypes: string[];
  instructions: string;
}

export interface MappedData {
  accounts: number;
  transactions: number;
  categories: number;
  dateRange: string;
}

export class MigrationWizardService {
  /**
   * Get migration steps configuration
   */
  getMigrationSteps(): MigrationStep[] {
    // Import dynamically to avoid circular dependency
    const { Database, Upload, ArrowRight, CheckCircle, Zap } = require('../components/icons');
    
    return [
      {
        id: 1,
        title: 'Select Source',
        description: 'Choose where you\'re migrating from',
        icon: Database
      },
      {
        id: 2,
        title: 'Upload Data',
        description: 'Upload your exported data files',
        icon: Upload
      },
      {
        id: 3,
        title: 'Map Fields',
        description: 'Review and map data fields',
        icon: ArrowRight
      },
      {
        id: 4,
        title: 'Review',
        description: 'Preview your imported data',
        icon: CheckCircle
      },
      {
        id: 5,
        title: 'Import',
        description: 'Complete the migration',
        icon: Zap
      }
    ];
  }

  /**
   * Get migration sources configuration
   */
  getMigrationSources(): MigrationSourceConfig[] {
    // Import dynamically to avoid circular dependency
    const { CreditCard, TrendingUp, Users, Shield, FileText, Database } = require('../components/icons');
    
    return [
      {
        id: 'mint',
        name: 'Mint',
        description: 'Import from Intuit Mint',
        icon: CreditCard,
        color: 'bg-green-500',
        fileTypes: ['.csv'],
        instructions: 'Export your data from Mint as CSV files before it shuts down.'
      },
      {
        id: 'quicken',
        name: 'Quicken',
        description: 'Import from Quicken',
        icon: TrendingUp,
        color: 'bg-gray-500',
        fileTypes: ['.qif', '.qfx'],
        instructions: 'Export your Quicken data as QIF or QFX files.'
      },
      {
        id: 'ynab',
        name: 'YNAB',
        description: 'You Need A Budget',
        icon: Users,
        color: 'bg-purple-500',
        fileTypes: ['.csv'],
        instructions: 'Export your YNAB data from Account Settings > Export.'
      },
      {
        id: 'personalcapital',
        name: 'Personal Capital',
        description: 'Import from Personal Capital',
        icon: Shield,
        color: 'bg-indigo-500',
        fileTypes: ['.csv'],
        instructions: 'Download your transaction history as CSV from Personal Capital.'
      },
      {
        id: 'excel',
        name: 'Excel',
        description: 'Import from Excel spreadsheet',
        icon: FileText,
        color: 'bg-orange-500',
        fileTypes: ['.xlsx', '.xls'],
        instructions: 'Upload your Excel file with transaction data.'
      },
      {
        id: 'csv',
        name: 'CSV',
        description: 'Generic CSV import',
        icon: Database,
        color: 'bg-gray-500',
        fileTypes: ['.csv'],
        instructions: 'Upload any CSV file with financial data.'
      }
    ];
  }

  /**
   * Get accept configuration for file dropzone
   */
  getAcceptConfig(source: MigrationSource | null) {
    if (!source) return undefined;
    
    const sourceConfig = this.getMigrationSources().find(s => s.id === source);
    if (!sourceConfig) return undefined;

    return sourceConfig.fileTypes.reduce((acc, type) => ({
      ...acc,
      [type === '.csv' ? 'text/csv' : 
       type === '.xlsx' || type === '.xls' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
       type === '.qif' || type === '.qfx' ? 'application/x-qw' : 'text/plain']: [type]
    }), {});
  }

  /**
   * Process uploaded files (simulation)
   */
  async processFiles(files: File[]): Promise<MappedData> {
    // Simulate file processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In production, this would parse the files and extract data
    return {
      accounts: 5,
      transactions: 1234,
      categories: 15,
      dateRange: '2020-01-01 to 2024-01-01'
    };
  }

  /**
   * Complete migration (simulation)
   */
  async completeMigration(source: MigrationSource, files: File[], data: MappedData): Promise<void> {
    // Simulate migration completion
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // In production, this would import the data into the database
    return;
  }
}

export const migrationWizardService = new MigrationWizardService();