import { logger } from './loggingService';
import type { Transaction } from '../types';

interface ImportOptions {
  skipDuplicates?: boolean;
  duplicateThreshold?: number;
  dateFormat?: string;
  amountColumns?: string[];
}

interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  errors: string[];
  transactions: Partial<Transaction>[];
}

class ImportService {
  /**
   * Import transactions from various file formats
   */
  async importFile(
    file: File,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const {
      skipDuplicates = true,
      duplicateThreshold = 90,
      dateFormat = 'MM/DD/YYYY'
    } = options;

    try {
      const content = await this.readFile(file);
      const extension = file.name.split('.').pop()?.toLowerCase();

      switch (extension) {
        case 'csv':
          return this.importCSV(content, options);
        case 'json':
          return this.importJSON(content, options);
        case 'ofx':
        case 'qfx':
          return this.importOFX(content, options);
        default:
          throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      logger.error('Import failed:', error);
      return {
        success: 0,
        failed: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        transactions: []
      };
    }
  }

  /**
   * Read file content as text
   */
  private async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Import CSV file
   */
  private async importCSV(
    content: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const transactions: Partial<Transaction>[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        const transaction = this.mapToTransaction(headers, values);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push(`Line ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    }

    return {
      success: transactions.length,
      failed: errors.length,
      duplicates: 0,
      errors,
      transactions
    };
  }

  /**
   * Parse CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  /**
   * Map CSV row to transaction
   */
  private mapToTransaction(
    headers: string[],
    values: string[]
  ): Partial<Transaction> | null {
    const dateIndex = headers.findIndex(h => 
      /date/i.test(h) || /posted/i.test(h)
    );
    const descriptionIndex = headers.findIndex(h => 
      /description/i.test(h) || /payee/i.test(h) || /merchant/i.test(h)
    );
    const amountIndex = headers.findIndex(h => 
      /amount/i.test(h) || /debit/i.test(h) || /credit/i.test(h)
    );

    if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
      return null;
    }

    const amount = parseFloat(values[amountIndex].replace(/[^0-9.-]/g, ''));
    if (isNaN(amount)) {
      return null;
    }

    return {
      date: new Date(values[dateIndex]),
      description: values[descriptionIndex],
      amount,
      type: amount < 0 ? 'expense' : 'income',
      category: 'Uncategorized'
    };
  }

  /**
   * Import JSON file
   */
  private async importJSON(
    content: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    try {
      const data = JSON.parse(content);
      const transactions = Array.isArray(data) ? data : data.transactions || [];
      
      return {
        success: transactions.length,
        failed: 0,
        duplicates: 0,
        errors: [],
        transactions: transactions.map((t: any) => ({
          ...t,
          date: new Date(t.date),
          amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
        }))
      };
    } catch (error) {
      return {
        success: 0,
        failed: 1,
        duplicates: 0,
        errors: ['Invalid JSON format'],
        transactions: []
      };
    }
  }

  /**
   * Import QIF file
   */
  async importQIF(
    content: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const transactions: Partial<Transaction>[] = [];
    const errors: string[] = [];
    
    const lines = content.trim().split('\n');
    let currentTransaction: any = {};
    
    for (const line of lines) {
      if (line.startsWith('!')) {
        // Header line, skip
        continue;
      }
      
      const code = line[0];
      const value = line.substring(1).trim();
      
      switch (code) {
        case 'D': // Date
          currentTransaction.date = new Date(value);
          break;
        case 'T': // Amount
          currentTransaction.amount = parseFloat(value.replace(/[^0-9.-]/g, ''));
          break;
        case 'P': // Payee/Description
          currentTransaction.description = value;
          break;
        case 'C': // Cleared status
          currentTransaction.cleared = value === 'X';
          break;
        case 'N': // Check number
          currentTransaction.checkNumber = value;
          break;
        case 'M': // Memo
          currentTransaction.memo = value;
          break;
        case 'L': // Category
          currentTransaction.category = value.replace(/[\][]]/g, '');
          break;
        case '^': // End of transaction
          if (currentTransaction.date && currentTransaction.amount !== undefined) {
            transactions.push({
              date: currentTransaction.date,
              description: currentTransaction.description || currentTransaction.memo || 'Unknown',
              amount: currentTransaction.amount,
              type: currentTransaction.amount < 0 ? 'expense' : 'income',
              category: currentTransaction.category || 'Uncategorized',
              cleared: currentTransaction.cleared
            });
          }
          currentTransaction = {};
          break;
      }
    }
    
    return {
      success: transactions.length,
      failed: errors.length,
      duplicates: 0,
      errors,
      transactions
    };
  }

  /**
   * Import OFX/QFX file
   */
  private async importOFX(
    content: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const transactions: Partial<Transaction>[] = [];
    const errors: string[] = [];

    // Simple OFX parser - extracts transaction data
    const transactionMatches = content.matchAll(
      /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g
    );

    for (const match of transactionMatches) {
      try {
        const block = match[1];
        const dateMatch = block.match(/<DTPOSTED>(\d+)/);
        const amountMatch = block.match(/<TRNAMT>([-\d.]+)/);
        const nameMatch = block.match(/<NAME>([^<]+)/);
        const memoMatch = block.match(/<MEMO>([^<]+)/);

        if (dateMatch && amountMatch && (nameMatch || memoMatch)) {
          const dateStr = dateMatch[1];
          const date = new Date(
            parseInt(dateStr.substr(0, 4)),
            parseInt(dateStr.substr(4, 2)) - 1,
            parseInt(dateStr.substr(6, 2))
          );

          const amount = parseFloat(amountMatch[1]);
          const description = (nameMatch?.[1] || memoMatch?.[1] || 'Unknown').trim();

          transactions.push({
            date,
            description,
            amount,
            type: amount < 0 ? 'expense' : 'income',
            category: 'Uncategorized'
          });
        }
      } catch (error) {
        errors.push(`Failed to parse transaction: ${error}`);
      }
    }

    return {
      success: transactions.length,
      failed: errors.length,
      duplicates: 0,
      errors,
      transactions
    };
  }

  /**
   * Check for duplicate transactions
   */
  checkDuplicates(
    newTransactions: Partial<Transaction>[],
    existingTransactions: Transaction[],
    threshold: number = 90
  ): Set<number> {
    const duplicates = new Set<number>();

    newTransactions.forEach((newTx, index) => {
      const isDuplicate = existingTransactions.some(existingTx => {
        // Check if dates are within 3 days
        const dateDiff = Math.abs(
          new Date(newTx.date!).getTime() - new Date(existingTx.date).getTime()
        );
        const daysDiff = dateDiff / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 3) return false;

        // Check if amounts match
        const amountMatch = Math.abs(newTx.amount! - existingTx.amount) < 0.01;
        if (!amountMatch) return false;

        // Check description similarity
        const similarity = this.calculateSimilarity(
          newTx.description || '',
          existingTx.description
        );
        
        return similarity >= threshold;
      });

      if (isDuplicate) {
        duplicates.add(index);
      }
    });

    return duplicates;
  }

  /**
   * Calculate string similarity percentage
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 100;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 100;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - editDistance) / longer.length) * 100;
  }

  /**
   * Calculate Levenshtein distance between two strings
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
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

export const importService = new ImportService();