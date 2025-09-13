/**
 * Spending Patterns Service
 * Handles all business logic for spending pattern analysis
 */

import { dataIntelligenceService } from './dataIntelligenceService';
import type { SpendingPattern } from './dataIntelligenceService';
import { logger } from './loggingService';

export interface PatternStats {
  totalPatterns: number;
  recurringCount: number;
  highConfidenceCount: number;
  anomalyCount: number;
}

export interface PatternDistribution {
  type: string;
  count: number;
  percentage: number;
}

export type SortOption = 'confidence' | 'amount' | 'detectedAt' | 'frequency';
export type PatternType = 'all' | 'recurring' | 'seasonal' | 'trend' | 'anomaly';

class SpendingPatternsService {
  /**
   * Load spending patterns from data intelligence service
   */
  loadPatterns(): SpendingPattern[] {
    try {
      return dataIntelligenceService.getSpendingPatterns();
    } catch (error) {
      logger.error('Error loading spending patterns:', error);
      return [];
    }
  }

  /**
   * Analyze patterns (simulated for now)
   */
  async analyzePatterns(): Promise<SpendingPattern[]> {
    try {
      // Simulate analysis process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, this would analyze actual transactions
      return this.loadPatterns();
    } catch (error) {
      logger.error('Error analyzing patterns:', error);
      throw error;
    }
  }

  /**
   * Calculate pattern statistics
   */
  calculateStats(patterns: SpendingPattern[]): PatternStats {
    const activePatterns = patterns.filter(p => p.isActive);
    
    return {
      totalPatterns: activePatterns.length,
      recurringCount: activePatterns.filter(p => p.patternType === 'recurring').length,
      highConfidenceCount: activePatterns.filter(p => p.confidence >= 0.8).length,
      anomalyCount: activePatterns.filter(p => p.patternType === 'anomaly').length
    };
  }

  /**
   * Calculate pattern distribution
   */
  calculateDistribution(patterns: SpendingPattern[]): PatternDistribution[] {
    const activePatterns = patterns.filter(p => p.isActive);
    const types: PatternType[] = ['recurring', 'seasonal', 'trend', 'anomaly'];
    
    return types.map(type => {
      const count = activePatterns.filter(p => p.patternType === type).length;
      const percentage = activePatterns.length > 0 
        ? (count / activePatterns.length) * 100 
        : 0;
      
      return {
        type,
        count,
        percentage
      };
    });
  }

  /**
   * Filter patterns based on type and category
   */
  filterPatterns(
    patterns: SpendingPattern[],
    selectedType: string,
    selectedCategory: string
  ): SpendingPattern[] {
    return patterns.filter(pattern => {
      const matchesType = selectedType === 'all' || pattern.patternType === selectedType;
      const matchesCategory = selectedCategory === 'all' || pattern.category === selectedCategory;
      return matchesType && matchesCategory && pattern.isActive;
    });
  }

  /**
   * Sort patterns based on selected criteria
   */
  sortPatterns(patterns: SpendingPattern[], sortBy: SortOption): SpendingPattern[] {
    return [...patterns].sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'amount':
          return b.amount - a.amount;
        case 'detectedAt':
          return b.detectedAt.getTime() - a.detectedAt.getTime();
        case 'frequency':
          return a.frequency.localeCompare(b.frequency);
        default:
          return 0;
      }
    });
  }

  /**
   * Get unique categories from patterns
   */
  getCategories(patterns: SpendingPattern[]): string[] {
    const categories = new Set(patterns.map(p => p.category));
    return ['all', ...Array.from(categories)];
  }

  /**
   * Get pattern type icon name
   */
  getPatternTypeIcon(type: SpendingPattern['patternType']): string {
    switch (type) {
      case 'recurring':
        return 'calendar';
      case 'seasonal':
        return 'clock';
      case 'trend':
        return 'trending-up';
      case 'anomaly':
        return 'alert-circle';
      default:
        return 'bar-chart-3';
    }
  }

  /**
   * Get pattern type color classes
   */
  getPatternTypeColor(type: SpendingPattern['patternType']): string {
    switch (type) {
      case 'recurring':
        return 'bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-blue-200';
      case 'seasonal':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200';
      case 'trend':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 'anomaly':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  }

  /**
   * Get confidence color classes
   */
  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }

  /**
   * Get confidence badge classes
   */
  getConfidenceBadge(confidence: number): string {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
  }

  /**
   * Format currency value
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Format date value
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

export const spendingPatternsService = new SpendingPatternsService();