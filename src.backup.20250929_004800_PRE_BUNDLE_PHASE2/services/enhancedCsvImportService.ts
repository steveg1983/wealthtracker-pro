import { toDecimal } from '../utils/decimal';
import type { Transaction, Account, Category } from '../types';
import type { DecimalInstance } from '../types/decimal-types';
import { smartCategorizationService } from './smartCategorizationService';
import { importRulesService } from './importRulesService';
import type { JsonValue } from '../types/common';
import { logger } from './loggingService';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: string) => JsonValue;
}

export interface ImportProfile {
  id: string;
  name: string;
  type: 'transaction' | 'account';
  mappings: ColumnMapping[];
  dateFormat?: string;
  bank?: string;
  lastUsed?: Date;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: number; // 0-100
  matches: Array<{
    id: string;
    field: string;
    similarity: number;
  }>;
}

export interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  items: Array<Partial<Transaction> | Partial<Account>>;
  errors: Array<{
    row: number;
    error: string;
  }>;
  // Additional properties used by CSVImportWizard
  totalRows?: number | undefined;
  successCount?: number | undefined;
  errorCount?: number | undefined;
  importedItems?: Array<Partial<Transaction> | Partial<Account>> | undefined;
}

class EnhancedCsvImportService {
  private profiles: ImportProfile[] = this.loadProfiles();

  /**
   * Parse CSV with intelligent header detection
   */
  parseCSV(content: string): { headers: string[]; data: string[][] } {
    const lines = content.trim().split('\n');
    const rows: string[][] = [];
    
    for (const line of lines) {
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      row.push(current.trim());
      rows.push(row);
    }
    
    // Detect headers (first row with text content)
    const headers = rows[0] || [];
    const data = rows.slice(1);
    
    return { headers, data };
  }

  /**
   * Smart column mapping using fuzzy matching
   */
  suggestMappings(headers: string[], type: 'transaction' | 'account'): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    if (type === 'transaction') {
      // Date mapping
      const datePatterns = ['date', 'transaction date', 'posted', 'trans date', 'value date'];
      const dateIndex = this.findBestMatch(normalizedHeaders, datePatterns);
      if (dateIndex >= 0) {
        const dateHeader = headers[dateIndex];
        if (dateHeader) {
          mappings.push({
            sourceColumn: dateHeader,
            targetField: 'date',
            transform: (value: string) => this.parseDate(value)
          });
        }
      }
      
      // Description mapping
      const descPatterns = ['description', 'desc', 'memo', 'details', 'transaction'];
      const descIndex = this.findBestMatch(normalizedHeaders, descPatterns);
      if (descIndex >= 0) {
        const descHeader = headers[descIndex];
        if (descHeader) {
          mappings.push({
            sourceColumn: descHeader,
            targetField: 'description'
          });
        }
      }
      
      // Amount mapping
      const amountPatterns = ['amount', 'value', 'debit', 'credit', 'charge'];
      const amountIndex = this.findBestMatch(normalizedHeaders, amountPatterns);
      if (amountIndex >= 0) {
        const amountHeader = headers[amountIndex];
        if (amountHeader) {
          mappings.push({
            sourceColumn: amountHeader,
            targetField: 'amount',
            transform: (value: string) => this.parseAmount(value)
          });
        }
      }
      
      // Category mapping
      const categoryPatterns = ['category', 'cat', 'type', 'classification'];
      const categoryIndex = this.findBestMatch(normalizedHeaders, categoryPatterns);
      if (categoryIndex >= 0) {
        const categoryHeader = headers[categoryIndex];
        if (categoryHeader) {
          mappings.push({
            sourceColumn: categoryHeader,
            targetField: 'category'
          });
        }
      }
      
      // Account mapping
      const accountPatterns = ['account', 'acc', 'account name', 'from account'];
      const accountIndex = this.findBestMatch(normalizedHeaders, accountPatterns);
      if (accountIndex >= 0) {
        const accountHeader = headers[accountIndex];
        if (accountHeader) {
          mappings.push({
            sourceColumn: accountHeader,
            targetField: 'accountName'
          });
        }
      }
    } else {
      // Account mappings
      const namePatterns = ['name', 'account name', 'account', 'description'];
      const nameIndex = this.findBestMatch(normalizedHeaders, namePatterns);
      if (nameIndex >= 0) {
        const nameHeader = headers[nameIndex];
        if (nameHeader) {
          mappings.push({
            sourceColumn: nameHeader,
            targetField: 'name'
          });
        }
      }
      
      const balancePatterns = ['balance', 'current balance', 'amount', 'value'];
      const balanceIndex = this.findBestMatch(normalizedHeaders, balancePatterns);
      if (balanceIndex >= 0) {
        const balanceHeader = headers[balanceIndex];
        if (balanceHeader) {
          mappings.push({
            sourceColumn: balanceHeader,
            targetField: 'balance',
            transform: (value: string) => this.parseAmount(value)
          });
        }
      }
      
      const typePatterns = ['type', 'account type', 'category'];
      const typeIndex = this.findBestMatch(normalizedHeaders, typePatterns);
      if (typeIndex >= 0) {
        const typeHeader = headers[typeIndex];
        if (typeHeader) {
          mappings.push({
            sourceColumn: typeHeader,
            targetField: 'type'
          });
        }
      }
    }
    
