/**
 * OFX Import Modal Service
 * Handles OFX file parsing and import logic
 */

import { ofxImportService } from './ofxImportService';
import { lazyLogger as logger } from './serviceFactory';
import type { Account, Transaction, Category } from '../types';

export interface ParseResult {
  transactions: any[];
  matchedAccount?: Account;
  unmatchedAccount?: { accountId: string; bankId?: string };
  duplicates: number;
}

export interface ImportResult {
  success: boolean;
  imported?: number;
  duplicates?: number;
  account?: Account;
  error?: string;
}

export interface ImportOptions {
  accountId?: string;
  skipDuplicates: boolean;
  categories: Category[];
  autoCategorize: boolean;
}

class OFXImportModalService {
  /**
   * Validate OFX file
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    if (!file.name.toLowerCase().endsWith('.ofx')) {
      return { isValid: false, error: 'Please select an OFX file' };
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return { isValid: false, error: 'File size exceeds 10MB limit' };
    }
    
    return { isValid: true };
  }

  /**
   * Parse OFX file content
   */
  async parseOFXFile(
    file: File,
    accounts: Account[],
    transactions: Transaction[],
    categories: Category[]
  ): Promise<ParseResult> {
    try {
      const content = await file.text();
      const result = await ofxImportService.importTransactions(
        content,
        accounts,
        transactions,
        { 
          skipDuplicates: false,
          categories,
          autoCategorize: true
        }
      );
      
      return {
        transactions: result.transactions,
        matchedAccount: result.matchedAccount || undefined,
        unmatchedAccount: result.unmatchedAccount,
        duplicates: result.duplicates || 0
      };
    } catch (error) {
      logger.error('Error parsing OFX file:', error);
      throw new Error('Error parsing OFX file. Please check the file format.');
    }
  }

  /**
   * Process the import of parsed transactions
   */
  async processImport(
    file: File,
    parseResult: ParseResult,
    accounts: Account[],
    transactions: Transaction[],
    options: ImportOptions,
    addTransaction: (transaction: Omit<Transaction, 'id'> | Transaction) => void
  ): Promise<ImportResult> {
    try {
      const content = await file.text();
      const result = await ofxImportService.importTransactions(
        content,
        accounts,
        transactions,
        {
          accountId: options.accountId,
          skipDuplicates: options.skipDuplicates,
          categories: options.categories,
          autoCategorize: options.autoCategorize
        }
      );
      
      // Add transactions
      for (const transaction of result.transactions) {
        addTransaction(transaction as any);
      }
      
      const account = result.matchedAccount || 
                     accounts.find(a => a.id === options.accountId);
      
      return {
        success: true,
        imported: result.newTransactions,
        duplicates: result.duplicates,
        account
      };
    } catch (error) {
      logger.error('Import error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Import failed'
      };
    }
  }

  /**
   * Get account display info
   */
  getAccountInfo(parseResult: ParseResult): {
    hasMatch: boolean;
    matchedAccountName?: string;
    unmatchedInfo?: string;
  } {
    if (parseResult.matchedAccount) {
      return {
        hasMatch: true,
        matchedAccountName: parseResult.matchedAccount.name
      };
    }
    
    if (parseResult.unmatchedAccount) {
      const { accountId, bankId } = parseResult.unmatchedAccount;
      let info = `****${accountId.slice(-4)}`;
      if (bankId) {
        info += ` (Sort code: ${bankId.slice(-6)})`;
      }
      return {
        hasMatch: false,
        unmatchedInfo: info
      };
    }
    
    return { hasMatch: false };
  }

  /**
   * Check if a file is a valid OFX file
   */
  isValidOFXFile(filename: string): boolean {
    return filename.toLowerCase().endsWith('.ofx');
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format account info for display
   */
  formatAccountInfo(accountInfo: any): any {
    if (!accountInfo) return null;
    return {
      bankId: accountInfo.bankId,
      accountId: accountInfo.accountId,
      accountType: accountInfo.accountType
    };
  }

  /**
   * Format import summary
   */
  formatImportSummary(importResult: ImportResult): {
    title: string;
    message: string;
    type: 'success' | 'error';
  } {
    if (importResult.success) {
      return {
        title: 'Import Successful!',
        message: `Imported ${importResult.imported} transactions to ${importResult.account?.name}`,
        type: 'success'
      };
    }
    
    return {
      title: 'Import Failed',
      message: importResult.error || 'Unknown error occurred',
      type: 'error'
    };
  }

  /**
   * Calculate duplicate transactions
   */
  calculateDuplicates(transactions: any[]): number {
    // TODO: Implement actual duplicate detection
    return 0;
  }

  /**
   * Get date range from transactions
   */
  getDateRange(transactions: any[]): { start: Date | null; end: Date | null } {
    if (!transactions || transactions.length === 0) {
      return { start: null, end: null };
    }
    
    const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
    return {
      start: dates[0],
      end: dates[dates.length - 1]
    };
  }

  /**
   * Check if account selection is valid
   */
  isValidAccountSelection(selectedAccountId: string, parseResult: ParseResult | null): boolean {
    if (!parseResult) return false;
    if (parseResult.matchedAccount) return true;
    return Boolean(selectedAccountId && selectedAccountId.length > 0);
  }
}

export const ofxImportModalService = new OFXImportModalService();
