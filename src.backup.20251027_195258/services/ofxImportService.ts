import { toStorageNumber } from '@wealthtracker/utils';
import { parseCurrencyDecimal } from '../utils/currency-decimal';
import type { Transaction, Account, Category } from '../types';
import { smartCategorizationService } from './smartCategorizationService';

interface OFXTransaction {
  type: string;
  datePosted: Date;
  amount: number;
  fitId: string;
  name: string;
  memo?: string;
  checkNum?: string;
  refNum?: string;
}

interface OFXAccount {
  bankId?: string;
  accountId: string;
  accountType: string;
  branchId?: string;
}

interface OFXParseResult {
  account: OFXAccount;
  transactions: OFXTransaction[];
  balance?: {
    amount: number;
    dateAsOf: Date;
  };
  currency?: string;
  startDate?: Date;
  endDate?: Date;
}

export class OFXImportService {
  /**
   * Parse OFX file content
   */
  parseOFX(content: string): OFXParseResult {
    // Remove headers and get to the actual OFX content
    const ofxStart = content.indexOf('<OFX>');
    if (ofxStart === -1) {
      throw new Error('Invalid OFX file: <OFX> tag not found');
    }
    
    const ofxContent = content.substring(ofxStart);
    
    // Parse account information
    const account = this.parseAccountInfo(ofxContent);
    
    // Parse transactions
    const transactions = this.parseTransactions(ofxContent);
    
    // Parse balance
    const balance = this.parseBalance(ofxContent);
    
    // Parse date range
    const startDateRaw = this.extractValue(ofxContent, '<DTSTART>', '</DTSTART>') || 
                       this.extractValue(ofxContent, '<DTSTART>', '\n');
    const endDateRaw = this.extractValue(ofxContent, '<DTEND>', '</DTEND>') || 
                     this.extractValue(ofxContent, '<DTEND>', '\n');
    const parsedStartDate = startDateRaw ? this.parseOFXDate(startDateRaw) : null;
    const parsedEndDate = endDateRaw ? this.parseOFXDate(endDateRaw) : null;
    
    // Parse currency
    const currency = this.extractValue(ofxContent, '<CURDEF>', '</CURDEF>') || 
                    this.extractValue(ofxContent, '<CURDEF>', '\n') || 
                    'GBP';
    
    return {
      account,
      transactions,
      currency,
      ...(balance ? { balance } : {}),
      ...(parsedStartDate ? { startDate: parsedStartDate } : {}),
      ...(parsedEndDate ? { endDate: parsedEndDate } : {})
    };
  }
  
  /**
   * Parse account information from OFX
   */
  private parseAccountInfo(content: string): OFXAccount {
    // Try bank account first
    let accountId = this.extractValue(content, '<ACCTID>', '</ACCTID>') || 
                   this.extractValue(content, '<ACCTID>', '\n');
    
    // Try credit card account
    if (!accountId) {
      accountId = this.extractValue(content, '<ACCTID>', '</ACCTID>') || 
                 this.extractValue(content, '<ACCTID>', '\n');
    }
    
    if (!accountId) {
      throw new Error('Account ID not found in OFX file');
    }
    
    const bankId = this.extractValue(content, '<BANKID>', '</BANKID>') || 
                  this.extractValue(content, '<BANKID>', '\n');
    
    const branchId = this.extractValue(content, '<BRANCHID>', '</BRANCHID>') || 
                    this.extractValue(content, '<BRANCHID>', '\n');
    
    const accountType = this.extractValue(content, '<ACCTTYPE>', '</ACCTTYPE>') || 
                       this.extractValue(content, '<ACCTTYPE>', '\n') || 
                       'CHECKING';
    
    return {
      accountId: accountId.trim(),
      accountType,
      ...(bankId ? { bankId } : {}),
      ...(branchId ? { branchId } : {})
    };
  }
  
  /**
   * Helper to safely extract string values with fallbacks
   */
  private extractStringValue(content: string, startTag: string, endTag: string, fallback: string = ''): string {
    const value1 = this.extractValue(content, startTag, endTag);
    if (value1) return value1;

    const value2 = this.extractValue(content, startTag, '\n');
    if (value2) return value2;

    return fallback;
  }

