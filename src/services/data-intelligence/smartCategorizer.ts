import type { Transaction, Category } from '../../types';
import type { SmartCategory, SmartCategoryRule } from './types';
import { logger } from '../loggingService';

/**
 * Smart categorization service
 * Uses machine learning-like rules to auto-categorize transactions
 */
export class SmartCategorizer {
  private smartCategories: SmartCategory[] = [];
  private readonly STORAGE_KEY = 'dataIntelligence_smartCategories';

  constructor() {
    this.loadCategories();
    this.initializeDefaultCategories();
  }

  /**
   * Load categories from storage
   */
  private loadCategories(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.smartCategories = JSON.parse(stored, (key, value) => {
          if (key === 'createdAt' || key === 'lastTrained') {
            return new Date(value);
          }
          return value;
        });
      }
    } catch (error) {
      logger.error('Failed to load smart categories:', error);
    }
  }

  /**
   * Save categories to storage
   */
  private saveCategories(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.smartCategories));
    } catch (error) {
      logger.error('Failed to save smart categories:', error);
    }
  }

  /**
   * Initialize default categories
   */
  private initializeDefaultCategories(): void {
    if (this.smartCategories.length === 0) {
      const defaultCategories: Omit<SmartCategory, 'id' | 'createdAt' | 'lastTrained'>[] = [
        {
          name: 'Subscriptions',
          confidence: 0.9,
          rules: [
            { type: 'merchant', condition: 'contains', value: 'netflix', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'spotify', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'adobe', weight: 0.8 }
          ],
          merchantPatterns: ['netflix', 'spotify', 'adobe', 'microsoft', 'google'],
          descriptionPatterns: ['subscription', 'monthly', 'plan', 'premium'],
          amountRanges: [
            { min: 5, max: 50, weight: 0.8 },
            { min: 50, max: 200, weight: 0.6 }
          ]
        },
        {
          name: 'Coffee & Quick Bites',
          confidence: 0.85,
          rules: [
            { type: 'merchant', condition: 'contains', value: 'starbucks', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'coffee', weight: 0.8 },
            { type: 'amount', condition: 'range', value: 15, weight: 0.7 }
          ],
          merchantPatterns: ['starbucks', 'dunkin', 'coffee', 'cafe'],
          descriptionPatterns: ['coffee', 'latte', 'espresso', 'cafe'],
          amountRanges: [
            { min: 2, max: 25, weight: 0.9 }
          ]
        },
        {
          name: 'Gas & Fuel',
          confidence: 0.9,
          rules: [
            { type: 'merchant', condition: 'contains', value: 'shell', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'exxon', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'chevron', weight: 0.9 }
          ],
          merchantPatterns: ['shell', 'exxon', 'chevron', 'bp', 'mobil', 'gas'],
          descriptionPatterns: ['fuel', 'gas', 'gasoline', 'petrol'],
          amountRanges: [
            { min: 20, max: 100, weight: 0.8 }
          ]
        },
        {
          name: 'Groceries',
          confidence: 0.85,
          rules: [
            { type: 'merchant', condition: 'contains', value: 'walmart', weight: 0.8 },
            { type: 'merchant', condition: 'contains', value: 'kroger', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'whole foods', weight: 0.9 }
          ],
          merchantPatterns: ['walmart', 'kroger', 'safeway', 'whole foods', 'trader joe'],
          descriptionPatterns: ['grocery', 'supermarket', 'market'],
          amountRanges: [
            { min: 30, max: 300, weight: 0.7 }
          ]
        },
        {
          name: 'Restaurants',
          confidence: 0.8,
          rules: [
            { type: 'description', condition: 'contains', value: 'restaurant', weight: 0.9 },
            { type: 'description', condition: 'contains', value: 'grill', weight: 0.8 },
            { type: 'amount', condition: 'range', value: 50, weight: 0.6 }
          ],
          merchantPatterns: ['restaurant', 'grill', 'kitchen', 'bistro'],
          descriptionPatterns: ['dining', 'dinner', 'lunch', 'breakfast'],
          amountRanges: [
            { min: 15, max: 150, weight: 0.7 }
          ]
        }
      ];

      this.smartCategories = defaultCategories.map((cat, index) => ({
        ...cat,
        id: `smart-cat-${index + 1}`,
        createdAt: new Date(),
        lastTrained: new Date()
      }));
      
      this.saveCategories();
    }
  }

  /**
   * Suggest category for transaction
   */
  suggestCategory(transaction: Transaction): { category: string; confidence: number } | null {
    const scores = new Map<string, number>();
    const description = transaction.description.toLowerCase();
    const amount = Math.abs(transaction.amount);
    
    // Evaluate each smart category
    this.smartCategories.forEach(category => {
      let score = 0;
      let totalWeight = 0;
      
      // Check merchant patterns
      const merchantMatch = category.merchantPatterns.some(pattern => 
        description.includes(pattern.toLowerCase())
      );
      if (merchantMatch) {
        score += 0.4;
        totalWeight += 0.4;
      }
      
      // Check description patterns
      const descriptionMatch = category.descriptionPatterns.some(pattern => 
        description.includes(pattern.toLowerCase())
      );
      if (descriptionMatch) {
        score += 0.3;
        totalWeight += 0.3;
      }
      
      // Check amount ranges
      const amountMatch = category.amountRanges.some(range => 
        amount >= range.min && amount <= range.max
      );
      if (amountMatch) {
        const matchingRange = category.amountRanges.find(range => 
          amount >= range.min && amount <= range.max
        );
        if (matchingRange) {
          score += 0.3 * matchingRange.weight;
          totalWeight += 0.3;
        }
      }
      
      // Apply rules
      category.rules.forEach(rule => {
        if (this.evaluateRule(rule, transaction)) {
          score += rule.weight * 0.5;
          totalWeight += rule.weight * 0.5;
        }
      });
      
      // Normalize score
      const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;
      scores.set(category.name, normalizedScore * category.confidence);
    });
    
    // Find best match
    let bestCategory: string | null = null;
    let bestScore = 0;
    
    scores.forEach((score, category) => {
      if (score > bestScore && score > 0.5) { // Minimum threshold of 0.5
        bestScore = score;
        bestCategory = category;
      }
    });
    
    return bestCategory ? { category: bestCategory, confidence: bestScore } : null;
  }

  /**
   * Evaluate a rule
   */
  private evaluateRule(rule: SmartCategoryRule, transaction: Transaction): boolean {
    const description = transaction.description.toLowerCase();
    const amount = Math.abs(transaction.amount);
    
    switch (rule.type) {
      case 'merchant':
      case 'description':
        const text = rule.type === 'merchant' ? description : description;
        const value = String(rule.value).toLowerCase();
        
        switch (rule.condition) {
          case 'contains':
            return text.includes(value);
          case 'equals':
            return text === value;
          case 'starts_with':
            return text.startsWith(value);
          case 'ends_with':
            return text.endsWith(value);
          case 'regex':
            try {
              return new RegExp(value).test(text);
            } catch {
              return false;
            }
          default:
            return false;
        }
      
      case 'amount':
        if (rule.condition === 'range' && typeof rule.value === 'number') {
          // Assume range is +/- 50% of value
          const min = rule.value * 0.5;
          const max = rule.value * 1.5;
          return amount >= min && amount <= max;
        }
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Train from user feedback
   */
  trainFromFeedback(
    transaction: Transaction,
    actualCategory: string,
    wasCorrect: boolean
  ): void {
    const category = this.smartCategories.find(c => c.name === actualCategory);
    if (!category) return;
    
    const description = transaction.description.toLowerCase();
    const amount = Math.abs(transaction.amount);
    
    if (wasCorrect) {
      // Strengthen patterns
      category.confidence = Math.min(category.confidence * 1.1, 1);
      
      // Add new patterns if not present
      const merchant = this.extractMerchant(description);
      if (!category.merchantPatterns.includes(merchant)) {
        category.merchantPatterns.push(merchant);
      }
    } else {
      // Weaken confidence slightly
      category.confidence = Math.max(category.confidence * 0.95, 0.5);
    }
    
    category.lastTrained = new Date();
    this.saveCategories();
  }

  /**
   * Extract merchant from description
   */
  private extractMerchant(description: string): string {
    return description
      .replace(/\*\d+/, '')
      .replace(/#\d+/, '')
      .split(' ')
      .slice(0, 2)
      .join(' ')
      .trim();
  }

  /**
   * Get all smart categories
   */
  getCategories(): SmartCategory[] {
    return this.smartCategories;
  }

  /**
   * Add custom category
   */
  addCustomCategory(category: Omit<SmartCategory, 'id' | 'createdAt' | 'lastTrained'>): void {
    const newCategory: SmartCategory = {
      ...category,
      id: `smart-cat-custom-${Date.now()}`,
      createdAt: new Date(),
      lastTrained: new Date()
    };
    
    this.smartCategories.push(newCategory);
    this.saveCategories();
  }

  /**
   * Remove category
   */
  removeCategory(id: string): void {
    this.smartCategories = this.smartCategories.filter(c => c.id !== id);
    this.saveCategories();
  }
}

export const smartCategorizer = new SmartCategorizer();