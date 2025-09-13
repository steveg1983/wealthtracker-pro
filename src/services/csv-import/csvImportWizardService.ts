import { enhancedCsvImportService, type ColumnMapping, type ImportProfile, type ImportResult } from '../enhancedCsvImportService';
import { logger } from '../loggingService';
import type { Transaction, Account, Category } from '../../types';

export interface WizardState {
  currentStep: 'upload' | 'mapping' | 'preview' | 'result';
  csvContent: string;
  headers: string[];
  data: string[][];
  mappings: ColumnMapping[];
  selectedProfile: ImportProfile | null;
  isProcessing: boolean;
  importResult: ImportResult | null;
  showDuplicates: boolean;
  duplicateThreshold: number;
  error: string | null;
}

export interface ProcessImportOptions {
  type: 'transaction' | 'account';
  accounts?: Account[];
  categories?: Category[];
  addTransaction?: (transaction: Transaction) => Promise<void>;
  addAccount?: (account: Account) => Promise<void>;
  showDuplicates?: boolean;
  duplicateThreshold?: number;
}

export class CSVImportWizardService {
  /**
   * Initialize wizard state with validation
   */
  static validateInitialization(type: 'transaction' | 'account', accounts?: Account[], categories?: Category[]): string | null {
    try {
      logger.info('Validating CSV import wizard initialization', {
        type,
        accountsCount: accounts?.length || 0,
        categoriesCount: categories?.length || 0,
        componentName: 'CSVImportWizardService'
      });
      
      if (!accounts || accounts.length === 0) {
        logger.warn('No accounts available for import', { type, componentName: 'CSVImportWizardService' });
        if (type === 'transaction') {
          return 'No accounts available. Please add accounts before importing transactions.';
        }
      }
      
      return null;
    } catch (error) {
      logger.error('CSV import wizard initialization failed:', error, 'CSVImportWizardService');
      return 'Failed to initialize import wizard. Please try again.';
    }
  }

  /**
   * Get saved import profiles
   */
  static getProfiles(type: 'transaction' | 'account'): ImportProfile[] {
    try {
      return enhancedCsvImportService.getProfiles(type);
    } catch (error) {
      logger.error('Failed to load import profiles:', error, 'CSVImportWizardService');
      return [];
    }
  }

  /**
   * Process uploaded CSV file
   */
  static processUploadedFile(
    content: string,
    parsedHeaders: string[],
    parsedData: string[][],
    type: 'transaction' | 'account'
  ): { mappings: ColumnMapping[] } {
    logger.debug('Processing uploaded file', {
      contentLength: content.length,
      headersCount: parsedHeaders.length,
      rowsCount: parsedData.length,
      type,
      componentName: 'CSVImportWizardService'
    });
    
    if (!content || content.trim().length === 0) {
      throw new Error('File content is empty');
    }
    
    if (!parsedHeaders || parsedHeaders.length === 0) {
      throw new Error('No headers found in CSV file');
    }
    
    if (!parsedData || parsedData.length === 0) {
      throw new Error('No data rows found in CSV file');
    }
    
    // Auto-suggest mappings
    const suggestedMappings = enhancedCsvImportService.suggestMappings(parsedHeaders, type);
    if (!suggestedMappings) {
      throw new Error('Failed to generate column mappings');
    }
    
    logger.info('File processed successfully', {
      headersCount: parsedHeaders.length,
      rowsCount: parsedData.length,
      mappingsCount: suggestedMappings.length,
      componentName: 'CSVImportWizardService'
    });

    return { mappings: suggestedMappings };
  }

  /**
   * Auto-detect column mappings
   */
  static autoDetectMappings(headers: string[], type: 'transaction' | 'account'): ColumnMapping[] {
    if (!headers || headers.length === 0) {
      throw new Error('No headers available for auto-detection');
    }
    
    logger.debug('Auto-detecting mappings', { headersCount: headers.length, type, componentName: 'CSVImportWizardService' });
    
    const suggestedMappings = enhancedCsvImportService.suggestMappings(headers, type);
    
    if (!suggestedMappings) {
      throw new Error('Failed to generate suggested mappings');
    }
    
    logger.info('Mappings auto-detected successfully', { mappingsCount: suggestedMappings.length, componentName: 'CSVImportWizardService' });
    return suggestedMappings;
  }

