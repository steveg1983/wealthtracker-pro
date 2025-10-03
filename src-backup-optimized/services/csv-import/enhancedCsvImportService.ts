import { toDecimal } from '../../utils/decimal';
import { smartCategorizationService } from '../smartCategorizationService';
import { importRulesService } from '../importRulesService';
import { lazyLogger as logger } from '../serviceFactory';
import { csvParser } from './csvParser';
import { columnMapper } from './columnMapper';
import { dateParser } from './dateParser';
import { amountParser } from './amountParser';
import { duplicateChecker } from './duplicateChecker';
import { profileManager } from './profileManager';
import type {
  ImportProfile,
  ImportResult,
  ValidationOptions,
  ImportStatistics,
  ParsedCsvData,
  ColumnMapping
} from './types';
import type { Transaction, Account, Category } from '../../types';

/**
 * Enhanced CSV import service
 * Orchestrates the CSV import process with intelligent mapping and validation
 */
class EnhancedCsvImportService {
  /**
   * Import CSV file with full processing pipeline
   */
  async importCsv(
    content: string,
    type: 'transaction' | 'account',
    options: ValidationOptions = {},
    existingData: Transaction[] | Account[] = [],
    categories: Category[] = []
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      success: 0,
      failed: 0,
      duplicates: 0,
      items: [],
      errors: []
    };

    try {
      // Parse CSV
      const parsed = csvParser.parseCSV(content);
      if (!csvParser.validateStructure(parsed)) {
        throw new Error('Invalid CSV structure');
      }

      // Normalize data
      const normalized = csvParser.normalizeData(parsed);

      // Get or suggest mappings
      const mappings = columnMapper.suggestMappings(normalized.headers, type);
      if (mappings.length === 0) {
        throw new Error('Could not determine column mappings');
      }

      // Process each row
      for (let rowIndex = 0; rowIndex < normalized.data.length; rowIndex++) {
        try {
          const row = normalized.data[rowIndex];
          const item = await this.processRow(
            row,
            normalized.headers,
            mappings,
            type,
            options,
            existingData as Transaction[],
            categories
          );

          if (item) {
            result.items.push(item);
            result.success++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push({
            row: rowIndex + 2, // +2 for header and 1-based index
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info(`CSV import completed in ${processingTime}ms`, {
        success: result.success,
        failed: result.failed,
        duplicates: result.duplicates
      });

      return result;
    } catch (error) {
      logger.error('CSV import failed:', error);
      throw error;
    }
  }

  /**
   * Process a single row
   */
  private async processRow(
    row: string[],
    headers: string[],
    mappings: ColumnMapping[],
    type: 'transaction' | 'account',
    options: ValidationOptions,
    existingData: Transaction[],
    categories: Category[]
  ): Promise<Partial<Transaction> | Partial<Account> | null> {
    const item: any = {
      id: crypto.randomUUID()
    };

    // Apply mappings
    for (const mapping of mappings) {
      const columnIndex = headers.indexOf(mapping.sourceColumn.toLowerCase());
      if (columnIndex >= 0) {
        const value = row[columnIndex];
        if (value && value.trim() !== '') {
          const transformedValue = mapping.transform ? 
            mapping.transform(value) : 
            value;
          
          // Type-safe assignment
          (item as Record<string, unknown>)[mapping.targetField] = transformedValue;
        }
      }
    }

    // Type-specific processing
    if (type === 'transaction') {
      return this.processTransaction(item as Partial<Transaction>, options, existingData, categories);
    } else {
      return this.processAccount(item as Partial<Account>, options);
    }
  }

  /**
   * Process transaction with validation and enhancement
   */
  private async processTransaction(
    transaction: Partial<Transaction>,
    options: ValidationOptions,
    existingTransactions: Transaction[],
    categories: Category[]
  ): Promise<Partial<Transaction> | null> {
    // Validate required fields
    if (!transaction.date || transaction.amount === undefined) {
      throw new Error('Missing required fields: date or amount');
    }

    // Check for duplicates
    if (options.checkDuplicates) {
      const duplicateResult = duplicateChecker.checkDuplicate(
        transaction,
        existingTransactions
      );
      
      if (duplicateResult.isDuplicate && duplicateResult.confidence > 90) {
        logger.info(`Skipping duplicate transaction: ${transaction.description}`);
        return null;
      }
    }

    // Apply import rules
    if (options.applyRules) {
      const result = importRulesService.applyRules(transaction);
      if (result === null) {
        return null; // Skip this transaction
      }
      transaction = result;
    }

    // Smart categorization
    if (options.smartCategorization && !transaction.category) {
      const categoryId = smartCategorizationService.categorizeTransaction(
        transaction as Transaction
      );
      if (categoryId) {
        transaction.category = categoryId;
      }
    }

    return transaction;
  }

  /**
   * Process account with validation
   */
  private processAccount(
    account: Partial<Account>,
    options: ValidationOptions
  ): Partial<Account> {
    // Validate required fields
    if (!account.name) {
      throw new Error('Missing required field: name');
    }

    // Set defaults
    account.type = account.type || 'checking';
    account.balance = account.balance || 0;
    account.currency = account.currency || 'USD';

    return account;
  }

  /**
   * Get import statistics
   */
  async getImportStatistics(
    result: ImportResult,
    processingTime: number
  ): Promise<ImportStatistics> {
    const transactions = result.items.filter(item => 'amount' in item);
    const categorized = transactions.filter(t => 'category' in t && t.category).length;
    const rulesApplied = 0; // Would need to track this during processing

    return {
      totalRows: result.success + result.failed,
      successfulImports: result.success,
      failedImports: result.failed,
      duplicatesSkipped: result.duplicates,
      categorized,
      rulesApplied,
      averageConfidence: 0,
      processingTimeMs: processingTime
    };
  }

  // Expose sub-services
  profiles = profileManager;
  parser = csvParser;
  mapper = columnMapper;
  dates = dateParser;
  amounts = amountParser;
  duplicates = duplicateChecker;

  /**
   * Convenience: parse CSV content
   */
  parseCSV(content: string) {
    return this.parser.parseCSV(content);
  }

  /**
   * Convenience: get bank-specific default mappings
   */
  getBankMappings(bankName: string) {
    const format = this.profiles.getBankFormats().find(f => f.name === bankName);
    if (!format) return [];
    const mappings: ColumnMapping[] = [];
    mappings.push({ sourceColumn: format.dateColumn, targetField: 'date', transform: (v: string) => this.dates.parseDate(v) });
    mappings.push({ sourceColumn: format.amountColumn, targetField: 'amount', transform: (v: string) => this.amounts.parseAmount(v) });
    mappings.push({ sourceColumn: format.descriptionColumn, targetField: 'description' });
    return mappings;
  }

  /**
   * Generate a lightweight preview from parsed data and mappings
   */
  generatePreview(headers: string[], data: string[][], mappings: ColumnMapping[]) {
    const transactions: Partial<Transaction>[] = [];
    const headerIndex = new Map(headers.map((h, i) => [h.toLowerCase(), i]));
    for (const row of data) {
      const item: Record<string, unknown> = {};
      for (const m of mappings) {
        const idx = headerIndex.get(m.sourceColumn.toLowerCase());
        if (idx !== undefined && idx >= 0) {
          const raw = row[idx] ?? '';
          item[m.targetField] = m.transform ? m.transform(String(raw)) : raw;
        }
      }
      transactions.push(item as Partial<Transaction>);
    }
    return { transactions };
  }
}

export const enhancedCsvImportService = new EnhancedCsvImportService();