  /**
   * Parse transactions from OFX
   */
  private parseTransactions(content: string): OFXTransaction[] {
    const transactions: OFXTransaction[] = [];
    
    // Find all transaction blocks
    const transactionPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;
    
    while ((match = transactionPattern.exec(content)) !== null) {
      const transBlock = match[1];
      if (!transBlock) {
        continue;
      }
      
      const type = this.extractStringValue(transBlock, '<TRNTYPE>', '</TRNTYPE>', 'OTHER');

      const datePosted = this.extractStringValue(transBlock, '<DTPOSTED>', '</DTPOSTED>', '');

      const amountStr = this.extractStringValue(transBlock, '<TRNAMT>', '</TRNAMT>', '0');

      const fitId = this.extractStringValue(transBlock, '<FITID>', '</FITID>', '');
      
      const name = this.extractStringValue(transBlock, '<NAME>', '</NAME>', 'Unknown');
      
      const memo = this.extractStringValue(transBlock, '<MEMO>', '</MEMO>', '');
      
      const checkNum = this.extractStringValue(transBlock, '<CHECKNUM>', '</CHECKNUM>', '');
      
      const refNum = this.extractStringValue(transBlock, '<REFNUM>', '</REFNUM>', '');
      
      if (datePosted && amountStr && fitId) {
        const parsedDate = this.parseOFXDate(datePosted);
        const amountDecimal = parseCurrencyDecimal(amountStr);
        if (!parsedDate || amountDecimal.isNaN()) {
          continue;
        }

        const transaction: OFXTransaction = {
          type,
          datePosted: parsedDate,
          amount: toStorageNumber(amountDecimal),
          fitId: fitId.trim(),
          name: this.cleanString(name)
        };

        if (memo) {
          transaction.memo = this.cleanString(memo);
        }
        if (checkNum) {
          transaction.checkNum = checkNum;
        }
        if (refNum) {
          transaction.refNum = refNum;
        }

        transactions.push(transaction);
      }
    }
    
    return transactions;
  }
  
  /**
   * Parse balance information
   */
  private parseBalance(content: string): { amount: number; dateAsOf: Date } | undefined {
    const balanceAmount = this.extractValue(content, '<BALAMT>', '</BALAMT>') || 
                         this.extractValue(content, '<BALAMT>', '\n');
    
    const balanceDate = this.extractValue(content, '<DTASOF>', '</DTASOF>') || 
                       this.extractValue(content, '<DTASOF>', '\n');
    
    if (balanceAmount && balanceDate) {
      const parsedDate = this.parseOFXDate(balanceDate);
      if (!parsedDate) {
        return undefined;
      }

      return {
        amount: toStorageNumber(parseCurrencyDecimal(balanceAmount)),
        dateAsOf: parsedDate
      };
    }
    
    return undefined;
  }
  
  /**
   * Extract value between tags or until newline
   */
  private extractValue(content: string, startTag: string, endTag: string): string | null {
    const startIndex = content.indexOf(startTag);
    if (startIndex === -1) return null;
    
    const valueStart = startIndex + startTag.length;
    const valueEnd = endTag === '\n' 
      ? content.indexOf('\n', valueStart)
      : content.indexOf(endTag, valueStart);
    
    if (valueEnd === -1) return null;
    
    return content.substring(valueStart, valueEnd).trim();
  }
  
  /**
   * Parse OFX date format (YYYYMMDDHHMMSS or YYYYMMDD)
   */
  private parseOFXDate(dateStr: string): Date | null {
    if (!dateStr) {
      return null;
    }

    // Remove timezone info if present [0:GMT]
    const cleanDate = dateStr.replace(/\[.*?\]/, '').trim();

    if (cleanDate.length < 8) {
      return null;
    }

    const year = Number.parseInt(cleanDate.substring(0, 4), 10);
    const month = Number.parseInt(cleanDate.substring(4, 6), 10) - 1;
    const day = Number.parseInt(cleanDate.substring(6, 8), 10);

    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return null;
    }

