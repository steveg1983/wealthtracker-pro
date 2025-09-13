import type { Transaction } from '../../types';
import type { DuplicateCheckResult } from './types';
import { toDecimal } from '../../utils/decimal';
import { logger } from '../loggingService';

/**
 * Duplicate transaction detection utilities
 * Uses multiple strategies to identify potential duplicates
 */
export class DuplicateChecker {
  /**
   * Check if a transaction is a duplicate
   */
  checkDuplicate(
    transaction: Partial<Transaction>,
    existingTransactions: Transaction[],
    threshold: number = 0.85
  ): DuplicateCheckResult {
    const matches: DuplicateCheckResult['matches'] = [];
    let highestConfidence = 0;

    for (const existing of existingTransactions) {
      const similarity = this.calculateTransactionSimilarity(transaction, existing);
      
      if (similarity >= threshold) {
        matches.push({
          id: existing.id,
          field: 'overall',
          similarity: similarity * 100
        });
        
        if (similarity > highestConfidence) {
          highestConfidence = similarity;
        }
      }
    }

    return {
      isDuplicate: matches.length > 0,
      confidence: highestConfidence * 100,
      matches
    };
  }

  /**
   * Calculate similarity between two transactions
   */
  private calculateTransactionSimilarity(
    trans1: Partial<Transaction>,
    trans2: Transaction
  ): number {
    const weights = {
      date: 0.25,
      amount: 0.35,
      description: 0.25,
      account: 0.15
    };

    let totalScore = 0;

    // Date similarity (exact match or within 1 day)
    if (trans1.date && trans2.date) {
      const date1 = new Date(trans1.date);
      const date2 = new Date(trans2.date);
      const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff === 0) {
        totalScore += weights.date;
      } else if (daysDiff <= 1) {
        totalScore += weights.date * 0.5;
      }
    }

    // Amount similarity (exact or very close)
    if (trans1.amount !== undefined && trans2.amount !== undefined) {
      const amount1 = toDecimal(trans1.amount);
      const amount2 = toDecimal(trans2.amount);
      const diff = amount1.minus(amount2).abs();
      
      if (diff.isZero()) {
        totalScore += weights.amount;
      } else if (diff.lessThan(0.01)) {
        totalScore += weights.amount * 0.9;
      } else if (diff.lessThan(1)) {
        totalScore += weights.amount * 0.5;
      }
    }

    // Description similarity
    if (trans1.description && trans2.description) {
      const similarity = this.calculateStringSimilarity(
        trans1.description.toLowerCase(),
        trans2.description.toLowerCase()
      );
      totalScore += weights.description * similarity;
    }

    // Account similarity
    if (trans1.accountId && trans2.accountId) {
      if (trans1.accountId === trans2.accountId) {
        totalScore += weights.account;
      }
    }

    return totalScore;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance calculation
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
   * Find potential duplicates in a batch
   */
  findBatchDuplicates(
    transactions: Partial<Transaction>[],
    threshold: number = 0.85
  ): Map<number, number[]> {
    const duplicates = new Map<number, number[]>();

    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const similarity = this.calculateTransactionSimilarity(
          transactions[i],
          transactions[j] as Transaction
        );
        
        if (similarity >= threshold) {
          if (!duplicates.has(i)) {
            duplicates.set(i, []);
          }
          duplicates.get(i)!.push(j);
        }
      }
    }

    return duplicates;
  }
}

export const duplicateChecker = new DuplicateChecker();