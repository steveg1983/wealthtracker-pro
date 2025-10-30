// Import service for handling file imports (CSV, QIF, OFX)

import { parse as parseCSV } from 'csv-parse/sync';
import type { Transaction, Account } from '../types';

export interface ImportResult {
  transactions: Partial<Transaction>[];
  accounts?: Account[];
  errors: string[];
  warnings: string[];
}

class ImportService {
  // Detect file format based on content
  detectFormat(content: string): 'csv' | 'qif' | 'ofx' | 'unknown' {
    // Check for OFX/QFX format
    if (content.includes('OFXHEADER') || content.includes('<OFX>')) {
      return 'ofx';
    }

    // Check for QIF format
    if (content.startsWith('!Type:') || content.includes('\n!Type:')) {
      return 'qif';
    }

    // Check for CSV format (simple heuristic)
    const lines = content.split('\n').slice(0, 5);
    const hasCommas = lines.every(line => line.includes(','));
    if (hasCommas) {
      return 'csv';
    }

    return 'unknown';
  }

  // Parse CSV file
  async parseCSV(content: string): Promise<ImportResult> {
    return new Promise((resolve) => {
      const results: any[] = [];
      const errors: string[] = [];

      parseCSV(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err: any, records: any) => {
        if (err) {
          errors.push(err.message);
          resolve({ transactions: [], errors, warnings: [] });
          return;
        }

        // Map CSV records to transactions
        const transactions = records.map((record: any) => ({
          date: this.parseDate(record.Date || record.date || record.DATE),
          description: record.Description || record.description || record.DESCRIPTION || '',
          amount: this.parseAmount(record.Amount || record.amount || record.AMOUNT),
          category: record.Category || record.category || record.CATEGORY || 'Uncategorized'
        }));

        resolve({
          transactions,
          errors: [],
          warnings: []
        });
      });
    });
  }

  // Parse QIF file
  parseQIF(content: string): ImportResult {
    const transactions: Partial<Transaction>[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    const lines = content.split('\n');
    let currentTransaction: any = {};

    for (const line of lines) {
      if (!line || line.trim() === '') continue;

      const type = line[0];
      const value = line.substring(1).trim();

      switch (type) {
        case 'D': // Date
          currentTransaction.date = this.parseDate(value);
          break;
        case 'T': // Amount
          currentTransaction.amount = this.parseAmount(value);
          break;
        case 'P': // Payee/Description
          currentTransaction.description = value;
          break;
        case 'L': // Category
          currentTransaction.category = value;
          break;
        case '^': // End of transaction
          if (currentTransaction.date && currentTransaction.amount !== undefined) {
            transactions.push(currentTransaction);
          }
          currentTransaction = {};
          break;
      }
    }

    return { transactions, errors, warnings };
  }

  // Parse OFX file
  parseOFX(content: string): ImportResult {
    const transactions: Partial<Transaction>[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Simple OFX parser - extracts transactions
    const transactionMatches = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g);

    if (transactionMatches) {
      for (const match of transactionMatches) {
        const transaction: any = {};

        // Extract date
        const dateMatch = match.match(/<DTPOSTED>(\d+)/);
        if (dateMatch) {
          transaction.date = this.parseOFXDate(dateMatch[1]);
        }

        // Extract amount
        const amountMatch = match.match(/<TRNAMT>([-\d.]+)/);
        if (amountMatch) {
          transaction.amount = parseFloat(amountMatch[1]);
        }

        // Extract description
        const nameMatch = match.match(/<NAME>([^<]+)/);
        if (nameMatch) {
          transaction.description = nameMatch[1];
        }

        // Extract memo
        const memoMatch = match.match(/<MEMO>([^<]+)/);
        if (memoMatch && !transaction.description) {
          transaction.description = memoMatch[1];
        }

        if (transaction.date && transaction.amount !== undefined) {
          transactions.push(transaction);
        }
      }
    } else {
      errors.push('No transactions found in OFX file');
    }

    return { transactions, errors, warnings };
  }

  // Helper to parse dates
  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();

    // Try various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try MM/DD/YYYY format
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    return new Date();
  }

  // Helper to parse OFX dates (YYYYMMDDHHMMSS format)
  private parseOFXDate(dateStr: string): Date {
    if (!dateStr || dateStr.length < 8) return new Date();

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));

    return new Date(year, month, day);
  }

  // Helper to parse amounts
  private parseAmount(amountStr: string | number): number {
    if (typeof amountStr === 'number') return amountStr;
    if (!amountStr) return 0;

    // Remove currency symbols and commas
    const cleaned = amountStr.toString().replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }

  // Main import function
  async importFromFile(file: File): Promise<ImportResult> {
    const content = await file.text();
    const format = this.detectFormat(content);

    switch (format) {
      case 'csv':
        return this.parseCSV(content);
      case 'qif':
        return this.parseQIF(content);
      case 'ofx':
        return this.parseOFX(content);
      default:
        return {
          transactions: [],
          errors: ['Unknown file format'],
          warnings: []
        };
    }
  }
}

export const importService = new ImportService();