  /**
   * Save import profile
   */
  static saveProfile(type: 'transaction' | 'account', mappings: ColumnMapping[], profileName: string): ImportProfile {
    if (!profileName || profileName.trim().length === 0) {
      throw new Error('Profile name is required');
    }
    
    if (!mappings || mappings.length === 0) {
      throw new Error('No mappings to save');
    }
    
    logger.debug('Saving import profile', { profileName, mappingsCount: mappings.length, type, componentName: 'CSVImportWizardService' });

    const profile: ImportProfile = {
      id: `profile-${Date.now()}`,
      name: profileName.trim(),
      type,
      mappings,
      lastUsed: new Date()
    };

    enhancedCsvImportService.saveProfile(profile);
    
    logger.info('Profile saved successfully', { profileName, profileId: profile.id, componentName: 'CSVImportWizardService' });
    return profile;
  }

  /**
   * Process import with comprehensive error handling
   */
  static async processImport(
    csvContent: string,
    mappings: ColumnMapping[],
    data: string[][],
    options: ProcessImportOptions
  ): Promise<ImportResult> {
    const { type, accounts, categories, addTransaction, addAccount, showDuplicates = true, duplicateThreshold = 90 } = options;
    
    logger.debug('Starting import process', {
      type,
      csvContentLength: csvContent.length,
      mappingsCount: mappings.length,
      showDuplicates,
      duplicateThreshold,
      componentName: 'CSVImportWizardService'
    });
    
    // Validate preconditions
    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error('No CSV content to import');
    }
    
    if (!mappings || mappings.length === 0) {
      throw new Error('No column mappings defined');
    }
    
    if (!data || data.length === 0) {
      throw new Error('No data rows to import');
    }
    
