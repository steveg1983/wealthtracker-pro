import type { Transaction, Account, Category } from '../types';
import { smartCategorizationService } from './smartCategorizationService';
import { parseMoneyInput, toDecimal, toNumber } from '../utils/decimal';
import { findAccountByOfxIdentifiers } from '../utils/ofxAccountIdentifiers';
import type { StatementBalance } from '../utils/statementBankBalance';

interface OFXTransaction {
  type: string;
  datePosted: string;
  amount: number;
  fitId: string;
  name: string;
  memo?: string;
  checkNum?: string;
  refNum?: string;
}

export interface OFXAccount {
  bankId?: string;
  accountId: string;
  accountType: string;
  branchId?: string;
  /**
   * True when the statement came from <CCACCTFROM> rather than <BANKACCTFROM>.
   * It matters because in a card section <ACCTID> is the CARD number, which
   * some banks publish in full — so nothing may treat it as an account number.
   */
  isCreditCardStatement: boolean;
}

/**
 * How much the account match is worth trusting.
 *
 * 'identifier' means the account's own recorded sort code / account number (or
 * a card's last 4) is the one in the file — a fact. 'heuristic' means the file
 * was matched by a digit or two appearing in the account's name, or by being
 * the only account of its type — a guess that is usually right and sometimes
 * spectacularly wrong. Callers that write anything permanent must tell them
 * apart.
 */
export type AccountMatchConfidence = 'identifier' | 'heuristic';

export interface AccountMatch {
  account: Account;
  confidence: AccountMatchConfidence;
}

interface OFXParseResult {
  account: OFXAccount;
  transactions: OFXTransaction[];
  balance?: StatementBalance;
  currency?: string;
  startDate?: string;
  endDate?: string;
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
    const startDate = this.readTag(ofxContent, 'DTSTART');
    const endDate = this.readTag(ofxContent, 'DTEND');
    
    // Parse currency
    const currency = this.readTag(ofxContent, 'CURDEF') || 
                    'GBP';
    
