import type { Transaction, Category } from '../types';

interface CategoryPattern {
  categoryId: string;
  keywords: string[];
  merchants: string[];
  amountRanges?: { min?: number; max?: number }[];
  confidence: number;
}

interface CategorizationSuggestion {
  categoryId: string;
  confidence: number;
  reason: string;
}

export class SmartCategorizationService {
  private patterns: Map<string, CategoryPattern> = new Map();
  private merchantCategoryMap: Map<string, { categoryId: string; count: number }[]> = new Map();
  private keywordCategoryMap: Map<string, { categoryId: string; count: number }[]> = new Map();
  private learningHistory: Map<string, { merchantConfidence: number; keywordConfidence: number }> = new Map();
  private userCorrections: Map<string, Map<string, number>> = new Map(); // merchant -> categoryId -> count
  private rejectedSuggestions: Map<string, Set<string>> = new Map(); // transactionDescription -> rejected categoryIds

  /**
   * Learn from existing categorized transactions
   */
  learnFromTransactions(transactions: Transaction[], categories: Category[]) {
    // Reset patterns
    this.patterns.clear();
    this.merchantCategoryMap.clear();
    this.keywordCategoryMap.clear();

    // Group transactions by category
    const transactionsByCategory = new Map<string, Transaction[]>();
    
    transactions.forEach(transaction => {
      if (transaction.category) {
        const existing = transactionsByCategory.get(transaction.category) || [];
        existing.push(transaction);
        transactionsByCategory.set(transaction.category, existing);
      }
    });

    // Build patterns for each category
    transactionsByCategory.forEach((categoryTransactions, categoryId) => {
      const pattern = this.buildCategoryPattern(categoryId, categoryTransactions);
      this.patterns.set(categoryId, pattern);

      // Build merchant map
      categoryTransactions.forEach(transaction => {
        const merchant = this.extractMerchant(transaction.description);
        if (merchant) {
          const existing = this.merchantCategoryMap.get(merchant) || [];
          const categoryEntry = existing.find(e => e.categoryId === categoryId);
          if (categoryEntry) {
            categoryEntry.count++;
          } else {
            existing.push({ categoryId, count: 1 });
          }
          this.merchantCategoryMap.set(merchant, existing);
        }
      });

      // Build keyword map
      const keywords = this.extractKeywords(categoryTransactions);
      keywords.forEach(keyword => {
        const existing = this.keywordCategoryMap.get(keyword) || [];
        const categoryEntry = existing.find(e => e.categoryId === categoryId);
        if (categoryEntry) {
          categoryEntry.count++;
        } else {
          existing.push({ categoryId, count: 1 });
        }
        this.keywordCategoryMap.set(keyword, existing);
      });
    });
  }

  /**
   * Suggest categories for a transaction
   */
  suggestCategories(transaction: Transaction, maxSuggestions: number = 3): CategorizationSuggestion[] {
    const suggestions: CategorizationSuggestion[] = [];
    const merchant = this.extractMerchant(transaction.description);
    const descriptionLower = transaction.description.toLowerCase();

    // Check merchant matches
    if (merchant) {
      const merchantCategories = this.merchantCategoryMap.get(merchant);
      if (merchantCategories) {
        merchantCategories
          .sort((a, b) => b.count - a.count)
          .slice(0, 2)
          .forEach(mc => {
            suggestions.push({
              categoryId: mc.categoryId,
              confidence: Math.min(0.9, 0.7 + (mc.count * 0.02)),
              reason: `Merchant "${merchant}" frequently categorized here`
            });
          });
      }
    }

    // Check keyword matches
    const words = descriptionLower.split(/\s+/);
    const keywordMatches = new Map<string, number>();

    words.forEach(word => {
      if (word.length > 3) { // Skip short words
        const keywordCategories = this.keywordCategoryMap.get(word);
        if (keywordCategories) {
          keywordCategories.forEach(kc => {
            const current = keywordMatches.get(kc.categoryId) || 0;
            keywordMatches.set(kc.categoryId, current + kc.count);
          });
        }
      }
    });

    // Convert keyword matches to suggestions
    Array.from(keywordMatches.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .forEach(([categoryId, matchCount]) => {
        // Don't duplicate merchant suggestions
        if (!suggestions.find(s => s.categoryId === categoryId)) {
          suggestions.push({
            categoryId,
            confidence: Math.min(0.7, 0.4 + (matchCount * 0.05)),
            reason: 'Keywords match previous transactions'
          });
        }
      });

    // Check patterns (amount ranges, etc.)
    this.patterns.forEach((pattern, categoryId) => {
      if (!suggestions.find(s => s.categoryId === categoryId)) {
        let confidence = 0;
        let matches = 0;

        // Check amount ranges
        if (pattern.amountRanges && pattern.amountRanges.length > 0) {
          const amount = Math.abs(transaction.amount);
          const inRange = pattern.amountRanges.some(range => {
            const min = range.min || 0;
            const max = range.max || Infinity;
            return amount >= min && amount <= max;
          });
          if (inRange) {
            confidence += 0.2;
            matches++;
          }
        }

        // Check specific keywords in pattern
        if (pattern.keywords.some(keyword => descriptionLower.includes(keyword))) {
          confidence += 0.3;
          matches++;
        }

        if (matches > 0 && confidence > 0.3) {
          suggestions.push({
            categoryId,
            confidence: Math.min(confidence, 0.6),
            reason: 'Matches category patterns'
          });
        }
      }
    });

    // Sort by confidence and limit
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);
  }