    if (type === 'transaction') {
      return await CSVImportWizardService.processTransactionImport(
        csvContent,
        mappings,
        data,
        accounts!,
        categories,
        addTransaction!,
        { showDuplicates, duplicateThreshold }
      );
    } else {
      return await CSVImportWizardService.processAccountImport(
        csvContent,
        mappings,
        data,
        addAccount!,
        { showDuplicates, duplicateThreshold }
      );
    }
  }

  /**
   * Process transaction import
   */
  private static async processTransactionImport(
    csvContent: string,
    mappings: ColumnMapping[],
    data: string[][],
    accounts: Account[],
    categories: Category[] | undefined,
    addTransaction: (transaction: Transaction) => Promise<void>,
    options: { showDuplicates: boolean; duplicateThreshold: number }
  ): Promise<ImportResult> {
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available for transaction import');
    }
    
    if (!addTransaction) {
      throw new Error('Transaction service is not available');
    }
    
    const accountMap = new Map(accounts.map(acc => [acc.name, acc.id]));
    
    if (accountMap.size === 0) {
      throw new Error('Failed to create account mapping');
    }
    
    logger.debug('Processing transaction import', {
      accountMapSize: accountMap.size,
      categoriesCount: categories?.length || 0,
      componentName: 'CSVImportWizardService'
    });
    
    const result = await enhancedCsvImportService.importCsv(
      csvContent,
      mappings,
      'transaction'
    );
    
    if (!result) {
      throw new Error('Import service returned invalid result');
    }
    
    // Add transactions with individual error handling
    let addedCount = 0;
    const addErrors: string[] = [];
    
    for (let i = 0; i < (result.items || []).length; i++) {
      try {
        const transaction = result.items[i] as Transaction;
        await addTransaction(transaction);
        addedCount++;
      } catch (error) {
        logger.error(`Failed to add transaction ${i + 1}:`, error, 'CSVImportWizardService');
        addErrors.push(`Transaction ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    logger.info('Transaction import completed', {
      totalProcessed: result.success + result.failed + result.duplicates,
      successful: result.success,
      addedToApp: addedCount,
      addErrors: addErrors.length,
      componentName: 'CSVImportWizardService'
    });
    
    // Update result with any additional errors
    if (addErrors.length > 0) {
      result.errors.push(...addErrors.map((msg, idx) => ({
        row: idx,
        error: msg
      })));
      result.failed += addErrors.length;
      result.success = Math.max(0, result.success - addErrors.length);
    }
    
    return result;
  }

  /**
   * Process account import
   */
  private static async processAccountImport(
    csvContent: string,
    mappings: ColumnMapping[],
    data: string[][],
    addAccount: (account: Account) => Promise<void>,
    options: { showDuplicates: boolean; duplicateThreshold: number }
  ): Promise<ImportResult> {
    if (!addAccount) {
      throw new Error('Account service is not available');
    }
    
    logger.debug('Processing account import', { componentName: 'CSVImportWizardService' });
    
    const result = await enhancedCsvImportService.importCsv(
      csvContent,
      mappings,
      'account'
    );
    
    if (!result) {
      throw new Error('Import service returned invalid result');
    }
    
    // Add accounts with individual error handling
    let addedCount = 0;
    const addErrors: string[] = [];
    
    for (let i = 0; i < (result.items || []).length; i++) {
      try {
        const account = result.items![i];
        await addAccount(account as any);
        addedCount++;
      } catch (error) {
        logger.error(`Failed to add account ${i + 1}:`, error, 'CSVImportWizardService');
        addErrors.push(`Account ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    logger.info('Account import completed', {
      totalProcessed: result.items?.length || 0,
      successful: result.success,
      addedToApp: addedCount,
      addErrors: addErrors.length,
      componentName: 'CSVImportWizardService'
    });
    
    // Update result with any additional errors
    if (addErrors.length > 0) {
      result.errors.push(...addErrors.map((msg, idx) => ({
        row: idx,
        error: msg
      })));
      result.failed += addErrors.length;
      result.success = Math.max(0, result.success - addErrors.length);
    }
    
    return result;
  }

  /**
   * Export import report
   */
  static exportReport(importResult: ImportResult, type: 'transaction' | 'account'): void {
    if (!importResult) {
      logger.warn('No import result available for export', { componentName: 'CSVImportWizardService' });
      return;
    }
    
    logger.debug('Exporting import report', { componentName: 'CSVImportWizardService' });
    
    const report = [
      `Import Report - ${new Date().toLocaleString()}`,
      '',
      `Type: ${type}`,
      `Total Rows: ${importResult.success + importResult.failed + importResult.duplicates}`,
      `Successfully Imported: ${importResult.success}`,
      `Duplicates Skipped: ${importResult.duplicates}`,
      `Failed: ${importResult.failed}`,
      '',
      'Errors:',
      ...importResult.errors.map(e => `Row ${e.row}: ${e.error}`)
    ].join('\n');
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    logger.info('Import report exported successfully', { componentName: 'CSVImportWizardService' });
  }

  /**
   * Generate appropriate error message based on error type
   */
  static getErrorMessage(error: Error, dataLength: number): { message: string; result: ImportResult } {
    let errorMessage = 'Import failed. Please check your data and try again.';
    
    if (error.message.includes('account')) {
      errorMessage = 'Account-related error: ' + error.message;
    } else if (error.message.includes('mapping')) {
      errorMessage = 'Column mapping error: ' + error.message;
    } else if (error.message.includes('CSV') || error.message.includes('content')) {
      errorMessage = 'File format error: ' + error.message;
    } else if (error.message.includes('service')) {
      errorMessage = 'Service error: ' + error.message;
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    }
    
    const result: ImportResult = {
      success: 0,
      failed: dataLength,
      duplicates: 0,
      items: [],
      errors: [{
        row: 0,
        error: errorMessage
      }]
    };

    return { message: errorMessage, result };
  }
}