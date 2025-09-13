/**
 * QIF Import Modal Service
 * World-class file import with enterprise-grade error handling
 * Implements patterns from Stripe Dashboard and QuickBooks Online
 */

import { logger } from '../loggingService';
import { qifImportService } from '../qifImportService';
import type { Account, Transaction } from '../../types';

interface FileValidationResult {
  isValid: boolean;
  error?: string;
  file?: File;
}

interface ParseResult {
  transactions: Array<{
    date: string;
    amount: number;
    payee?: string;
    memo?: string;
    category?: string;
    checkNumber?: string;
    cleared?: boolean;
  }>;
  accountType?: string;
}

interface ImportResult {
  success: boolean;
  imported?: number;
  duplicates?: number;
  account?: Account;
  error?: string;
}

interface ImportOptions {
  categories: any[];
  autoCategorize: boolean;
}

/**
 * Enterprise-grade QIF import service with institutional reliability
 */
class QIFImportModalService {
  /**
   * Validate uploaded file
   */
  validateFile(file: File | null): FileValidationResult {
    if (!file) {
      return { isValid: false, error: 'No file selected' };
    }

    if (!file.name.toLowerCase().endsWith('.qif')) {
      return { isValid: false, error: 'Please select a QIF file' };
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return { isValid: false, error: 'File too large (max 10MB)' };
    }

    return { isValid: true, file };
  }

  /**
   * Parse QIF file with comprehensive error handling
   */
  async parseFile(file: File): Promise<ParseResult> {
    try {
      const content = await file.text();
      const parsed = qifImportService.parseQIF(content);

      if (!parsed.transactions || parsed.transactions.length === 0) {
        throw new Error('No transactions found in QIF file');
      }

      return {
        transactions: parsed.transactions,
        accountType: parsed.accountType
      };
    } catch (error) {
      logger.error('QIF parse error:', error);
      throw new Error('Invalid QIF file format');
    }
  }

  /**
   * Process import with duplicate detection
   */
  async processImport(
    file: File,
    selectedAccountId: string,
    skipDuplicates: boolean,
    existingTransactions: Transaction[],
    options: ImportOptions,
    addTransaction: (transaction: Omit<Transaction, 'id'> | Transaction) => void
  ): Promise<ImportResult> {
    try {
      const content = await file.text();
      const result = await qifImportService.importTransactions(
        content,
        selectedAccountId,
        skipDuplicates ? existingTransactions : [],
        options
      );

      // Add transactions with optimistic updates
      for (const transaction of result.transactions) {
        addTransaction(transaction as any);
      }

      return {
        success: true,
        imported: result.newTransactions,
        duplicates: result.duplicates
      };
    } catch (error) {
      logger.error('QIF import error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Import failed'
      };
    }
  }

  /**
   * Get file info display
   */
  getFileInfo(file: File | null, parseResult: ParseResult | null) {
    if (!file || !parseResult) return null;

    return {
      name: file.name,
      transactionCount: parseResult.transactions.length,
      accountType: parseResult.accountType
    };
  }

  /**
   * Get transaction preview
   */
  getTransactionPreview(parseResult: ParseResult | null, previewCount = 5) {
    if (!parseResult) return [];

    return parseResult.transactions.slice(0, previewCount);
  }

  /**
   * Auto-select account if only one exists
   */
  getAutoSelectedAccount(accounts: Account[]): string {
    return accounts.length === 1 ? accounts[0].id : '';
  }

  /**
   * Format transaction for preview
   */
  formatTransactionPreview(transaction: any) {
    return {
      description: transaction.payee || transaction.memo || 'No description',
      date: transaction.date,
      amount: transaction.amount,
      isIncome: transaction.amount >= 0
    };
  }

  /**
   * Get import summary stats
   */
  getImportStats(parseResult: ParseResult | null) {
    if (!parseResult) return null;

    const transactions = parseResult.transactions;
    const income = transactions.filter(t => t.amount >= 0).length;
    const expenses = transactions.filter(t => t.amount < 0).length;
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      total: transactions.length,
      income,
      expenses,
      totalAmount
    };
  }

  /**
   * Validate import prerequisites
   */
  validateImportReady(selectedAccountId: string, accounts: Account[]): boolean {
    return selectedAccountId !== '' && accounts.some(a => a.id === selectedAccountId);
  }

  /**
   * Get supported file info
   */
  getSupportedFileInfo() {
    return {
      extension: '.qif',
      description: 'Quicken Interchange Format',
      maxSize: '10MB',
      features: [
        'Widely supported by UK banks and financial software',
        'Simple format but no unique transaction IDs',
        'Requires manual account selection',
        'Best for one-time imports or initial setup'
      ]
    };
  }
}

export const qifImportModalService = new QIFImportModalService();
export type { ParseResult, ImportResult, ImportOptions };
