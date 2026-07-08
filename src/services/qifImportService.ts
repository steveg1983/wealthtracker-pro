import type { Transaction, Category } from '../types';
import { smartCategorizationService } from './smartCategorizationService';
import { toDecimal, toNumber } from '../utils/decimal';

export interface QIFTransaction {
  date: string;
  amount: number;
  payee?: string;
  memo?: string;
  category?: string;
  checkNumber?: string;
  cleared?: boolean;
}

/** Order of the day/month fields in a QIF date. */
export type QIFDateOrder = 'dmy' | 'mdy';

export interface QIFParseResult {
  transactions: QIFTransaction[];
  accountType?: string;
  /** Day/month field order inferred across the whole file's dates. */
  dateOrder: QIFDateOrder;
  /** Rows dropped because their date could not be parsed (never guessed). */
  invalidDateCount: number;
}

export class QIFImportService {
  /**
   * Parse QIF file content
   */
  parseQIF(content: string): QIFParseResult {
    const lines = content.split('\n').map(line => line.trim());
    // First pass: collect transactions keeping each date as its RAW string. QIF
    // gives no format hint, so we can't decide day/month order until we've seen
    // every date in the file (see detectDateOrder).
    const rawTransactions: QIFTransaction[] = [];
    let currentTransaction: Partial<QIFTransaction> = {};
    let accountType: string | undefined;
    let inAccountHeader = false;

    for (const line of lines) {
      if (line.startsWith('!Account')) {
        // Account header block: its fields describe the account, not a
        // transaction. In this block 'N' is the account NAME, 'T' the account
        // TYPE (e.g. "Bank") and '$' the balance — feeding those into the
        // transaction field parser crashed on non-numeric 'T' values.
        inAccountHeader = true;
        continue;
      }

      if (line.startsWith('!Type:')) {
        // Account type declaration
        accountType = line.substring(6);
        inAccountHeader = false;
        continue;
      }

      if (line === '^') {
        if (inAccountHeader) {
          // End of account header block — nothing transactional to record
          inAccountHeader = false;
          currentTransaction = {};
          continue;
        }
        // End of transaction
        if (currentTransaction.date && currentTransaction.amount !== undefined) {
          rawTransactions.push(currentTransaction as QIFTransaction);
        }
        currentTransaction = {};
        continue;
      }

      if (inAccountHeader) {
        // Skip account metadata lines (name/type/balance/description)
        continue;
      }

      // Parse transaction fields
      const fieldType = line.charAt(0);
      const value = line.substring(1);

      switch (fieldType) {
        case 'D': // Date — kept raw here, resolved once the whole file is seen
          currentTransaction.date = value;
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
          currentTransaction.category = value.replace(/[[\]]/g, ''); // Remove brackets
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
      rawTransactions.push(currentTransaction as QIFTransaction);
    }

    // Second pass: infer the date order from every raw date, then resolve each
    // to ISO. Rows whose date can't be parsed are dropped and counted — never
    // silently coerced to "today" (which the old parser did, hiding the error).
    const dateOrder = this.detectDateOrder(rawTransactions.map(trx => trx.date));
    const transactions: QIFTransaction[] = [];
    let invalidDateCount = 0;
    for (const trx of rawTransactions) {
      const isoDate = this.parseQIFDate(trx.date, dateOrder);
      if (!isoDate) {
        invalidDateCount++;
        continue;
      }
      trx.date = isoDate;
      transactions.push(trx);
    }

    return { transactions, accountType, dateOrder, invalidDateCount };
  }
  
  /**
   * Split a QIF date into its three raw parts, or null if it isn't a 3-part
   * D/M/Y-style date. Handles the '/' , '.' and '-' separators and Quicken's
   * apostrophe year separator (e.g. 12/25'23).
   */
  private splitDateParts(dateStr: string): string[] | null {
    const cleaned = (dateStr ?? '').replace(/'/g, '/').trim();
    if (!cleaned) {
      return null;
    }
    const parts = cleaned.split(/[/.-]/).map(part => part.trim()).filter(Boolean);
    return parts.length === 3 ? parts : null;
  }

  /**
   * Infer the day/month field order across ALL of a file's dates.
   *
   * QIF carries no format hint, so we reason from the values: a first field
   * greater than 12 can only be a day (→ D/M/Y, e.g. UK / MS Money), a second
   * field greater than 12 can only be a day (→ M/D/Y, e.g. US / Quicken). Real
   * statements always contain a day past the 12th, so this is decisive in
   * practice. Files where nothing exceeds 12 (or that contradict themselves)
   * fall back to M/D/Y — QIF's Quicken heritage.
   */
  private detectDateOrder(rawDates: string[]): QIFDateOrder {
    let dayFirst = false;   // saw a first field that can only be a day
    let monthFirst = false; // saw a second field that can only be a day
    for (const raw of rawDates) {
      const parts = this.splitDateParts(raw);
      if (!parts) {
        continue;
      }
      const first = parseInt(parts[0], 10);
      const second = parseInt(parts[1], 10);
      if (!Number.isFinite(first) || !Number.isFinite(second)) {
        continue;
      }
      // A 4-digit / >31 leading field is a year (ISO YYYY-MM-DD) — no D/M signal.
      if (parts[0].length === 4 || first > 31) {
        continue;
      }
      if (first > 12 && first <= 31) {
        dayFirst = true;
      }
      if (second > 12 && second <= 31) {
        monthFirst = true;
      }
    }
    return dayFirst && !monthFirst ? 'dmy' : 'mdy';
  }

  /**
   * Resolve a raw QIF date to an ISO YYYY-MM-DD string using the detected field
   * order. Returns null for anything that isn't a real calendar date — callers
   * drop those rows rather than inventing a date.
   */
  private parseQIFDate(dateStr: string, order: QIFDateOrder): string | null {
    const parts = this.splitDateParts(dateStr);
    if (!parts) {
      // Non-slash forms (e.g. "5 Jan 2024") — let the platform parser try.
      const cleaned = (dateStr ?? '').replace(/'/g, '/').trim();
      if (!cleaned) {
        return null;
      }
      const parsed = new Date(cleaned);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
    }

    let year: number;
    let month: number;
    let day: number;

    const first = parseInt(parts[0], 10);
    if (parts[0].length === 4 || first > 31) {
      // Year-first ISO form: YYYY-MM-DD (unambiguous).
      year = first;
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      const second = parseInt(parts[1], 10);
      year = this.normalizeYear(parts[2]);
      if (order === 'dmy') {
        day = first;
        month = second;
      } else {
        month = first;
        day = second;
      }
    }

    if (!this.isValidYmd(year, month, day)) {
      return null;
    }

    const pad = (value: number, length = 2): string => value.toString().padStart(length, '0');
    return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  }

  /**
   * Expand a QIF year to a 4-digit year. 2-digit years assume the current
   * century unless that lands more than ~10 years in the future, in which case
   * the previous century is used (matching Quicken's windowing).
   */
  private normalizeYear(yearStr: string): number {
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) {
      return NaN;
    }
    if (yearStr.length > 2) {
      return year;
    }
    const currentYear = new Date().getFullYear();
    const century = Math.floor(currentYear / 100) * 100;
    if (year > (currentYear % 100) + 10) {
      return century - 100 + year;
    }
    return century + year;
  }

  /** True only for a real calendar date (rejects e.g. 31 Feb or month 13). */
  private isValidYmd(year: number, month: number, day: number): boolean {
    if (![year, month, day].every(Number.isFinite)) {
      return false;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    const dt = new Date(Date.UTC(year, month - 1, day));
    return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
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

    const amount = toNumber(toDecimal(value));
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
    invalidDates: number;
  }> {
    const parseResult = this.parseQIF(qifContent);
    const transactions: Omit<Transaction, 'id'>[] = [];
    let duplicates = 0;
    
    for (const qifTrx of parseResult.transactions) {
      // Duplicate check by date, SIGNED amount, and payee similarity
      const isDuplicate = existingTransactions.some(existing => {
        const existingDateStr = typeof existing.date === 'string' ? existing.date : existing.date.toISOString().split('T')[0];
        if (existingDateStr !== qifTrx.date) {
          return false;
        }

        // Payee/description similarity is required: never dedupe on
        // date + amount alone when the incoming row has no payee.
        const samePayee = Boolean(qifTrx.payee && existing.description.includes(qifTrx.payee));
        if (!samePayee) {
          return false;
        }

        // Signed convention: compare SIGNED amounts so a same-day refund (+X)
        // of an expense (-X) is NOT swallowed as a duplicate.
        const sameSignedAmount = Math.abs(existing.amount - qifTrx.amount) < 0.01;
        if (sameSignedAmount) {
          return true;
        }

        // Legacy fallback: rows stored before the signed convention kept
        // expenses positive. Only for those rows compare by magnitude.
        const isLegacyPositiveExpense = existing.amount > 0 && existing.type === 'expense';
        return isLegacyPositiveExpense &&
          Math.abs(Math.abs(existing.amount) - Math.abs(qifTrx.amount)) < 0.01;
      });
      
      if (isDuplicate) {
        duplicates++;
        continue;
      }
      
      // Signed convention: QIF 'T'/'U' amounts are already signed at the source
      // (expense negative, income positive), so store the signed value directly.
      const amount = qifTrx.amount;
      const type = qifTrx.amount < 0 ? 'expense' : 'income';
      
      // Build description from payee and memo
      let description = qifTrx.payee || '';
      if (qifTrx.memo && qifTrx.memo !== description) {
        description = description ? `${description} - ${qifTrx.memo}` : qifTrx.memo;
      }
      description = description || 'QIF Transaction';
      
      const transaction: Omit<Transaction, 'id'> = {
        date: new Date(qifTrx.date),
        description,
        amount,
        type,
        accountId: targetAccountId,
        category: qifTrx.category || '',
        cleared: qifTrx.cleared || false,
        notes: qifTrx.checkNumber ? `Check #: ${qifTrx.checkNumber}` : undefined,
        isRecurring: false
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
      newTransactions: transactions.length,
      invalidDates: parseResult.invalidDateCount
    };
  }
}

export const qifImportService = new QIFImportService();