    return mappings;
  }

  /**
   * Find best matching header using fuzzy search
   */
  private findBestMatch(headers: string[], patterns: string[]): number {
    let bestIndex = -1;
    let bestScore = 0;
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      for (const pattern of patterns) {
        const score = this.calculateSimilarity(header || '', pattern.toLowerCase());
        if (score > bestScore && score > 0.6) { // 60% similarity threshold
          bestScore = score;
          bestIndex = i;
        }
      }
    }
    
    return bestIndex;
  }

  /**
   * Calculate string similarity (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      const row = matrix[0];
      if (row) {
        row[j] = j;
      }
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const currentRow = matrix[i];
        const prevRow = matrix[i - 1];
        const prevCell = currentRow?.[j - 1];

        if (!currentRow || !prevRow || prevCell === undefined) continue;

        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          currentRow[j] = prevRow[j - 1] || 0;
        } else {
          currentRow[j] = Math.min(
            (prevRow[j - 1] || 0) + 1, // substitution
            (prevCell) + 1,            // insertion
            (prevRow[j] || 0) + 1      // deletion
          );
        }
      }
    }
    
    const finalRow = matrix[str2.length];
    return finalRow?.[str1.length] || 0;
  }

  /**
   * Parse date with multiple format support
   */
  private parseDate(value: string): string {
    // First, try standard Date parsing
    let date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0] || '';
    }
    
    // Try DD/MM/YYYY format (common in UK)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/');
      if (day && month && year) {
        date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0] || '';
        }
      }
    }
    
    // Try DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
      const [day, month, year] = value.split('-');
      if (day && month && year) {
        date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0] || '';
        }
      }
    }
    
    // Try MM/DD/YYYY format (US format)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [month, day, year] = value.split('/');
      if (month && day && year) {
        date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0] || '';
        }
      }
    }
    
    // Default to today if parsing fails
    logger.warn(`Cannot parse date: ${value}, using today's date`);
    return new Date().toISOString().split('T')[0] || '';
  }

  /**
   * Parse amount with currency symbol handling
   */
  private parseAmount(value: string): number {
    // Remove currency symbols and spaces
    const cleaned = value.replace(/[£$€¥,\s]/g, '');
    
    // Handle parentheses for negative amounts
    const isNegative = cleaned.startsWith('(') || cleaned.startsWith('-');
    const amount = Math.abs(parseFloat(cleaned.replace(/[()]/g, '')));
    
    return isNegative ? -amount : amount;
  }

  private assignTransactionField(
    transaction: Partial<Transaction>,
    field: string,
    value: JsonValue | string
  ): void {
    if (value === null || value === undefined) {
      return;
    }

    const stringValue = typeof value === 'string' ? value.trim() : undefined;

    switch (field) {
      case 'description':
        if (stringValue) {
          transaction.description = stringValue;
        }
        break;
      case 'category':
        if (stringValue) {
          transaction.category = stringValue;
        }
        break;
      case 'accountId':
        if (stringValue) {
          transaction.accountId = stringValue;
        }
        break;
      case 'accountName':
        if (stringValue) {
          transaction.accountName = stringValue;
        }
        break;
      case 'notes':
        if (stringValue) {
          transaction.notes = stringValue;
        }
        break;
      case 'merchant':
        if (stringValue) {
          transaction.merchant = stringValue;
        }
        break;
      case 'tags':
        if (Array.isArray(value)) {
          transaction.tags = value.map(item => String(item)).filter(Boolean);
        } else if (stringValue) {
          transaction.tags = stringValue
            .split(/[,;]+/)
            .map(tag => tag.trim())
            .filter(Boolean);
        }
        break;
      case 'cleared':
      case 'pending':
      case 'isRecurring':
      case 'isSplit':
      case 'isImported':
        {
          const booleanValue = this.toBoolean(value);
          if (booleanValue !== undefined) {
            (transaction as Record<string, unknown>)[field] = booleanValue;
          }
        }
        break;
      case 'type':
        if (stringValue) {
          const normalized = stringValue.toLowerCase();
          if (normalized.includes('income') || normalized.includes('credit')) {
            transaction.type = 'income';
          } else if (normalized.includes('transfer')) {
            transaction.type = 'transfer';
          } else if (normalized.includes('expense') || normalized.includes('debit')) {
            transaction.type = 'expense';
          }
        }
        break;
      case 'date':
        if (value instanceof Date) {
          transaction.date = value;
        } else if (stringValue) {
          const parsed = new Date(stringValue);
          if (!Number.isNaN(parsed.getTime())) {
            transaction.date = parsed;
          }
        }
        break;
      case 'goalId':
        if (stringValue) {
          transaction.goalId = stringValue;
        }
        break;
      case 'bankReference':
        if (stringValue) {
          transaction.bankReference = stringValue;
        }
        break;
      case 'paymentChannel':
        if (stringValue) {
          transaction.paymentChannel = stringValue;
        }
        break;
      case 'addedBy':
        if (stringValue) {
          transaction.addedBy = stringValue;
        }
        break;
      case 'linkedTransferId':
        if (stringValue) {
          transaction.linkedTransferId = stringValue;
        }
        break;
      default:
        // Ignore fields we don't recognise to preserve strict typing
        break;
    }
  }

  private toBoolean(value: JsonValue | string): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === 'yes' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === 'no' || normalized === '0') {
        return false;
      }
    }

    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    return undefined;
  }

  /**
   * Check for duplicate transactions
   */
  async checkDuplicateTransaction(
    transaction: Partial<Transaction>,
    existingTransactions: Transaction[]
  ): Promise<DuplicateCheckResult> {
    const matches: DuplicateCheckResult['matches'] = [];
    let highestConfidence = 0;
    
    for (const existing of existingTransactions) {
      // Check date proximity (within 3 days)
      const dateDiff = Math.abs(
        new Date(transaction.date!).getTime() - new Date(existing.date).getTime()
      );
      const dateProximity = dateDiff < 3 * 24 * 60 * 60 * 1000;
      
      if (!dateProximity) continue;
      
      // Check amount similarity
      const amountDiff = Math.abs((transaction.amount || 0) - existing.amount);
      const amountMatch = amountDiff < 0.01;
      
      // Check description similarity
      const descSimilarity = this.calculateSimilarity(
        transaction.description?.toLowerCase() || '',
        existing.description.toLowerCase()
      );
      
      // Calculate overall confidence
      let confidence = 0;
      if (amountMatch) confidence += 40;
      if (dateProximity) confidence += 30;
      if (descSimilarity > 0.8) confidence += 30;
      
      if (confidence >= 70) {
        matches.push({
          id: existing.id,
          field: 'transaction',
          similarity: confidence
        });
        highestConfidence = Math.max(highestConfidence, confidence);
      }
    }
    
    return {
      isDuplicate: highestConfidence >= 90,
      confidence: highestConfidence,
      matches
    };
  }

  /**
   * Import with mapping and duplicate detection
   */
  async importTransactions(
    csvContent: string,
    mappings: ColumnMapping[],
    existingTransactions: Transaction[],
    accountMap: Map<string, string>,
    options: {
      skipDuplicates?: boolean;
      duplicateThreshold?: number;
      categories?: Category[];
      autoCategorize?: boolean;
      categoryConfidenceThreshold?: number;
    } = {}
  ): Promise<ImportResult> {
    const { headers, data } = this.parseCSV(csvContent);
    const result: ImportResult = {
      success: 0,
      failed: 0,
      duplicates: 0,
      items: [],
      errors: []
    };
    
    // Create column index map
    const columnIndices = new Map<string, number>();
    mappings.forEach(mapping => {
      const index = headers.findIndex(h => h === mapping.sourceColumn);
      if (index >= 0) {
        columnIndices.set(mapping.targetField, index);
      }
    });
    
    // Process each row
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      if (!row) {
        continue;
      }

      try {
        const transaction: Partial<Transaction> = {
          type: 'expense', // Default
          cleared: false // Default
        };
        
        // Apply mappings
        let debitAmount: number | null = null;
        let creditAmount: number | null = null;
        
        for (const mapping of mappings) {
          const index = columnIndices.get(mapping.targetField);
          if (index === undefined) {
            continue;
          }

          const columnValue = row?.[index];
          if (columnValue === undefined || columnValue === '') {
            continue;
          }

          // Special handling for amount fields
          if (mapping.targetField === 'amount') {
            const parsedAmount = this.parseAmount(columnValue);

            // Check if this is a debit or credit column based on the source column name
            const sourceColumnLower = mapping.sourceColumn.toLowerCase();
            if (sourceColumnLower.includes('debit') || sourceColumnLower.includes('paid out') || sourceColumnLower.includes('money out')) {
              debitAmount = Math.abs(parsedAmount);
            } else if (sourceColumnLower.includes('credit') || sourceColumnLower.includes('paid in') || sourceColumnLower.includes('money in')) {
              creditAmount = Math.abs(parsedAmount);
            } else {
              // Single amount column - use as is
              transaction.amount = parsedAmount;
            }
            continue;
          }

          if (mapping.targetField === 'date' && !mapping.transform) {
            const parsedDateString = this.parseDate(columnValue);
            const parsedDate = new Date(parsedDateString);
            if (!Number.isNaN(parsedDate.getTime())) {
              transaction.date = parsedDate;
            }
            continue;
          }

          const transformedValue = mapping.transform ? mapping.transform(columnValue) : columnValue;
          this.assignTransactionField(transaction, mapping.targetField, transformedValue);
        }
        
        // Handle separate debit/credit columns
        if (debitAmount !== null || creditAmount !== null) {
          if (debitAmount && debitAmount > 0) {
            transaction.amount = debitAmount;
            transaction.type = 'expense';
          } else if (creditAmount && creditAmount > 0) {
            transaction.amount = creditAmount;
            transaction.type = 'income';
          }
        }
        
        // Determine transaction type from amount
        if (transaction.amount && transaction.amount < 0) {
          transaction.type = 'expense';
          transaction.amount = Math.abs(transaction.amount);
        } else if (transaction.amount && transaction.amount > 0) {
          transaction.type = 'income';
        }
        
        // Map account name to ID
        if (transaction.accountName) {
          transaction.accountId = accountMap.get(transaction.accountName as string) || 'default';
          delete transaction.accountName;
        }
        
        // Check for duplicates
        if (options.skipDuplicates !== false) {
          const duplicateCheck = await this.checkDuplicateTransaction(
            transaction,
            existingTransactions
          );
          
          if (duplicateCheck.confidence >= (options.duplicateThreshold || 90)) {
            result.duplicates++;
            continue;
          }
        }
        
        // Auto-categorize if enabled and no category is set
        if (options.autoCategorize && options.categories && !transaction.category) {
          // Train the model if we have existing transactions
          if (existingTransactions.length > 0) {
            smartCategorizationService.learnFromTransactions(existingTransactions, options.categories);
          }
          
          // Get category suggestions
          const suggestions = smartCategorizationService.suggestCategories(transaction as Transaction, 1);

          const topSuggestion = suggestions[0];
          if (topSuggestion) {
            const confidenceThreshold = options.categoryConfidenceThreshold || 0.7;
            if (topSuggestion.confidence >= confidenceThreshold) {
              transaction.category = topSuggestion.categoryId;
            }
          }
        }
        
        // Apply import rules
        const processedTransaction = importRulesService.applyRules(transaction);
        
        // Skip transaction if rules indicate to skip
        if (!processedTransaction) {
          continue;
        }
        
        // Add transaction
        processedTransaction.id = `import-${Date.now()}-${rowIndex}`;
        result.items.push(processedTransaction as Transaction);
        result.success++;
        
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowIndex + 2, // +1 for header, +1 for 1-based indexing
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return result;
  }

  /**
   * Save import profile
   */
  saveProfile(profile: ImportProfile): void {
    const existing = this.profiles.findIndex(p => p.id === profile.id);
    if (existing >= 0) {
      this.profiles[existing] = profile;
    } else {
      this.profiles.push(profile);
    }
    
    this.saveProfiles();
  }

  /**
   * Get saved profiles
   */
  getProfiles(type?: 'transaction' | 'account'): ImportProfile[] {
    if (type) {
      return this.profiles.filter(p => p.type === type);
    }
    return this.profiles;
  }

  /**
   * Load profiles from localStorage
   */
  private loadProfiles(): ImportProfile[] {
    try {
      const saved = localStorage.getItem('csvImportProfiles');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save profiles to localStorage
   */
  private saveProfiles(): void {
    try {
      localStorage.setItem('csvImportProfiles', JSON.stringify(this.profiles));
    } catch (error) {
      logger.error('Failed to save import profiles:', error);
    }
  }

  /**
   * Generate preview of transactions from parsed data
   */
  generatePreview(data: string[][], mappings: ColumnMapping[]): { transactions: Partial<Transaction>[] } {
    const transactions: Partial<Transaction>[] = [];
    
    // Create column index map
    const columnIndices = new Map<string, number>();
    mappings.forEach(mapping => {
      const index = data[0]?.findIndex(h => h === mapping.sourceColumn);
      if (index !== undefined && index >= 0) {
        columnIndices.set(mapping.targetField, index);
      }
    });
    
    // Process first 10 rows as preview
    const previewRows = data.slice(0, 10);
    
    for (let rowIndex = 0; rowIndex < previewRows.length; rowIndex++) {
      const row = previewRows[rowIndex];
      if (!row) {
        continue;
      }

      try {
        const transaction: Partial<Transaction> = {
          type: 'expense', // Default
          cleared: false // Default
        };
        
        // Apply mappings
        for (const mapping of mappings) {
          const index = columnIndices.get(mapping.targetField);
          if (index === undefined) {
            continue;
          }

          const columnValue = row?.[index];
          if (columnValue === undefined || columnValue === '') {
            continue;
          }

          if (mapping.targetField === 'amount' && !mapping.transform) {
            transaction.amount = this.parseAmount(columnValue);
            continue;
          }

          if (mapping.targetField === 'date' && !mapping.transform) {
            const parsedDateString = this.parseDate(columnValue);
            const parsedDate = new Date(parsedDateString);
            if (!Number.isNaN(parsedDate.getTime())) {
              transaction.date = parsedDate;
            }
            continue;
          }

          const transformedValue = mapping.transform ? mapping.transform(columnValue) : columnValue;
          this.assignTransactionField(transaction, mapping.targetField, transformedValue);
        }
        
        // Determine transaction type from amount
        if (transaction.amount && transaction.amount < 0) {
          transaction.type = 'expense';
          transaction.amount = Math.abs(transaction.amount);
        } else if (transaction.amount && transaction.amount > 0) {
          transaction.type = 'income';
        }
        
        // Add transaction
        transaction.id = `preview-${Date.now()}-${rowIndex}`;
        transactions.push(transaction);
        
      } catch (error) {
        logger.warn(`Failed to parse row ${rowIndex}:`, error);
      }
    }
    
    return { transactions };
  }

  /**
   * Get bank-specific mappings
   */
  getBankMappings(bank: string): ColumnMapping[] {
    const bankMappings: Record<string, ColumnMapping[]> = {
      // Major UK Banks
      'barclays': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Subcategory', targetField: 'category' }
      ],
      'hsbc': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' }
      ],
      'lloyds': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Transaction Description', targetField: 'description' },
        { sourceColumn: 'Debit Amount', targetField: 'amount' },
        { sourceColumn: 'Credit Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'natwest': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Type', targetField: 'category' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Value', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'santander': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'halifax': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Transaction Description', targetField: 'description' },
        { sourceColumn: 'Debit Amount', targetField: 'amount' },
        { sourceColumn: 'Credit Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'rbs': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Type', targetField: 'category' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Value', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'tsb': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Transaction Type', targetField: 'category' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Paid In', targetField: 'amount' },
        { sourceColumn: 'Paid Out', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      
      // Building Societies
      'nationwide': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Transaction type', targetField: 'category' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Paid out', targetField: 'amount' },
        { sourceColumn: 'Paid in', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'yorkshire': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'coventry': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit Amount', targetField: 'amount' },
        { sourceColumn: 'Credit Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'skipton': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Transaction Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      
      // Digital/Challenger Banks
      'monzo': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Category', targetField: 'category' },
        { sourceColumn: 'Notes', targetField: 'notes' }
      ],
      'starling': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Counter Party', targetField: 'description' },
        { sourceColumn: 'Reference', targetField: 'notes' },
        { sourceColumn: 'Type', targetField: 'category' },
        { sourceColumn: 'Amount (GBP)', targetField: 'amount' },
        { sourceColumn: 'Balance (GBP)', targetField: 'balance' }
      ],
      'revolut': [
        { sourceColumn: 'Started Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Category', targetField: 'category' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'metro': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Transaction', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      
      // Other Banks
      'first-direct': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'co-op': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Narrative', targetField: 'description' },
        { sourceColumn: 'Debit Amount', targetField: 'amount' },
        { sourceColumn: 'Credit Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'virgin': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debits', targetField: 'amount' },
        { sourceColumn: 'Credits', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'tesco': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Money Out', targetField: 'amount' },
        { sourceColumn: 'Money In', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      
      // International Banks
      'chase': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Type', targetField: 'category' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'bank-of-america': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Running Bal.', targetField: 'balance' }
      ],
      'wells-fargo': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Deposits', targetField: 'amount' },
        { sourceColumn: 'Withdrawals', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'citibank': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'td-bank': [
        { sourceColumn: 'DATE', targetField: 'date' },
        { sourceColumn: 'DESCRIPTION', targetField: 'description' },
        { sourceColumn: 'WITHDRAWALS', targetField: 'amount' },
        { sourceColumn: 'DEPOSITS', targetField: 'amount' },
        { sourceColumn: 'BALANCE', targetField: 'balance' }
      ],
      'anz': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'commonwealth': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'westpac': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Narrative', targetField: 'description' },
        { sourceColumn: 'Debit Amount', targetField: 'amount' },
        { sourceColumn: 'Credit Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'nab': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Transaction Details', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      
      // European Banks
      'deutsche-bank': [
        { sourceColumn: 'Booking date', targetField: 'date' },
        { sourceColumn: 'Transaction Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'bnp-paribas': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Label', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'credit-agricole': [
        { sourceColumn: 'Date Operation', targetField: 'date' },
        { sourceColumn: 'Libelle', targetField: 'description' },
        { sourceColumn: 'Montant', targetField: 'amount' },
        { sourceColumn: 'Solde', targetField: 'balance' }
      ],
      'societe-generale': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Libelle', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Solde', targetField: 'balance' }
      ],
      'ing-bank': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'abn-amro': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'rabobank': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'unicredit': [
        { sourceColumn: 'Data', targetField: 'date' },
        { sourceColumn: 'Descrizione', targetField: 'description' },
        { sourceColumn: 'Importo', targetField: 'amount' },
        { sourceColumn: 'Saldo', targetField: 'balance' }
      ],
      'intesa-sanpaolo': [
        { sourceColumn: 'Data', targetField: 'date' },
        { sourceColumn: 'Causale', targetField: 'description' },
        { sourceColumn: 'Dare', targetField: 'amount' },
        { sourceColumn: 'Avere', targetField: 'amount' },
        { sourceColumn: 'Saldo', targetField: 'balance' }
      ],
      'ing': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance after transaction', targetField: 'balance' }
      ],
      
      // Online Payment Services
      'paypal': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Name', targetField: 'description' },
        { sourceColumn: 'Gross', targetField: 'amount' },
        { sourceColumn: 'Type', targetField: 'category' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'wise': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Currency', targetField: 'currency' },
        { sourceColumn: 'Running Balance', targetField: 'balance' }
      ],
      'stripe': [
        { sourceColumn: 'Created (UTC)', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Currency', targetField: 'currency' },
        { sourceColumn: 'Available Balance', targetField: 'balance' }
      ],
      
      // Asian Banks
      'dbs-bank': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Transaction Description', targetField: 'description' },
        { sourceColumn: 'Withdrawal', targetField: 'amount' },
        { sourceColumn: 'Deposit', targetField: 'amount' },
        { sourceColumn: 'Available Balance', targetField: 'balance' }
      ],
      'ocbc-bank': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Withdrawal Amount', targetField: 'amount' },
        { sourceColumn: 'Deposit Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'uob-bank': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit Amount', targetField: 'amount' },
        { sourceColumn: 'Credit Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'icbc': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'hsbc-asia': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Transaction Description', targetField: 'description' },
        { sourceColumn: 'Debit Amount', targetField: 'amount' },
        { sourceColumn: 'Credit Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      
      // Canadian Banks
      'rbc-royal-bank': [
        { sourceColumn: 'Account Type', targetField: 'accountType' },
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Description 1', targetField: 'description' },
        { sourceColumn: 'CAD$', targetField: 'amount' },
        { sourceColumn: 'USD$', targetField: 'amount' }
      ],
      'td-canada-trust': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'scotiabank': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Withdrawals', targetField: 'amount' },
        { sourceColumn: 'Deposits', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'bmo-bank-of-montreal': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Withdrawal', targetField: 'amount' },
        { sourceColumn: 'Deposit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      
      // Australian Banks
      'commonwealth-bank': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit Amount', targetField: 'amount' },
        { sourceColumn: 'Credit Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'anz-bank': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'nab-bank': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Debit', targetField: 'amount' },
        { sourceColumn: 'Credit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      
      // Cryptocurrency Exchanges
      'coinbase': [
        { sourceColumn: 'Timestamp', targetField: 'date' },
        { sourceColumn: 'Transaction Type', targetField: 'description' },
        { sourceColumn: 'Asset', targetField: 'category' },
        { sourceColumn: 'Quantity Transacted', targetField: 'amount' },
        { sourceColumn: 'Spot Price Currency', targetField: 'currency' }
      ],
      'binance': [
        { sourceColumn: 'Date(UTC)', targetField: 'date' },
        { sourceColumn: 'Market', targetField: 'description' },
        { sourceColumn: 'Type', targetField: 'category' },
        { sourceColumn: 'Price', targetField: 'amount' },
        { sourceColumn: 'Amount', targetField: 'quantity' }
      ],
      'kraken': [
        { sourceColumn: 'time', targetField: 'date' },
        { sourceColumn: 'type', targetField: 'description' },
        { sourceColumn: 'asset', targetField: 'category' },
        { sourceColumn: 'amount', targetField: 'amount' },
        { sourceColumn: 'balance', targetField: 'balance' }
      ],
      
      // Investment Platforms
      'vanguard': [
        { sourceColumn: 'Trade Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Investment Name', targetField: 'category' },
        { sourceColumn: 'Share Price', targetField: 'price' },
        { sourceColumn: 'Shares', targetField: 'quantity' },
        { sourceColumn: 'Principal Amount', targetField: 'amount' }
      ],
      'fidelity': [
        { sourceColumn: 'Run Date', targetField: 'date' },
        { sourceColumn: 'Action', targetField: 'description' },
        { sourceColumn: 'Symbol', targetField: 'category' },
        { sourceColumn: 'Price', targetField: 'price' },
        { sourceColumn: 'Quantity', targetField: 'quantity' },
        { sourceColumn: 'Amount', targetField: 'amount' }
      ],
      'charles-schwab': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Action', targetField: 'description' },
        { sourceColumn: 'Symbol', targetField: 'category' },
        { sourceColumn: 'Price', targetField: 'price' },
        { sourceColumn: 'Quantity', targetField: 'quantity' },
        { sourceColumn: 'Amount', targetField: 'amount' }
      ],
      'etrade': [
        { sourceColumn: 'TransactionDate', targetField: 'date' },
        { sourceColumn: 'TransactionType', targetField: 'description' },
        { sourceColumn: 'Symbol', targetField: 'category' },
        { sourceColumn: 'Quantity', targetField: 'quantity' },
        { sourceColumn: 'Price', targetField: 'price' },
        { sourceColumn: 'Amount', targetField: 'amount' }
      ],
      
      // Generic Formats
      'quickbooks': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ],
      'mint': [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
        { sourceColumn: 'Transaction Type', targetField: 'type' },
        { sourceColumn: 'Category', targetField: 'category' }
      ],
      'wave': [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Withdrawal', targetField: 'amount' },
        { sourceColumn: 'Deposit', targetField: 'amount' },
        { sourceColumn: 'Balance', targetField: 'balance' }
      ]
    };
    
    return bankMappings[bank.toLowerCase()] || [];
  }
}

export const enhancedCsvImportService = new EnhancedCsvImportService();