    const date = new Date(Date.UTC(year, month, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  
  /**
   * Clean string values from OFX
   */
  private cleanString(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
  
  /**
   * Convert OFX transaction type to our transaction type
   */
  private getTransactionType(ofxType: string, amount: number): 'income' | 'expense' {
    // Positive amounts are usually income, negative are expenses
    if (amount > 0) {
      return 'income';
    }
    
    // Check OFX transaction types
    const incomeTypes = ['CREDIT', 'DEP', 'INT', 'DIV'];
    
    if (incomeTypes.includes(ofxType)) {
      return 'income';
    }
    
    return 'expense';
  }
  
  /**
   * Match OFX account to existing account
   */
  findMatchingAccount(ofxAccount: OFXAccount, existingAccounts: Account[]): Account | null {
    // First try exact account number match (last 4 digits)
    const ofxLast4 = ofxAccount.accountId.slice(-4);
    
    for (const account of existingAccounts) {
      // Check if account name or institution contains the account number
      if (account.name.includes(ofxLast4) || 
          (account.institution && account.institution.includes(ofxLast4))) {
        return account;
      }
      
      // Check if account has matching sort code (UK specific)
      if (ofxAccount.bankId && account.institution) {
        const sortCode = ofxAccount.bankId.slice(-6); // UK sort codes are 6 digits
        if (account.institution.includes(sortCode)) {
          return account;
        }
      }
    }
    
    // Try matching by account type
    const typeMap: Record<string, Account['type']> = {
      'CHECKING': 'current',
      'SAVINGS': 'savings',
      'CREDITCARD': 'credit',
      'CREDITLINE': 'credit',
      'LOAN': 'loan',
      'INVESTMENT': 'investment'
    };
    
    const mappedType = typeMap[ofxAccount.accountType];
    if (mappedType) {
      const typeMatches = existingAccounts.filter(a => a.type === mappedType);
      if (typeMatches.length === 1) {
        return typeMatches[0] || null;
      }
    }
    
    return null;
  }
  
  /**
   * Import OFX transactions
   */
  async importTransactions(
    ofxContent: string,
    existingAccounts: Account[],
    existingTransactions: Transaction[],
    options: {
      accountId?: string;
      skipDuplicates?: boolean;
      duplicateThreshold?: number;
      categories?: Category[];
      autoCategorize?: boolean;
    } = {}
  ): Promise<{
    transactions: Omit<Transaction, 'id'>[];
    matchedAccount: Account | null;
    unmatchedAccount?: OFXAccount;
    duplicates: number;
    newTransactions: number;
  }> {
    const parseResult = this.parseOFX(ofxContent);
    
    // Find matching account
    let matchedAccount: Account | null = null;
    if (options.accountId) {
      matchedAccount = existingAccounts.find(a => a.id === options.accountId) || null;
    } else {
      matchedAccount = this.findMatchingAccount(parseResult.account, existingAccounts);
    }
    
    const transactions: Omit<Transaction, 'id'>[] = [];
    let duplicates = 0;
    
    for (const ofxTrx of parseResult.transactions) {
      // Check for duplicates using FITID (Financial Institution Transaction ID)
      if (options.skipDuplicates !== false) {
        const isDuplicate = existingTransactions.some(existing => 
          existing.notes && existing.notes.includes(`FITID: ${ofxTrx.fitId}`)
        );
        
        if (isDuplicate) {
          duplicates++;
          continue;
        }
      }
      
      const amount = Math.abs(ofxTrx.amount);
      const type = this.getTransactionType(ofxTrx.type, ofxTrx.amount);
      
      // Build description
      const description = ofxTrx.memo || ofxTrx.name;
      
      // Add notes with OFX metadata
      const notes = [
        `FITID: ${ofxTrx.fitId}`,
        ofxTrx.checkNum ? `Check #: ${ofxTrx.checkNum}` : null,
        ofxTrx.refNum ? `Ref: ${ofxTrx.refNum}` : null
      ]
        .filter((value): value is string => Boolean(value && value.trim().length > 0))
        .join('\n');
      
      const transaction: Omit<Transaction, 'id'> = {
        date: ofxTrx.datePosted,
        description,
        amount,
        type,
        accountId: matchedAccount?.id || 'unassigned',
        category: '',
        cleared: true, // OFX transactions are already cleared
        notes,
        isRecurring: false,
        tags: []
      };
      
      // Auto-categorize if enabled
      if (options.autoCategorize && options.categories) {
        // Train the model if we have existing transactions
        if (existingTransactions.length > 0) {
          smartCategorizationService.learnFromTransactions(existingTransactions, options.categories);
        }
        
        // Get category suggestions
        const suggestionInput: Transaction = {
          id: `ofx-${ofxTrx.fitId}`,
          ...transaction
        };

        const suggestions = smartCategorizationService.suggestCategories(suggestionInput, 1);

        if (suggestions.length > 0) {
          const topSuggestion = suggestions[0];
          if (topSuggestion && topSuggestion.confidence >= 0.7) {
            transaction.category = topSuggestion.categoryId;
          }
        }
      }
      
      transactions.push(transaction);
    }
    
    return {
      transactions,
      matchedAccount,
      duplicates,
      newTransactions: transactions.length,
      ...(!matchedAccount && parseResult.account && { unmatchedAccount: parseResult.account })
    };
  }
}

export const ofxImportService = new OFXImportService();
