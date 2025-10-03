import { dataIntelligenceService } from './dataIntelligenceService';
import type { MerchantData, MerchantEnrichment } from './dataIntelligenceService';

export class MerchantEnrichmentService {
  /**
   * Get confidence level color
   */
  static getConfidenceColor(confidence: number): string {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }

  /**
   * Get confidence level background
   */
  static getConfidenceBackground(confidence: number): string {
    if (confidence >= 0.9) return 'bg-green-100 dark:bg-green-900/20';
    if (confidence >= 0.7) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  }

  /**
   * Get frequency label
   */
  static getFrequencyLabel(frequency: string): string {
    const labels: Record<string, string> = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'monthly': 'Monthly',
      'quarterly': 'Quarterly',
      'yearly': 'Yearly',
      'one-time': 'One-time'
    };
    return labels[frequency] || frequency;
  }

  /**
   * Get frequency color
   */
  static getFrequencyColor(frequency: string): string {
    const colors: Record<string, string> = {
      'daily': 'text-purple-600',
      'weekly': 'text-blue-600',
      'monthly': 'text-green-600',
      'quarterly': 'text-yellow-600',
      'yearly': 'text-orange-600',
      'one-time': 'text-gray-600'
    };
    return colors[frequency] || 'text-gray-600';
  }

  /**
   * Sort merchants
   */
  static sortMerchants(
    merchants: MerchantData[],
    sortBy: 'name' | 'confidence' | 'frequency' | 'lastUpdated'
  ): MerchantData[] {
    const sorted = [...merchants];
    
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'confidence':
        return sorted.sort((a, b) => b.confidence - a.confidence);
      case 'frequency':
        const freqOrder: Record<string, number> = { daily: 0, weekly: 1, monthly: 2, quarterly: 3, yearly: 4, 'one-time': 5, irregular: 6 };
        return sorted.sort((a, b) => 
          (freqOrder[a.frequency] || 99) - (freqOrder[b.frequency] || 99)
        );
      case 'lastUpdated':
        return sorted.sort((a, b) => 
          b.lastUpdated.getTime() - a.lastUpdated.getTime()
        );
      default:
        return sorted;
    }
  }

  /**
   * Filter merchants
   */
  static filterMerchants(
    merchants: MerchantData[],
    searchTerm: string,
    category: string
  ): MerchantData[] {
    let filtered = [...merchants];
    
    // Apply search filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(lower) ||
        m.cleanName.toLowerCase().includes(lower) ||
        m.category?.toLowerCase().includes(lower) ||
        m.tags?.some(tag => tag.toLowerCase().includes(lower))
      );
    }
    
    // Apply category filter
    if (category && category !== 'all') {
      filtered = filtered.filter(m => m.category === category);
    }
    
    return filtered;
  }

  /**
   * Get unique categories from merchants
   */
  static getUniqueCategories(merchants: MerchantData[]): string[] {
    const categories = new Set<string>();
    merchants.forEach(m => {
      if (m.category) categories.add(m.category);
    });
    return Array.from(categories).sort();
  }

  /**
   * Calculate merchant statistics
   */
  static calculateStats(merchants: MerchantData[]) {
    const total = merchants.length;
    const highConfidence = merchants.filter(m => m.confidence >= 0.9).length;
    const mediumConfidence = merchants.filter(m => m.confidence >= 0.7 && m.confidence < 0.9).length;
    const lowConfidence = merchants.filter(m => m.confidence < 0.7).length;
    
    const avgConfidence = merchants.length > 0
      ? merchants.reduce((sum, m) => sum + m.confidence, 0) / merchants.length
      : 0;
    
    const categoryBreakdown = merchants.reduce((acc, m) => {
      const cat = m.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      avgConfidence,
      categoryBreakdown
    };
  }

  /**
   * Get enrichment quality badge
   */
  static getEnrichmentQualityBadge(enrichment: MerchantEnrichment) {
    const score = enrichment.confidence * 100;
    
    if (score >= 90) {
      return { label: 'Excellent', color: 'bg-green-500 text-white' };
    }
    if (score >= 75) {
      return { label: 'Good', color: 'bg-blue-500 text-white' };
    }
    if (score >= 60) {
      return { label: 'Fair', color: 'bg-yellow-500 text-white' };
    }
    return { label: 'Poor', color: 'bg-red-500 text-white' };
  }

  /**
   * Format last updated time
   */
  static formatLastUpdated(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Get mock merchant data for development
   */
  static getMockMerchants(): MerchantData[] {
    return [
      {
        id: '1',
        name: 'Amazon',
        cleanName: 'Amazon',
        category: 'Shopping',
        industry: 'E-commerce',
        frequency: 'monthly',
        tags: ['online', 'retail', 'marketplace'],
        confidence: 0.95,
        avgTransactionAmount: 45.99,
        createdAt: new Date('2024-01-01'),
        lastUpdated: new Date()
      },
      {
        id: '2',
        name: 'Netflix',
        cleanName: 'Netflix',
        category: 'Entertainment',
        industry: 'Streaming',
        frequency: 'monthly',
        tags: ['subscription', 'streaming', 'entertainment'],
        confidence: 0.98,
        avgTransactionAmount: 15.99,
        createdAt: new Date('2024-01-01'),
        lastUpdated: new Date()
      },
      {
        id: '3',
        name: 'Starbucks',
        cleanName: 'Starbucks',
        category: 'Food & Dining',
        industry: 'Coffee',
        frequency: 'daily',
        tags: ['coffee', 'food', 'chain'],
        confidence: 0.92,
        avgTransactionAmount: 5.85,
        createdAt: new Date('2024-01-01'),
        lastUpdated: new Date()
      }
    ];
  }
}