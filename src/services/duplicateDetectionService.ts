import { Transaction } from '../types';

export interface DuplicateMatch {
  transaction: Transaction;
  matchingTransaction: Transaction;
  confidence: number; // 0-100
  matchReasons: string[];
}

export interface DetectionSettings {
  confidenceThreshold: number;
  timeWindow: number; // days
  amountTolerance: number; // percentage
  checkDescription: boolean;
  checkCategory: boolean;
  dateThreshold: number; // days
  amountThreshold: number; // dollars
  similarityThreshold: number; // 0-100
}

export interface DuplicateGroup {
  id: string;
  transactions: Transaction[];
  original: Transaction;
  potential: Transaction[];
  confidence: number;
  matchReasons: string[];
  suggestedAction: 'merge' | 'keep' | 'delete';
}

export class DuplicateDetectionService {
  /**
   * Get confidence color based on confidence level
   */
  static getConfidenceColor(confidence: number): string {
    if (confidence >= 90) return 'text-red-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-gray-600';
  }

  /**
   * Get confidence label based on confidence level
   */
  static getConfidenceLabel(confidence: number): string {
    if (confidence >= 90) return 'High';
    if (confidence >= 70) return 'Medium';
    return 'Low';
  }

  /**
   * Calculate similarity between two strings
   */
  static calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 100;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - editDistance) / longer.length) * 100;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
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
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

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
    if (Math.abs(tx1.amount - tx2.amount) < 0.01) {
      confidence += 40;
      matchReasons.push('Exact amount match');
    } else if (Math.abs(tx1.amount - tx2.amount) < 1) {
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
   * Find potential duplicates within a single list
   */
  static findInternalDuplicates(transactions: Transaction[]): DuplicateMatch[] {
    const duplicates: DuplicateMatch[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const pairKey = `${transactions[i].id}-${transactions[j].id}`;
        if (processedPairs.has(pairKey)) continue;
        
        processedPairs.add(pairKey);
        
        const match = this.compareTransactions(transactions[i], transactions[j]);
        if (match.confidence >= 85) { // Higher threshold for internal duplicates
          duplicates.push({
            transaction: transactions[i],
            matchingTransaction: transactions[j],
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

// Export instance for convenience
export const duplicateDetectionService = DuplicateDetectionService;
