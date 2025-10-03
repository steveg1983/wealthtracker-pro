import type { ColumnMapping } from './types';
import { dateParser } from './dateParser';
import { amountParser } from './amountParser';

/**
 * Column mapping utilities
 * Handles intelligent field mapping using fuzzy matching
 */
export class ColumnMapper {
  /**
   * Suggest mappings based on headers
   */
  suggestMappings(headers: string[], type: 'transaction' | 'account'): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    if (type === 'transaction') {
      mappings.push(...this.getTransactionMappings(headers, normalizedHeaders));
    } else {
      mappings.push(...this.getAccountMappings(headers, normalizedHeaders));
    }
    
    return mappings;
  }

  /**
   * Get transaction field mappings
   */
  private getTransactionMappings(headers: string[], normalizedHeaders: string[]): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];

    // Date mapping
    const datePatterns = ['date', 'transaction date', 'posted', 'trans date', 'value date'];
    const dateIndex = this.findBestMatch(normalizedHeaders, datePatterns);
    if (dateIndex >= 0) {
      mappings.push({
        sourceColumn: headers[dateIndex],
        targetField: 'date',
        transform: (value: string) => dateParser.parseDate(value)
      });
    }
    
    // Description mapping
    const descPatterns = ['description', 'desc', 'memo', 'details', 'transaction'];
    const descIndex = this.findBestMatch(normalizedHeaders, descPatterns);
    if (descIndex >= 0) {
      mappings.push({
        sourceColumn: headers[descIndex],
        targetField: 'description'
      });
    }
    
    // Amount mapping
    const amountPatterns = ['amount', 'value', 'debit', 'credit', 'charge'];
    const amountIndex = this.findBestMatch(normalizedHeaders, amountPatterns);
    if (amountIndex >= 0) {
      mappings.push({
        sourceColumn: headers[amountIndex],
        targetField: 'amount',
        transform: (value: string) => amountParser.parseAmount(value)
      });
    }
    
    // Category mapping
    const categoryPatterns = ['category', 'cat', 'type', 'classification'];
    const categoryIndex = this.findBestMatch(normalizedHeaders, categoryPatterns);
    if (categoryIndex >= 0) {
      mappings.push({
        sourceColumn: headers[categoryIndex],
        targetField: 'category'
      });
    }
    
    // Account mapping
    const accountPatterns = ['account', 'acc', 'account name', 'from account'];
    const accountIndex = this.findBestMatch(normalizedHeaders, accountPatterns);
    if (accountIndex >= 0) {
      mappings.push({
        sourceColumn: headers[accountIndex],
        targetField: 'accountName'
      });
    }

    return mappings;
  }

  /**
   * Get account field mappings
   */
  private getAccountMappings(headers: string[], normalizedHeaders: string[]): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];

    const namePatterns = ['name', 'account name', 'account', 'description'];
    const nameIndex = this.findBestMatch(normalizedHeaders, namePatterns);
    if (nameIndex >= 0) {
      mappings.push({
        sourceColumn: headers[nameIndex],
        targetField: 'name'
      });
    }
    
    const balancePatterns = ['balance', 'current balance', 'amount', 'value'];
    const balanceIndex = this.findBestMatch(normalizedHeaders, balancePatterns);
    if (balanceIndex >= 0) {
      mappings.push({
        sourceColumn: headers[balanceIndex],
        targetField: 'balance',
        transform: (value: string) => amountParser.parseAmount(value)
      });
    }
    
    const typePatterns = ['type', 'account type', 'category'];
    const typeIndex = this.findBestMatch(normalizedHeaders, typePatterns);
    if (typeIndex >= 0) {
      mappings.push({
        sourceColumn: headers[typeIndex],
        targetField: 'type'
      });
    }

    return mappings;
  }

  /**
   * Find best matching header using fuzzy search
   */
  private findBestMatch(headers: string[], patterns: string[]): number {
    let bestIndex = -1;
    let bestScore = 0;
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      for (const pattern of patterns) {
        const score = this.calculateSimilarity(header, pattern.toLowerCase());
        if (score > bestScore && score > 0.6) { // 60% similarity threshold
          bestScore = score;
          bestIndex = i;
        }
      }
    }
    
    return bestIndex;
  }

  /**
   * Calculate string similarity (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
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
}

export const columnMapper = new ColumnMapper();