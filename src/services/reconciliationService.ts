import type { Transaction } from '../types';
import type { DecimalInstance } from '../types/decimal-types';
import { logger } from './loggingService';

export interface MatchCandidate {
  transaction: Transaction;
  score: number;
  reasons: string[];
}

export interface ReconciliationResult {
  matched: number;
  unmatched: number;
  suggestions: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Service for handling transaction reconciliation logic
 */
export class ReconciliationService {
  /**
   * Get default date range (last month to today)
   */
  static getDefaultDateRange(): DateRange {
    return {
      start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      end: new Date()
    };
  }
  /**
   * Calculate balance from transactions
   */
  static calculateBalance(transactions: Transaction[]): number {
    return transactions.reduce((sum, t) => {
      const amount = typeof t.amount === 'number' 
        ? t.amount 
        : (t.amount as DecimalInstance).toNumber();
      return sum + (t.type === 'income' ? amount : -amount);
    }, 0);
  }

  /**
   * Filter transactions by account and date range
   */
  static filterTransactions(
    transactions: Transaction[],
    accountId: string,
    dateRange: DateRange
  ): Transaction[] {
    if (!accountId) return [];
    
    return transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return t.accountId === accountId &&
             tDate >= dateRange.start &&
             tDate <= dateRange.end;
    });
  }

  /**
   * Calculate string similarity between two descriptions
   */
  static calculateDescriptionSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Find matching candidates for an uncleared transaction
   */
  static findMatchingCandidates(
    uncleared: Transaction,
    historicalTransactions: Transaction[]
  ): MatchCandidate[] {
    const candidates: MatchCandidate[] = [];
    const unclearedDate = uncleared.date instanceof Date 
      ? uncleared.date 
      : new Date(uncleared.date);
    const unclearedAmount = typeof uncleared.amount === 'number' 
      ? uncleared.amount 
      : (uncleared.amount as DecimalInstance).toNumber();
    
    historicalTransactions.forEach(historical => {
      const historicalDate = historical.date instanceof Date 
        ? historical.date 
        : new Date(historical.date);
      const historicalAmount = typeof historical.amount === 'number' 
        ? historical.amount 
        : (historical.amount as DecimalInstance).toNumber();
      
      let score = 0;
      const reasons: string[] = [];
      
      // Check amount similarity
      if (Math.abs(historicalAmount - unclearedAmount) < 0.01) {
        score += 40;
        reasons.push('Exact amount match');
      } else if (Math.abs(historicalAmount - unclearedAmount) / unclearedAmount < 0.1) {
        score += 20;
        reasons.push('Similar amount (within 10%)');
      }
      
      // Check description similarity
      const descSimilarity = this.calculateDescriptionSimilarity(
        uncleared.description,
        historical.description
      );
      if (descSimilarity > 0.8) {
        score += 30;
        reasons.push('Very similar description');
      } else if (descSimilarity > 0.6) {
        score += 20;
        reasons.push('Similar description');
      }
      
      // Check category match
      if (uncleared.category === historical.category) {
        score += 20;
        reasons.push('Same category');
      }
      
      // Check if it's a recurring transaction (similar day of month)
      if (unclearedDate.getDate() === historicalDate.getDate()) {
        score += 10;
        reasons.push('Same day of month (recurring?)');
      }
      
      if (score >= 50) {
        candidates.push({
          transaction: historical,
          score,
          reasons
        });
      }
    });
    
    return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  /**
   * Get historical transactions for matching
   */
  static getHistoricalTransactions(
    transactions: Transaction[],
    accountId: string,
    beforeDate: Date
  ): Transaction[] {
    return transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return t.accountId === accountId &&
             t.cleared &&
             tDate < beforeDate;
    });
  }

  /**
   * Check if reconciliation is balanced
   */
  static isBalanced(clearedBalance: number, statementBalance: number): boolean {
    return Math.abs(statementBalance - clearedBalance) < 0.01;
  }

  /**
   * Calculate the difference between statement and cleared balance
   */
  static calculateDifference(statementBalance: string, clearedBalance: number): number {
    return statementBalance ? parseFloat(statementBalance) - clearedBalance : 0;
  }

  /**
   * Auto-reconcile transactions
   */
  static async autoReconcile(
    unclearedTransactions: Transaction[],
    allTransactions: Transaction[],
    accountId: string,
    dateRange: DateRange,
    updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  ): Promise<ReconciliationResult> {
    let matched = 0;
    let unmatched = 0;
    let suggestions = 0;
    
    try {
      const historicalTransactions = this.getHistoricalTransactions(
        allTransactions,
        accountId,
        dateRange.start
      );
      
      // Process each uncleared transaction
      for (const transaction of unclearedTransactions) {
        const candidates = this.findMatchingCandidates(
          transaction,
          historicalTransactions
        );
        
        if (candidates.length > 0 && candidates[0].score >= 80) {
          // High confidence match - auto clear
          await updateTransaction(transaction.id, { cleared: true });
          matched++;
        } else if (candidates.length > 0) {
          // Has suggestions but needs manual review
          suggestions++;
        } else {
          // No good matches found
          unmatched++;
        }
      }
      
      return { matched, unmatched, suggestions };
    } catch (error) {
      logger.error('Error during auto-reconciliation:', error);
      throw error;
    }
  }

  /**
   * Get uncleared transactions
   */
  static getUnclearedTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.filter(t => !t.cleared);
  }

  /**
   * Get cleared transactions
   */
  static getClearedTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.filter(t => t.cleared);
  }
}

export const reconciliationService = new ReconciliationService();