  /**
   * Auto-categorize transactions with high confidence
   */
  autoCategorize(
    transactions: Transaction[],
    confidenceThreshold: number = 0.8
  ): { transaction: Transaction; categoryId: string; confidence: number }[] {
    const results: { transaction: Transaction; categoryId: string; confidence: number }[] = [];

    transactions.forEach(transaction => {
      if (!transaction.category) {
        const suggestions = this.suggestCategories(transaction, 1);
        if (suggestions.length > 0) {
          const topSuggestion = suggestions[0];
          if (topSuggestion && topSuggestion.confidence >= confidenceThreshold) {
            results.push({
              transaction,
              categoryId: topSuggestion.categoryId,
              confidence: topSuggestion.confidence
            });
          }
        }
      }
    });

    return results;
  }

  /**
   * Build pattern for a category from its transactions
   */
  private buildCategoryPattern(categoryId: string, transactions: Transaction[]): CategoryPattern {
    const merchants = new Set<string>();
    const keywords = new Set<string>();
    const amounts = transactions.map(t => Math.abs(t.amount));

    // Extract merchants
    transactions.forEach(transaction => {
      const merchant = this.extractMerchant(transaction.description);
      if (merchant) {
        merchants.add(merchant);
      }
    });

    // Extract common keywords
    const allWords = transactions
      .flatMap(t => t.description.toLowerCase().split(/\s+/))
      .filter(word => word.length > 3);
    
    const wordFrequency = new Map<string, number>();
    allWords.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });

    // Keep words that appear in at least 20% of transactions
    const threshold = transactions.length * 0.2;
    wordFrequency.forEach((count, word) => {
      if (count >= threshold) {
        keywords.add(word);
      }
    });

    // Calculate amount ranges
    const amountRanges: { min?: number; max?: number }[] = [];
    if (amounts.length > 0) {
      amounts.sort((a, b) => a - b);
      const q1Index = Math.floor(amounts.length * 0.25);
      const q3Index = Math.floor(amounts.length * 0.75);
      const q1 = amounts[q1Index] ?? 0;
      const q3 = amounts[q3Index] ?? 0;
      const iqr = q3 - q1;
      
      amountRanges.push({
        min: Math.max(0, q1 - 1.5 * iqr),
        max: q3 + 1.5 * iqr
      });
    }

    return {
      categoryId,
      keywords: Array.from(keywords),
      merchants: Array.from(merchants),
      amountRanges,
      confidence: Math.min(0.9, 0.5 + (transactions.length * 0.01))
    };
  }

  /**
   * Extract merchant name from transaction description
   */
  private extractMerchant(description: string): string | null {
    // Remove common prefixes
    const cleaned = description
      .replace(/^(CARD PURCHASE|DIRECT DEBIT|STANDING ORDER|BANK TRANSFER|POS|CONTACTLESS|ONLINE)[\s-]*/i, '')
      .replace(/^(TO|FROM)[\s-]*/i, '')
      .trim();

    // Extract first significant part (usually merchant name)
    const parts = cleaned.split(/[\s-]/);
    if (parts.length > 0) {
      // Take first 2-3 parts as merchant name
      const merchantParts = parts.slice(0, Math.min(3, parts.length));
      const merchant = merchantParts
        .filter(part => part.length > 2)
        .join(' ')
        .toLowerCase();
      
      return merchant || null;
    }

    return null;
  }

  /**
   * Extract keywords from transactions
   */
  private extractKeywords(transactions: Transaction[]): string[] {
    const wordFrequency = new Map<string, number>();
    
    transactions.forEach(transaction => {
      const words = transaction.description
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isCommonWord(word));
      
      words.forEach(word => {
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      });
    });

    // Return words that appear in multiple transactions
    return Array.from(wordFrequency.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  /**
   * Check if word is too common to be useful
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'card', 'purchase', 'payment', 'direct', 'debit', 'transfer',
      'bank', 'online', 'contactless', 'from', 'with', 'the', 'and',
      'for', 'pos', 'gbp', 'ref', 'trans', 'transaction'
    ]);
    return commonWords.has(word);
  }

  /**
   * Learn from a single transaction categorization (real-time learning)
   */
  learnFromCategorization(transaction: Transaction, categoryId: string) {
    const merchant = this.extractMerchant(transaction.description);
    const words = transaction.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    // Update merchant map
    if (merchant) {
      const existing = this.merchantCategoryMap.get(merchant) || [];
      const categoryEntry = existing.find(e => e.categoryId === categoryId);
      
      if (categoryEntry) {
        categoryEntry.count++;
      } else {
        existing.push({ categoryId, count: 1 });
      }
      
      this.merchantCategoryMap.set(merchant, existing);
    }
    
    // Update keyword map
    words.forEach(word => {
      if (!this.isCommonWord(word)) {
        const existing = this.keywordCategoryMap.get(word) || [];
        const categoryEntry = existing.find(e => e.categoryId === categoryId);
        
        if (categoryEntry) {
          categoryEntry.count++;
        } else {
          existing.push({ categoryId, count: 1 });
        }
        
        this.keywordCategoryMap.set(word, existing);
      }
    });
    
    // Update pattern for this category
    const pattern = this.patterns.get(categoryId);
    if (pattern) {
      // Update amount ranges
      const amount = Math.abs(transaction.amount);
      if (pattern.amountRanges && pattern.amountRanges.length > 0) {
        const range = pattern.amountRanges[0];
        if (range) {
          if (range.min && amount < range.min) {
            range.min = amount * 0.9; // Add 10% buffer
          }
          if (range.max && amount > range.max) {
            range.max = amount * 1.1; // Add 10% buffer
          }
        }
      }
      
      // Add new merchants and keywords
      if (merchant && !pattern.merchants.includes(merchant)) {
        pattern.merchants.push(merchant);
      }
      
      words.forEach(word => {
        if (!this.isCommonWord(word) && !pattern.keywords.includes(word)) {
          pattern.keywords.push(word);
        }
      });
      
      // Increase confidence slightly
      pattern.confidence = Math.min(0.95, pattern.confidence + 0.01);
    } else {
      // Create new pattern for this category
      this.patterns.set(categoryId, {
        categoryId,
        keywords: words.filter(w => !this.isCommonWord(w)),
        merchants: merchant ? [merchant] : [],
        amountRanges: [{
          min: Math.abs(transaction.amount) * 0.8,
          max: Math.abs(transaction.amount) * 1.2
        }],
        confidence: 0.6
      });
    }
  }

  /**
   * Get learning statistics
   */
  getStats(): {
    patternsLearned: number;
    merchantsKnown: number;
    keywordsIdentified: number;
  } {
    return {
      patternsLearned: this.patterns.size,
      merchantsKnown: this.merchantCategoryMap.size,
      keywordsIdentified: this.keywordCategoryMap.size
    };
  }

  /**
   * Learn from user correction - when user accepts a different category
   */
  learnFromCorrection(transaction: Transaction, categoryId: string) {
    const merchant = this.extractMerchant(transaction.description);
    
    if (merchant) {
      // Update user corrections map
      if (!this.userCorrections.has(merchant)) {
        this.userCorrections.set(merchant, new Map());
      }
      const merchantCorrections = this.userCorrections.get(merchant)!;
      const currentCount = merchantCorrections.get(categoryId) || 0;
      merchantCorrections.set(categoryId, currentCount + 1);
      
      // Also update the main merchant map with higher weight
      const merchantCategories = this.merchantCategoryMap.get(merchant) || [];
      const existingCategory = merchantCategories.find(mc => mc.categoryId === categoryId);
      
      if (existingCategory) {
        existingCategory.count += 3; // Give more weight to user corrections
      } else {
        merchantCategories.push({ categoryId, count: 3 });
      }
      
      this.merchantCategoryMap.set(merchant, merchantCategories);
    }
    
    // Update keyword associations
    const words = transaction.description.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 3) {
        const keywordCategories = this.keywordCategoryMap.get(word) || [];
        const existingCategory = keywordCategories.find(kc => kc.categoryId === categoryId);
        
        if (existingCategory) {
          existingCategory.count += 2; // Give more weight to corrections
        } else {
          keywordCategories.push({ categoryId, count: 2 });
        }
        
        this.keywordCategoryMap.set(word, keywordCategories);
      }
    });
  }

  /**
   * Learn from rejection - when user indicates a suggestion is wrong
   */
  learnFromRejection(transaction: Transaction, categoryId: string) {
    const descriptionKey = transaction.description.toLowerCase();
    
    // Track rejected suggestions
    if (!this.rejectedSuggestions.has(descriptionKey)) {
      this.rejectedSuggestions.set(descriptionKey, new Set());
    }
    this.rejectedSuggestions.get(descriptionKey)!.add(categoryId);
    
    // Reduce confidence for this merchant-category combination
    const merchant = this.extractMerchant(transaction.description);
    if (merchant) {
      const merchantCategories = this.merchantCategoryMap.get(merchant);
      if (merchantCategories) {
        const category = merchantCategories.find(mc => mc.categoryId === categoryId);
        if (category && category.count > 0) {
          category.count = Math.max(0, category.count - 1);
        }
      }
    }
  }

  /**
   * Check if a suggestion was previously rejected
   */
  private wasRejected(transaction: Transaction, categoryId: string): boolean {
    const descriptionKey = transaction.description.toLowerCase();
    const rejected = this.rejectedSuggestions.get(descriptionKey);
    return rejected ? rejected.has(categoryId) : false;
  }
}

export const smartCategorizationService = new SmartCategorizationService();