    return {
      account,
      transactions,
      balance,
      currency,
      startDate: startDate ? this.parseOFXDate(startDate) : undefined,
      endDate: endDate ? this.parseOFXDate(endDate) : undefined
    };
  }
  
  /**
   * Parse account information from OFX
   */
  private parseAccountInfo(content: string): OFXAccount {
    // Which section describes the account decides what <ACCTID> MEANS: in
    // <CCACCTFROM> it is the card number, in <BANKACCTFROM> the account
    // number. Read the tags from inside that section rather than from the
    // whole file, so a value from elsewhere in the statement cannot stand in
    // for one the section omitted.
    const cardBlock = this.extractBlock(content, 'CCACCTFROM');
    const bankBlock = this.extractBlock(content, 'BANKACCTFROM');
    const isCreditCardStatement = cardBlock !== null;
    const accountBlock = cardBlock ?? bankBlock ?? content;

    const accountId = this.readTag(accountBlock, 'ACCTID');

    if (!accountId) {
      throw new Error('Account ID not found in OFX file');
    }

    const bankId = this.readTag(accountBlock, 'BANKID');

    const branchId = this.readTag(accountBlock, 'BRANCHID');

    // Card sections routinely omit <ACCTTYPE> — it would be saying the
    // obvious. Defaulting those to CHECKING would file a card statement as a
    // current account, so the section itself supplies the answer.
    const accountType = this.readTag(accountBlock, 'ACCTTYPE') ||
                       (isCreditCardStatement ? 'CREDITCARD' : 'CHECKING');

    return {
      bankId: bankId || undefined,
      accountId: accountId.trim(),
      accountType,
      branchId: branchId || undefined,
      isCreditCardStatement
    };
  }

  /**
   * The contents of an OFX element, or null when the file has no such element.
   * SGML-style OFX often omits closing tags on leaf values but not on the
   * blocks, so an unclosed block is treated as absent rather than swallowing
   * the rest of the file.
   */
  private extractBlock(content: string, tagName: string): string | null {
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;
    const start = content.indexOf(openTag);
    if (start === -1) return null;

    const end = content.indexOf(closeTag, start + openTag.length);
    if (end === -1) return null;

    return content.substring(start + openTag.length, end);
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
      
      const type = this.readTag(transBlock, 'TRNTYPE') || 
                  'OTHER';
      
      const datePosted = this.readTag(transBlock, 'DTPOSTED');
      
      const amountStr = this.readTag(transBlock, 'TRNAMT');
      
      const fitId = this.readTag(transBlock, 'FITID');
      
      const name = this.readTag(transBlock, 'NAME') || 
                  'Unknown';
      
      const memo = this.readTag(transBlock, 'MEMO');
      
      const checkNum = this.readTag(transBlock, 'CHECKNUM');
      
      const refNum = this.readTag(transBlock, 'REFNUM');
      
      if (datePosted && amountStr && fitId) {
        transactions.push({
          type,
          datePosted: this.parseOFXDate(datePosted),
          amount: toNumber(toDecimal(amountStr)),
          fitId: fitId.trim(),
          name: this.cleanString(name),
          memo: memo ? this.cleanString(memo) : undefined,
          checkNum: checkNum || undefined,
          refNum: refNum || undefined
        });
      }
    }
    
    return transactions;
  }
  
  /**
   * The statement's CLOSING balance, read from <LEDGERBAL> and nowhere else.
   *
   * The distinction is not pedantry. A statement carries two balances, and the
   * other one is a trap: <AVAILBAL> on a credit card is the REMAINING CREDIT,
   * so a £20 debt on a £3,300 limit publishes an <AVAILBAL><BALAMT> of 3280 —
   * the same trap cardNormalization documents for the bank feed. Reading the
   * first <BALAMT> in the file happened to land on the ledger only because the
   * OFX schema orders LEDGERBAL before AVAILBAL; now that this figure decides
   * what the account reconciles against, it is read from the aggregate that
   * defines it. A file with no closed <LEDGERBAL> has no closing balance to
   * offer, and says so by returning nothing rather than by guessing.
   *
   * The amount goes through parseMoneyInput, which returns null for anything
   * that is not a plain signed decimal. `new Decimal('12.34CR')` THROWS, and a
   * throw here would fail the whole import over one unreadable tag.
   */
  private parseBalance(content: string): StatementBalance | undefined {
    const ledgerBlock = this.extractBlock(content, 'LEDGERBAL');
    if (!ledgerBlock) {
      return undefined;
    }

    const balanceAmount = this.readTag(ledgerBlock, 'BALAMT');
    const balanceDate = this.readTag(ledgerBlock, 'DTASOF');

    if (!balanceAmount || !balanceDate) {
      return undefined;
    }

    const amount = parseMoneyInput(balanceAmount);
    if (amount === null) {
      return undefined;
    }

    return {
      amount,
      dateAsOf: this.parseOFXDate(balanceDate)
    };
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
   * A tag's value, whether or not it is closed — and telling APART "the tag is
   * not here" from "the tag is here and empty".
   *
   * The old readers were `closed || unclosed`, which cannot make that
   * distinction, because an empty value is '' and '' is falsy. A Coutts export
   * writes <MEMO></MEMO> for a transaction with no memo, so the closed read
   * correctly returned '', the || fell through to the unclosed read, and that
   * one runs to the end of the LINE — capturing the literal text "</MEMO>".
   * Every affected transaction was then described as "</MEMO>".
   *
   * It was never memo-specific: the same pattern read TRNTYPE, DTPOSTED,
   * TRNAMT, FITID, NAME, CHECKNUM and REFNUM, so any of them, present but
   * empty, yielded its own closing tag as its value. An empty <TRNAMT></TRNAMT>
   * would have become the string "</TRNAMT>".
   *
   * So: try the closed form first and RETURN it if the tag was there at all,
   * empty or not. Only fall back to the line-terminated read when the tag is
   * genuinely unclosed — the SGML style OFX 1.x also permits.
   */
  private readTag(content: string, tagName: string): string | null {
    const closed = this.extractValue(content, `<${tagName}>`, `</${tagName}>`);
    if (closed !== null) return closed;
    return this.extractValue(content, `<${tagName}>`, '\n');
  }
  
  /**
   * Parse OFX date format (YYYYMMDDHHMMSS or YYYYMMDD)
   */
  private parseOFXDate(dateStr: string): string {
    // Remove timezone info if present [0:GMT]
    const cleanDate = dateStr.replace(/\[.*?\]/, '');
    
    // Extract date parts
    const year = cleanDate.substring(0, 4);
    const month = cleanDate.substring(4, 6);
    const day = cleanDate.substring(6, 8);
    
    return `${year}-${month}-${day}`;
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
    // Signed convention: the signed TRNAMT is authoritative. A negative amount
    // is money OUT even when TRNTYPE is CREDIT/DEP/INT/DIV (e.g. a reversed
    // credit), and a positive amount is money IN even when TRNTYPE is DEBIT.
    if (amount < 0) {
      return 'expense';
    }
    if (amount > 0) {
      return 'income';
    }

    // Zero/ambiguous amount: let the OFX transaction type break the tie.
    const incomeTypes = ['CREDIT', 'DEP', 'INT', 'DIV'];
    return incomeTypes.includes(ofxType) ? 'income' : 'expense';
  }
  
  /**
   * Match OFX account to existing account
   */
  findMatchingAccount(ofxAccount: OFXAccount, existingAccounts: Account[]): Account | null {
    return this.matchAccount(ofxAccount, existingAccounts)?.account ?? null;
  }

  /**
   * Match OFX account to existing account, saying how sure the match is.
   *
   * The first tier is the only one that is evidence: the account's own
   * recorded sort code / account number is the file's. Everything below it
   * looks for the file's digits inside a display name or falls back to "the
   * only account of that type", both of which match by coincidence often
   * enough that nothing permanent should be written on their say-so.
   */
  matchAccount(ofxAccount: OFXAccount, existingAccounts: Account[]): AccountMatch | null {
    const byIdentifier = findAccountByOfxIdentifiers(ofxAccount, existingAccounts);
    if (byIdentifier) {
      return { account: byIdentifier, confidence: 'identifier' };
    }

    const guess = this.guessMatchingAccount(ofxAccount, existingAccounts);
    return guess ? { account: guess, confidence: 'heuristic' } : null;
  }

  private guessMatchingAccount(ofxAccount: OFXAccount, existingAccounts: Account[]): Account | null {
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
        return typeMatches[0];
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
    /**
     * What the file says about its own account, matched or not. Callers need
     * it to show which account the statement came from, and to offer its
     * details to an account that has none recorded.
     */
    ofxAccount: OFXAccount;
    /**
     * How the account above was found — null when the caller named the
     * account itself, because then the file did not choose it.
     */
    matchConfidence: AccountMatchConfidence | null;
    /**
     * What the bank says the account was worth at the end of the statement —
     * the figure Reconciliation calls Bank Balance. Undefined when the file
     * carries no <LEDGERBAL>.
     *
     * The sign is the file's own, untouched, and that is deliberate. OFX signs
     * BALAMT in the same frame as the TRNAMTs beside it: on a card statement a
     * purchase is a negative TRNAMT, so a card with money owing closes on a
     * negative ledger balance — which is exactly how this app stores a
     * liability. TrueLayer's /cards surface is the opposite (`current` is the
     * amount owed, positive) and cardNormalization negates it for that reason;
     * applying that negation here would turn a correctly-signed debt into an
     * asset. Whichever way a file signs its balance, it signs its transactions
     * the same way, and this importer already stores those verbatim.
     */
    statementBalance?: StatementBalance;
    duplicates: number;
    newTransactions: number;
  }> {
    const parseResult = this.parseOFX(ofxContent);

    // Find matching account
    let matchedAccount: Account | null = null;
    let matchConfidence: AccountMatchConfidence | null = null;
    if (options.accountId) {
      matchedAccount = existingAccounts.find(a => a.id === options.accountId) || null;
    } else {
      const match = this.matchAccount(parseResult.account, existingAccounts);
      matchedAccount = match?.account ?? null;
      matchConfidence = match?.confidence ?? null;
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
      
      // Signed convention: OFX TRNAMT is already signed at the source
      // (debits negative, credits positive), so store the signed value directly.
      const amount = ofxTrx.amount;
      const type = this.getTransactionType(ofxTrx.type, ofxTrx.amount);
      
      // Build description
      const description = ofxTrx.memo || ofxTrx.name;
      
      // Add notes with OFX metadata
      const notes = [
        `FITID: ${ofxTrx.fitId}`,
        ofxTrx.checkNum ? `Check #: ${ofxTrx.checkNum}` : null,
        ofxTrx.refNum ? `Ref: ${ofxTrx.refNum}` : null
      ].filter(Boolean).join('\n');
      
      const transaction: Omit<Transaction, 'id'> = {
        date: new Date(ofxTrx.datePosted),
        description,
        amount,
        type,
        accountId: matchedAccount?.id || 'default',
        category: '',
        // Deliberately NOT cleared, despite the file coming from the bank.
        // "Cleared" here does not mean the bank has processed it — it means the
        // USER has checked it against their statement and finalised the
        // reconciliation. Importing a statement is the moment that check should
        // happen, so arriving pre-cleared skips the one step that would catch a
        // missing or wrong row and leave the account agreeing with the bank.
        // Every other file importer already defaults this false; OFX was alone.
        cleared: false,
        notes,
        isRecurring: false
      };
      
      // Auto-categorize if enabled
      if (options.autoCategorize && options.categories) {
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
      matchedAccount,
      ofxAccount: parseResult.account,
      matchConfidence,
      statementBalance: parseResult.balance,
      duplicates,
      newTransactions: transactions.length
    };
  }
}

export const ofxImportService = new OFXImportService();