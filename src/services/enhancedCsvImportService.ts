import { toDecimal } from '../utils/decimal';
import type { Transaction, Account } from '../types';
import type { DecimalInstance } from '../types/decimal-types';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: string) => any;
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
  items: any[];
  errors: Array<{
    row: number;
    error: string;
  }>;
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
        mappings.push({
          sourceColumn: headers[dateIndex],
          targetField: 'date',
          transform: (value: string) => this.parseDate(value)
        });
      }
      
      // Description mapping
      const descPatterns = ['description', 'desc', 'memo', 'details', 'transaction'];
      const descIndex = this.findBestMatch(normalizedHeaders, descPatterns);
      if (descIndex >= 0) {
        mappings.push({
          sourceColumn: headers[descIndex],
          targetField: 'description'
        });
      }
      
      // Amount mapping
      const amountPatterns = ['amount', 'value', 'debit', 'credit', 'charge'];
      const amountIndex = this.findBestMatch(normalizedHeaders, amountPatterns);
      if (amountIndex >= 0) {
        mappings.push({
          sourceColumn: headers[amountIndex],
          targetField: 'amount',
          transform: (value: string) => this.parseAmount(value)
        });
      }
      
      // Category mapping
      const categoryPatterns = ['category', 'cat', 'type', 'classification'];
      const categoryIndex = this.findBestMatch(normalizedHeaders, categoryPatterns);
      if (categoryIndex >= 0) {
        mappings.push({
          sourceColumn: headers[categoryIndex],
          targetField: 'category'
        });
      }
      
      // Account mapping
      const accountPatterns = ['account', 'acc', 'account name', 'from account'];
      const accountIndex = this.findBestMatch(normalizedHeaders, accountPatterns);
      if (accountIndex >= 0) {
        mappings.push({
          sourceColumn: headers[accountIndex],
          targetField: 'accountName'
        });
      }
    } else {
      // Account mappings
      const namePatterns = ['name', 'account name', 'account', 'description'];
      const nameIndex = this.findBestMatch(normalizedHeaders, namePatterns);
      if (nameIndex >= 0) {
        mappings.push({
          sourceColumn: headers[nameIndex],
          targetField: 'name'
        });
      }
      
      const balancePatterns = ['balance', 'current balance', 'amount', 'value'];
      const balanceIndex = this.findBestMatch(normalizedHeaders, balancePatterns);
      if (balanceIndex >= 0) {
        mappings.push({
          sourceColumn: headers[balanceIndex],
          targetField: 'balance',
          transform: (value: string) => this.parseAmount(value)
        });
      }
      
      const typePatterns = ['type', 'account type', 'category'];
      const typeIndex = this.findBestMatch(normalizedHeaders, typePatterns);
      if (typeIndex >= 0) {
        mappings.push({
          sourceColumn: headers[typeIndex],
          targetField: 'type'
        });
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
        const score = this.calculateSimilarity(header, pattern.toLowerCase());
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
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Parse date with multiple format support
   */
  private parseDate(value: string): string {
    // First, try standard Date parsing
    let date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    // Try DD/MM/YYYY format (common in UK)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/');
      date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // Try DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
      const [day, month, year] = value.split('-');
      date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // Try MM/DD/YYYY format (US format)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [month, day, year] = value.split('/');
      date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // Default to today if parsing fails
    console.warn(`Cannot parse date: ${value}, using today's date`);
    return new Date().toISOString().split('T')[0];
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
          if (index !== undefined && row[index]) {
            const value = row[index];
            
            // Special handling for amount fields
            if (mapping.targetField === 'amount') {
              const parsedAmount = this.parseAmount(value);
              
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
            } else if (mapping.targetField === 'date' && !mapping.transform) {
              // Apply date parsing for date fields without transform
              transaction.date = this.parseDate(value);
            } else if (mapping.transform) {
              transaction[mapping.targetField as keyof Transaction] = mapping.transform(value);
            } else {
              transaction[mapping.targetField as keyof Transaction] = value as any;
            }
          }
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
        
        // Add transaction
        transaction.id = `import-${Date.now()}-${rowIndex}`;
        result.items.push(transaction as Transaction);
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
      console.error('Failed to save import profiles:', error);
    }
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
      ]
    };
    
    return bankMappings[bank.toLowerCase()] || [];
  }
}

export const enhancedCsvImportService = new EnhancedCsvImportService();