import type { Transaction, Account, Category } from '../types';
import { smartCategorizationService } from './smartCategorizationService';

interface QIFTransaction {
  date: string;
  amount: number;
  payee?: string;
  memo?: string;
  category?: string;
  checkNumber?: string;
  cleared?: boolean;
}

interface QIFParseResult {
  transactions: QIFTransaction[];
  accountType?: string;
}

export class QIFImportService {
  /**
   * Parse QIF file content
   */
  parseQIF(content: string): QIFParseResult {
    const lines = content.split('\n').map(line => line.trim());
    const transactions: QIFTransaction[] = [];
    let currentTransaction: Partial<QIFTransaction> = {};
    let accountType: string | undefined;
    
    for (const line of lines) {
      if (line.startsWith('!Type:')) {
        // Account type declaration
        accountType = line.substring(6);
        continue;
      }
      
      if (line === '^') {
        // End of transaction
        if (currentTransaction.date && currentTransaction.amount !== undefined) {
          transactions.push(currentTransaction as QIFTransaction);
        }
        currentTransaction = {};
        continue;
      }
      
      // Parse transaction fields
      const fieldType = line.charAt(0);
      const value = line.substring(1);
      
      switch (fieldType) {
        case 'D': // Date
          currentTransaction.date = this.parseQIFDate(value);
          break;
        case 'T': // Amount
        case 'U': // Amount (investment)
          currentTransaction.amount = this.parseAmount(value);
          break;
        case 'P': // Payee
          currentTransaction.payee = value;
          break;
        case 'M': // Memo
          currentTransaction.memo = value;
          break;
        case 'L': // Category
          currentTransaction.category = value.replace(/[\[\]]/g, ''); // Remove brackets
          break;
        case 'N': // Check number
          currentTransaction.checkNumber = value;
          break;
        case 'C': // Cleared status
          currentTransaction.cleared = value === 'X' || value === '*';
          break;
      }
    }
    
    // Add last transaction if exists
    if (currentTransaction.date && currentTransaction.amount !== undefined) {
      transactions.push(currentTransaction as QIFTransaction);
    }
    
    return { transactions, accountType };
  }
  
  /**
   * Parse QIF date format (M/D/Y or M/D'Y)
   */
  private parseQIFDate(dateStr: string): string {
    // Replace single quote with /
    dateStr = dateStr.replace(/'/g, '/');
    
    // Split date parts
    const parts = dateStr.split('/');
    if (parts.length !== 3) {
      // Try other date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      return new Date().toISOString().split('T')[0];
    }
    
    let [month, day, year] = parts;
    
    // Handle 2-digit year
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      const yearNum = parseInt(year);
      // If year is greater than current year's last 2 digits + 10, assume previous century
      if (yearNum > (currentYear % 100) + 10) {
        year = (century - 100 + yearNum).toString();
      } else {
        year = (century + yearNum).toString();
      }
    }
    
    // Pad month and day
    month = month.padStart(2, '0');
    day = day.padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  /**
   * Parse amount, handling negative values
   */
  private parseAmount(value: string): number {
    // Remove currency symbols and spaces
    value = value.replace(/[£$€¥,\s]/g, '');
    
    // Check for negative amount
    const isNegative = value.startsWith('-') || value.startsWith('(') || value.endsWith(')');
    
    // Remove parentheses and negative sign
    value = value.replace(/[()+-]/g, '');
    
    const amount = parseFloat(value) || 0;
    return isNegative ? -Math.abs(amount) : Math.abs(amount);
  }
  
  /**
   * Import QIF transactions
   */
  async importTransactions(
    qifContent: string,
    targetAccountId: string,
    existingTransactions: Transaction[],
    options: {
      categories?: Category[];
      autoCategorize?: boolean;
    } = {}
  ): Promise<{
    transactions: Omit<Transaction, 'id'>[];
    duplicates: number;
    newTransactions: number;
  }> {
    const parseResult = this.parseQIF(qifContent);
    const transactions: Omit<Transaction, 'id'>[] = [];
    let duplicates = 0;
    
    for (const qifTrx of parseResult.transactions) {
      // Basic duplicate check by date, amount, and payee
      const isDuplicate = existingTransactions.some(existing => {
        const existingDateStr = typeof existing.date === 'string' ? existing.date : existing.date.toISOString().split('T')[0];
        const sameDate = existingDateStr === qifTrx.date;
        const sameAmount = Math.abs(existing.amount - Math.abs(qifTrx.amount)) < 0.01;
        const samePayee = qifTrx.payee && existing.description.includes(qifTrx.payee);
        
        return sameDate && sameAmount && (samePayee || !qifTrx.payee);
      });
      
      if (isDuplicate) {
        duplicates++;
        continue;
      }
      
      const amount = Math.abs(qifTrx.amount);
      const type = qifTrx.amount < 0 ? 'expense' : 'income';
      
      // Build description from payee and memo
      let description = qifTrx.payee || '';
      if (qifTrx.memo && qifTrx.memo !== description) {
        description = description ? `${description} - ${qifTrx.memo}` : qifTrx.memo;
      }
      description = description || 'QIF Transaction';
      
      const transaction: Omit<Transaction, 'id'> = {
        date: qifTrx.date,
        description,
        amount,
        type,
        accountId: targetAccountId,
        category: qifTrx.category || '',
        cleared: qifTrx.cleared || false,
        notes: qifTrx.checkNumber ? `Check #: ${qifTrx.checkNumber}` : undefined,
        recurring: false
      };
      
      // Auto-categorize if enabled and no category is set
      if (options.autoCategorize && options.categories && !transaction.category) {
        // Train the model if we have existing transactions
        if (existingTransactions.length > 0) {
          smartCategorizationService.learnFromTransactions(existingTransactions, options.categories);
        }
        
        // Get category suggestions
        const suggestions = smartCategorizationService.suggestCategories(transaction as Transaction, 1);
        
        if (suggestions.length > 0 && suggestions[0].confidence >= 0.7) {
          transaction.category = suggestions[0].categoryId;
        }
      }
      
      transactions.push(transaction);
    }
    
    return {
      transactions,
      duplicates,
      newTransactions: transactions.length
    };
  }
}

export const qifImportService = new QIFImportService();