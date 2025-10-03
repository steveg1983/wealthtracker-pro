/**
 * File Import Service
 * Handles file format detection and transaction parsing
 */

import type { Transaction } from '../types';

export interface ImportProgress {
  status: 'idle' | 'detecting' | 'parsing' | 'previewing' | 'importing' | 'complete' | 'error';
  progress: number;
  message: string;
  fileName?: string;
  fileSize?: number;
  format?: 'csv' | 'qif' | 'ofx' | 'unknown';
  rowCount?: number;
  successCount?: number;
  errorCount?: number;
  errors?: string[];
}

export interface PreviewData {
  headers: string[];
  rows: string[][];
  mappings: {
    date?: number;
    description?: number;
    amount?: number;
    category?: number;
    account?: number;
  };
}

export class FileImportService {
  /**
   * Detect file format based on extension and content
   */
  async detectFormat(file: File): Promise<'csv' | 'qif' | 'ofx' | 'unknown'> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // Check by extension first
    switch (extension) {
      case 'csv':
        return 'csv';
      case 'qif':
        return 'qif';
      case 'ofx':
      case 'qfx':
        return 'ofx';
      default:
        // Try to detect by content
        const text = await file.text();
        if (text.includes('OFXHEADER') || text.includes('<OFX>')) {
          return 'ofx';
        }
        if (text.includes('!Type:') || text.includes('^')) {
          return 'qif';
        }
        if (text.includes(',') || text.includes('\t')) {
          return 'csv';
        }
        return 'unknown';
    }
  }

  /**
   * Parse CSV file
   */
  parseCSV(text: string): PreviewData {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/["']/g, ''));
    const rows = lines.slice(1).map(line => {
      // Handle quoted values with commas
      const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
      const matches = line.match(regex) || [];
      return matches.map(m => m.trim().replace(/["']/g, ''));
    });

    // Auto-detect column mappings
    const mappings: PreviewData['mappings'] = {};
    headers.forEach((header, index) => {
      const lower = header.toLowerCase();
      if (lower.includes('date') || lower.includes('posted')) {
        mappings.date = index;
      } else if (lower.includes('description') || lower.includes('memo') || lower.includes('payee')) {
        mappings.description = index;
      } else if (lower.includes('amount') || lower.includes('debit') || lower.includes('credit')) {
        mappings.amount = index;
      } else if (lower.includes('category')) {
        mappings.category = index;
      } else if (lower.includes('account')) {
        mappings.account = index;
      }
    });

    return { headers, rows, mappings };
  }

  /**
   * Parse QIF file
   */
  parseQIF(text: string): Partial<Transaction>[] {
    const transactions: Partial<Transaction>[] = [];
    const lines = text.trim().split('\n');
    let currentTransaction: Partial<Transaction> = {};

    for (const line of lines) {
      if (line.startsWith('!')) continue; // Skip header
      
      const field = line[0];
      const value = line.substring(1);

      switch (field) {
        case 'D': // Date
          currentTransaction.date = this.parseDate(value);
          break;
        case 'T': // Amount
          currentTransaction.amount = parseFloat(value.replace(/[,$]/g, ''));
          break;
        case 'P': // Payee/Description
          currentTransaction.description = value;
          break;
        case 'L': // Category
          currentTransaction.category = value;
          break;
        case '^': // End of transaction
          if (currentTransaction.date) {
            transactions.push(currentTransaction);
          }
          currentTransaction = {};
          break;
      }
    }

    return transactions;
  }

  /**
   * Parse OFX file
   */
  parseOFX(text: string): Partial<Transaction>[] {
    const transactions: Partial<Transaction>[] = [];
    
    // Extract transaction blocks
    const transactionRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;
    
    while ((match = transactionRegex.exec(text)) !== null) {
      const block = match[1];
      const transaction: Partial<Transaction> = {};
      
      // Extract date
      const dateMatch = /<DTPOSTED>(\d{8,14})/.exec(block);
      if (dateMatch) {
        transaction.date = this.parseOFXDate(dateMatch[1]);
      }
      
      // Extract amount
      const amountMatch = /<TRNAMT>([-\d.]+)/.exec(block);
      if (amountMatch) {
        transaction.amount = parseFloat(amountMatch[1]);
      }
      
      // Extract description
      const nameMatch = /<NAME>(.*?)</.exec(block);
      const memoMatch = /<MEMO>(.*?)</.exec(block);
      transaction.description = nameMatch?.[1] || memoMatch?.[1] || 'Transaction';
      
      if (transaction.date) {
        transactions.push(transaction);
      }
    }
    
    return transactions;
  }

  /**
   * Parse date string
   */
  private parseDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try MM/DD/YYYY format
    const parts = dateStr.split(/[/-]/);
    if (parts.length === 3) {
      const [month, day, year] = parts;
      const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      return new Date(formatted);
    }
    
    return new Date();
  }

  /**
   * Parse OFX date format (YYYYMMDD or YYYYMMDDHHMMSS)
   */
  private parseOFXDate(dateStr: string): Date {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }

  /**
   * Convert preview data to transactions
   */
  convertPreviewToTransactions(
    previewData: PreviewData,
    accountId: string
  ): Partial<Transaction>[] {
    return previewData.rows.map(row => ({
      date: previewData.mappings.date !== undefined 
        ? this.parseDate(row[previewData.mappings.date]) 
        : new Date(),
      description: previewData.mappings.description !== undefined 
        ? row[previewData.mappings.description] 
        : 'Imported',
      amount: previewData.mappings.amount !== undefined 
        ? parseFloat(row[previewData.mappings.amount]) 
        : 0,
      type: 'expense', // Will be determined by amount
      accountId,
      category: previewData.mappings.category !== undefined 
        ? row[previewData.mappings.category] 
        : '',
      cleared: false
    }));
  }
}

export const fileImportService = new FileImportService();