import { type Transaction } from '../types';
import { toDecimal } from '@wealthtracker/utils';

export interface DuplicateMatch {
  transaction: Transaction;
  matchingTransaction: Transaction;
  confidence: number; // 0-100
  matchReasons: string[];
}

export class DuplicateDetectionService {
  /**
   * Detect potential duplicate transactions
   */
  static detectDuplicates(
    transactions: Transaction[],
    newTransactions: Transaction[]
  ): DuplicateMatch[] {
    const duplicates: DuplicateMatch[] = [];

    for (const newTx of newTransactions) {
      for (const existingTx of transactions) {
        const match = this.compareTransactions(newTx, existingTx);
        if (match.confidence >= 70) { // 70% confidence threshold
          duplicates.push({
            transaction: newTx,
            matchingTransaction: existingTx,
            ...match
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Compare two transactions for similarity
   */
  private static compareTransactions(
    tx1: Transaction,
    tx2: Transaction
  ): { confidence: number; matchReasons: string[] } {
    let confidence = 0;
    const matchReasons: string[] = [];

    // Exact amount match (40 points)
    const amountDiff = toDecimal(tx1.amount).minus(toDecimal(tx2.amount)).abs();
    if (amountDiff.lessThan(0.01)) {
      confidence += 40;
      matchReasons.push('Exact amount match');
    } else if (amountDiff.lessThan(1)) {
      confidence += 20;
      matchReasons.push('Similar amount');
    }

    // Date proximity (30 points)
    const daysDiff = Math.abs(
      (new Date(tx1.date).getTime() - new Date(tx2.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysDiff === 0) {
      confidence += 30;
      matchReasons.push('Same date');
    } else if (daysDiff <= 1) {
      confidence += 20;
      matchReasons.push('Within 1 day');
    } else if (daysDiff <= 3) {
      confidence += 10;
      matchReasons.push('Within 3 days');
    }

    // Description similarity (20 points)
    const descSimilarity = this.calculateStringSimilarity(
      tx1.description.toLowerCase(),
      tx2.description.toLowerCase()
    );
    
    if (descSimilarity >= 0.9) {
      confidence += 20;
      matchReasons.push('Very similar description');
    } else if (descSimilarity >= 0.7) {
      confidence += 15;
      matchReasons.push('Similar description');
    } else if (descSimilarity >= 0.5) {
      confidence += 10;
      matchReasons.push('Partially similar description');
    }

    // Same account (5 points)
    if (tx1.accountId === tx2.accountId) {
      confidence += 5;
      matchReasons.push('Same account');
    }

    // Same category (5 points)
    if (tx1.category === tx2.category && tx1.category !== 'Uncategorized') {
      confidence += 5;
      matchReasons.push('Same category');
    }

    return { confidence, matchReasons };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const rows = str2.length + 1;
    const cols = str1.length + 1;
    const matrix: number[][] = Array.from({ length: rows }, (_, rowIndex) => {
      const row = Array<number>(cols).fill(0);
      row[0] = rowIndex;
      return row;
    });

    const firstRow = matrix[0];
    if (firstRow) {
      for (let col = 0; col < cols; col++) {
        firstRow[col] = col;
      }
    }

    for (let row = 1; row < rows; row++) {
      const currentRow = matrix[row];
      const previousRow = matrix[row - 1];
      if (!currentRow || !previousRow) {
        continue;
      }

      for (let col = 1; col < cols; col++) {
        const cost = str2.charAt(row - 1) === str1.charAt(col - 1) ? 0 : 1;
        const substitution = (previousRow[col - 1] ?? Number.POSITIVE_INFINITY) + cost;
        const insertion = (currentRow[col - 1] ?? Number.POSITIVE_INFINITY) + 1;
        const deletion = (previousRow[col] ?? Number.POSITIVE_INFINITY) + 1;
        currentRow[col] = Math.min(substitution, insertion, deletion);
      }
    }

    const lastRow = matrix[rows - 1];
    return lastRow?.[cols - 1] ?? 0;
  }

  /**
   * Find potential duplicates within a single list
   */
  static findInternalDuplicates(transactions: Transaction[]): DuplicateMatch[] {
    const duplicates: DuplicateMatch[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const transactionI = transactions[i];
        const transactionJ = transactions[j];
        if (!transactionI || !transactionJ) continue;

        const pairKey = `${transactionI.id}-${transactionJ.id}`;
        if (processedPairs.has(pairKey)) continue;

        processedPairs.add(pairKey);

        const match = this.compareTransactions(transactionI, transactionJ);
        if (match.confidence >= 85) { // Higher threshold for internal duplicates
          duplicates.push({
            transaction: transactionI,
            matchingTransaction: transactionJ,
            ...match
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Check if a single transaction is likely a duplicate
   */
  static isDuplicateTransaction(
    transaction: Transaction,
    existingTransactions: Transaction[],
    threshold: number = 70
  ): { isDuplicate: boolean; matches: DuplicateMatch[] } {
    const matches: DuplicateMatch[] = [];

    for (const existing of existingTransactions) {
      const match = this.compareTransactions(transaction, existing);
      if (match.confidence >= threshold) {
        matches.push({
          transaction,
          matchingTransaction: existing,
          ...match
        });
      }
    }

    return {
      isDuplicate: matches.length > 0,
      matches
    };
  }

  /**
   * Remove duplicate transactions from a list
   */
  static removeDuplicates(
    transactions: Transaction[],
    threshold: number = 85
  ): { unique: Transaction[]; removed: Transaction[] } {
    const unique: Transaction[] = [];
    const removed: Transaction[] = [];
    const processed = new Set<string>();

    for (const tx of transactions) {
      if (processed.has(tx.id)) continue;
      
      let isDuplicate = false;
      for (const uniqueTx of unique) {
        const match = this.compareTransactions(tx, uniqueTx);
        if (match.confidence >= threshold) {
          isDuplicate = true;
          removed.push(tx);
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(tx);
      }
      processed.add(tx.id);
    }

    return { unique, removed };
  }

  /**
   * Group similar transactions together
   */
  static groupSimilarTransactions(
    transactions: Transaction[],
    threshold: number = 70
  ): Transaction[][] {
    const groups: Transaction[][] = [];
    const assigned = new Set<string>();

    for (const tx of transactions) {
      if (assigned.has(tx.id)) continue;

      const group = [tx];
      assigned.add(tx.id);

      for (const otherTx of transactions) {
        if (assigned.has(otherTx.id)) continue;
        
        const match = this.compareTransactions(tx, otherTx);
        if (match.confidence >= threshold) {
          group.push(otherTx);
          assigned.add(otherTx.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }
}
