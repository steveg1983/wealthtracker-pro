import type { Transaction } from '../../types';
import type { MerchantData, MerchantEnrichment } from './types';
import { lazyLogger as logger } from '../serviceFactory';

/**
 * Merchant enrichment service
 * Cleans, categorizes, and enriches merchant data
 */
export class MerchantEnricher {
  private merchants: MerchantData[] = [];
  private readonly STORAGE_KEY = 'dataIntelligence_merchants';

  constructor() {
    this.loadMerchants();
  }

  /**
   * Load merchants from storage
   */
  private loadMerchants(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.merchants = JSON.parse(stored, (key, value) => {
          if (key === 'createdAt' || key === 'lastUpdated') {
            return new Date(value);
          }
          return value;
        });
      }
    } catch (error) {
      logger.error('Failed to load merchant data:', error);
    }
  }

  /**
   * Save merchants to storage
   */
  private saveMerchants(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.merchants));
    } catch (error) {
      logger.error('Failed to save merchant data:', error);
    }
  }

  /**
   * Enrich merchant from transaction description
   */
  enrichMerchant(transactionDescription: string): MerchantEnrichment {
    const cleanDescription = transactionDescription.toLowerCase().trim();
    
    // Find matching merchant
    const merchant = this.merchants.find(m => 
      m.tags.some(tag => cleanDescription.includes(tag.toLowerCase())) ||
      cleanDescription.includes(m.name.toLowerCase()) ||
      cleanDescription.includes(m.cleanName.toLowerCase())
    );

    if (merchant) {
      return {
        originalName: transactionDescription,
        cleanName: merchant.cleanName,
        category: merchant.category,
        industry: merchant.industry,
        confidence: merchant.confidence,
        logo: merchant.logo,
        website: merchant.website,
        description: merchant.description,
        suggestedTags: merchant.tags
      };
    }

    // Fallback enrichment based on patterns
    return this.performBasicEnrichment(transactionDescription);
  }

  /**
   * Learn merchant from transaction
   */
  learnMerchantFromTransaction(transaction: Transaction): MerchantData | null {
    const cleanName = this.cleanMerchantName(transaction.description);
    
    // Check if we already know this merchant
    let merchant = this.merchants.find(m => 
      m.cleanName.toLowerCase() === cleanName.toLowerCase()
    );
    
    if (!merchant) {
      // Create new merchant entry from transaction
      const enrichment = this.performBasicEnrichment(transaction.description);
      merchant = {
        id: `merchant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: cleanName,
        cleanName: cleanName,
        category: transaction.category || enrichment.category,
        industry: enrichment.industry,
        frequency: 'irregular',
        tags: enrichment.suggestedTags,
        confidence: enrichment.confidence,
        avgTransactionAmount: Math.abs(transaction.amount),
        createdAt: new Date(),
        lastUpdated: new Date()
      };
      
      this.merchants.push(merchant);
      this.saveMerchants();
    } else {
      // Update existing merchant with new transaction info
      const transactions = this.getMerchantTransactionCount(merchant.cleanName);
      const newAvg = merchant.avgTransactionAmount 
        ? (merchant.avgTransactionAmount * transactions + Math.abs(transaction.amount)) / (transactions + 1)
        : Math.abs(transaction.amount);
      
      merchant.avgTransactionAmount = newAvg;
      merchant.lastUpdated = new Date();
      this.saveMerchants();
    }
    
    return merchant;
  }

  /**
   * Clean merchant name
   */
  cleanMerchantName(description: string): string {
    // Remove common suffixes and clean up
    let cleaned = description
      .replace(/\*\d+/, '') // Remove *1234 type suffixes
      .replace(/#\d+/, '') // Remove #1234 type suffixes  
      .replace(/\d{2}\/\d{2}/, '') // Remove dates
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    // Extract just the merchant name (first 2-3 words usually)
    const words = cleaned.split(' ');
    if (words.length > 3) {
      cleaned = words.slice(0, 3).join(' ');
    }
    
    return cleaned;
  }

  /**
   * Perform basic enrichment using patterns
   */
  private performBasicEnrichment(description: string): MerchantEnrichment {
    const cleanDesc = description.toLowerCase();
    const cleanName = this.cleanMerchantName(description);
    
    // Check against patterns
    const patterns = this.getMerchantPatterns();
    
    for (const { pattern, category, industry, confidence } of patterns) {
      if (pattern.test(cleanDesc)) {
        return {
          originalName: description,
          cleanName,
          category,
          industry,
          confidence,
          suggestedTags: this.extractTags(cleanDesc, category)
        };
      }
    }
    
    // Default fallback
    return {
      originalName: description,
      cleanName,
      category: 'Other',
      industry: 'Unknown',
      confidence: 0.3,
      suggestedTags: []
    };
  }

  /**
   * Get merchant patterns
   */
  private getMerchantPatterns() {
    return [
      // Streaming & Subscriptions
      { pattern: /netflix|nflx/i, category: 'Entertainment', industry: 'Streaming', confidence: 0.95 },
      { pattern: /spotify|sptfy/i, category: 'Entertainment', industry: 'Music Streaming', confidence: 0.95 },
      { pattern: /hulu|disney\+|disney plus|paramount\+|hbo|max streaming/i, category: 'Entertainment', industry: 'Streaming', confidence: 0.9 },
      
      // Food & Dining
      { pattern: /starbucks|sbux/i, category: 'Food & Dining', industry: 'Coffee', confidence: 0.95 },
      { pattern: /dunkin|dnkn/i, category: 'Food & Dining', industry: 'Coffee', confidence: 0.95 },
      { pattern: /mcdonald|mcdonalds|mcd/i, category: 'Food & Dining', industry: 'Fast Food', confidence: 0.9 },
      { pattern: /doordash|uber eats|grubhub|postmates/i, category: 'Food & Dining', industry: 'Food Delivery', confidence: 0.9 },
      
      // Transportation
      { pattern: /uber(?!\s*eats)|lyft/i, category: 'Transportation', industry: 'Rideshare', confidence: 0.9 },
      { pattern: /shell|exxon|chevron|bp|mobil/i, category: 'Transportation', industry: 'Gas Station', confidence: 0.9 },
      
      // Groceries
      { pattern: /walmart|wal-mart|wmt/i, category: 'Groceries', industry: 'Supermarket', confidence: 0.85 },
      { pattern: /target|tgt/i, category: 'Shopping', industry: 'Retail', confidence: 0.85 },
      { pattern: /kroger|safeway|albertsons|publix/i, category: 'Groceries', industry: 'Supermarket', confidence: 0.9 },
      
      // E-commerce
      { pattern: /amazon|amzn/i, category: 'Shopping', industry: 'E-commerce', confidence: 0.9 },
      { pattern: /ebay/i, category: 'Shopping', industry: 'Marketplace', confidence: 0.9 },
      
      // Utilities
      { pattern: /electric|power|energy/i, category: 'Utilities', industry: 'Electricity', confidence: 0.85 },
      { pattern: /comcast|xfinity|spectrum|at&t|verizon/i, category: 'Utilities', industry: 'Telecom', confidence: 0.9 }
    ];
  }

  /**
   * Extract tags from description
   */
  private extractTags(description: string, category: string): string[] {
    const tags: string[] = [];
    const words = description.toLowerCase().split(/\s+/);
    
    // Add category as tag
    tags.push(category.toLowerCase());
    
    // Add significant words as tags
    const significantWords = words.filter(w => 
      w.length > 3 && 
      !['with', 'from', 'the', 'and', 'for'].includes(w)
    );
    
    tags.push(...significantWords.slice(0, 3));
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Get merchant transaction count (simplified)
   */
  private getMerchantTransactionCount(merchantName: string): number {
    // In a real implementation, this would query the database
    return 1;
  }

  /**
   * Get all merchants
   */
  getMerchants(): MerchantData[] {
    return this.merchants;
  }

  /**
   * Update merchant
   */
  updateMerchant(merchantId: string, updates: Partial<MerchantData>): void {
    const index = this.merchants.findIndex(m => m.id === merchantId);
    if (index >= 0) {
      this.merchants[index] = {
        ...this.merchants[index],
        ...updates,
        lastUpdated: new Date()
      };
      this.saveMerchants();
    }
  }
}

export const merchantEnricher = new MerchantEnricher();