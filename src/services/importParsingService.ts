import { logger } from './loggingService';
import { parseMNY, parseMBF } from '../utils/mnyParser';
import { parseQIF } from '../utils/qifParser';

export interface ParsedTransaction {
  date: Date;
  amount: number;
  description: string;
  type: 'income' | 'expense';
  category: string;
  payee?: string;
}

export interface ParsedAccount {
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment';
  balance: number;
}

export interface ParsedData {
  accounts: ParsedAccount[];
  transactions: ParsedTransaction[];
  warning?: string;
  rawData?: Array<Record<string, unknown>>;
  needsMapping?: boolean;
}

/**
 * Service for parsing various financial file formats
 */
export class ImportParsingService {
  /**
   * Parse OFX file format
   */
  static parseOFX(content: string): ParsedData {
    logger.info('Using OFX parser');
    const transactions: ParsedTransaction[] = [];
    const accountsMap = new Map<string, ParsedAccount>();
    
    // Extract account info
    const accountMatch = content.match(/<ACCTID>([^<]+)/);
    const accountTypeMatch = content.match(/<ACCTTYPE>([^<]+)/);
    const balanceMatch = content.match(/<BALAMT>([^<]+)/);
    
    const accountName = accountMatch ? `Account ${accountMatch[1]}` : 'Imported Account';
    const accountType = accountTypeMatch?.[1]?.toLowerCase() || 'checking';
    const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;
    
    accountsMap.set(accountName, {
      name: accountName,
      type: accountType.includes('credit') ? 'credit' : 
            accountType.includes('saving') ? 'savings' : 'checking',
      balance
    });
    
    // Extract transactions
    const transactionRegex = /<STMTTRN>[\s\S]*?<\/STMTTRN>/g;
    const transactionMatches = content.match(transactionRegex) || [];
    
    for (const trans of transactionMatches) {
      const typeMatch = trans.match(/<TRNTYPE>([^<]+)/);
      const dateMatch = trans.match(/<DTPOSTED>([^<]+)/);
      const amountMatch = trans.match(/<TRNAMT>([^<]+)/);
      const nameMatch = trans.match(/<NAME>([^<]+)/);
      const memoMatch = trans.match(/<MEMO>([^<]+)/);
      
      if (dateMatch && amountMatch) {
        const dateStr = dateMatch[1];
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6));
        const day = parseInt(dateStr.substring(6, 8));
        
        const amount = parseFloat(amountMatch[1]);
        const description = nameMatch?.[1] || memoMatch?.[1] || 'Imported transaction';
        const type = amount < 0 ? 'expense' : 'income';
        
        transactions.push({
          date: new Date(year, month - 1, day),
          amount: Math.abs(amount),
          description,
          type,
          category: typeMatch?.[1] || 'Other'
        });
      }
    }
    
    return {
      accounts: Array.from(accountsMap.values()),
      transactions
    };
  }

  /**
   * Parse file based on extension
   */
  static async parseFile(file: File): Promise<ParsedData | null> {
    const fileName = file.name.toLowerCase();
    logger.info('Processing file for import', { fileName, size: file.size });
    
    if (fileName.endsWith('.mny')) {
      logger.info('Detected MNY file');
      const arrayBuffer = await file.arrayBuffer();
      return await parseMNY(arrayBuffer);
    } else if (fileName.endsWith('.mbf')) {
      logger.info('Detected MBF backup file');
      const arrayBuffer = await file.arrayBuffer();
      return await parseMBF(arrayBuffer);
    } else if (fileName.endsWith('.qif')) {
      logger.info('Detected QIF file');
      const content = await file.text();
      return parseQIF(content);
    } else if (fileName.endsWith('.ofx')) {
      logger.info('Detected OFX file');
      const content = await file.text();
      return this.parseOFX(content);
    } else {
      throw new Error('Unsupported file format. Please use .mny, .mbf, .qif, or .ofx files.');
    }
  }

  /**
   * Get appropriate parsing message
   */
  static getParsingMessage(fileName: string): string {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.mny') || lowerName.endsWith('.mbf')) {
      return 'Parsing Money database file... This may take a moment...';
    } else if (lowerName.endsWith('.qif')) {
      return 'Parsing QIF file...';
    } else if (lowerName.endsWith('.ofx')) {
      return 'Parsing OFX file...';
    }
    return 'Parsing file...';
  }
}

export const importParsingService = new ImportParsingService();