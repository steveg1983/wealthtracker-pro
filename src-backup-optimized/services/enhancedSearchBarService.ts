/**
 * Enhanced Search Bar Service
 * Business logic for enhanced search functionality
 */

import { searchService } from './searchService';
import type { SearchOptions } from './searchService';

export interface SearchAggregations {
  totalAmount?: number;
  averageAmount?: number;
  countByType?: Record<string, number>;
}

class EnhancedSearchBarService {
  /**
   * Check if any filters are active
   */
  hasActiveFilters(options: SearchOptions): boolean {
    return Object.keys(options).some(key => {
      const value = options[key as keyof SearchOptions];
      return value !== undefined && value !== '' && 
             (!Array.isArray(value) || value.length > 0);
    });
  }

  /**
   * Get active filter count
   */
  getActiveFilterCount(options: SearchOptions): number {
    return Object.keys(options).filter(key => {
      const value = options[key as keyof SearchOptions];
      return value !== undefined && value !== '' && 
             (!Array.isArray(value) || value.length > 0);
    }).length;
  }

  /**
   * Format date for display
   */
  formatDateForDisplay(date: string | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  }

  /**
   * Parse amount input
   */
  parseAmountInput(value: string): number | undefined {
    return value ? parseFloat(value) : undefined;
  }

  /**
   * Get search placeholder text
   */
  getSearchPlaceholder(naturalLanguageMode: boolean): string {
    return naturalLanguageMode 
      ? "Try 'expenses over $100 last month' or 'income this year'"
      : "Search transactions, accounts, categories...";
  }

  /**
   * Get search input classes
   */
  getSearchInputClasses(naturalLanguageMode: boolean): string {
    const baseClasses = 'w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors text-gray-900 dark:text-white';
    
    if (naturalLanguageMode) {
      return `${baseClasses} border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20`;
    }
    
    return `${baseClasses} border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800`;
  }

  /**
   * Filter valid suggestions
   */
  filterSuggestions(suggestions: string[], query: string): string[] {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    return suggestions
      .filter(s => s.toLowerCase().includes(lowerQuery))
      .slice(0, 5);
  }

  /**
   * Handle keyboard navigation
   */
  getNextSuggestionIndex(
    current: number,
    direction: 'up' | 'down',
    total: number
  ): number {
    if (direction === 'down') {
      return current < total - 1 ? current + 1 : 0;
    } else {
      return current > 0 ? current - 1 : total - 1;
    }
  }

  /**
   * Should show suggestions
   */
  shouldShowSuggestions(
    query: string,
    suggestions: string[],
    isFocused: boolean
  ): boolean {
    return isFocused && query.length > 0 && suggestions.length > 0;
  }

  /**
   * Reset filters to defaults
   */
  getDefaultFilters(): Partial<SearchOptions> {
    return {
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: undefined,
      amountMax: undefined,
      categoryIds: [],
      accountIds: [],
      tags: []
    };
  }

  /**
   * Validate date range
   */
  validateDateRange(dateFrom?: string, dateTo?: string): boolean {
    if (!dateFrom || !dateTo) return true;
    return new Date(dateFrom) <= new Date(dateTo);
  }

  /**
   * Validate amount range
   */
  validateAmountRange(amountMin?: number, amountMax?: number): boolean {
    if (amountMin === undefined || amountMax === undefined) return true;
    return amountMin <= amountMax;
  }

  /**
   * Get filter summary text
   */
  getFilterSummary(options: SearchOptions): string {
    const parts: string[] = [];
    
    if (options.dateFrom || options.dateTo) {
      parts.push('Date range');
    }
    if (options.amountMin !== undefined || options.amountMax !== undefined) {
      parts.push('Amount range');
    }
    if (options.categoryIds?.length) {
      parts.push(`${options.categoryIds.length} categories`);
    }
    if (options.accountIds?.length) {
      parts.push(`${options.accountIds.length} accounts`);
    }
    if (options.tags?.length) {
      parts.push(`${options.tags.length} tags`);
    }
    
    return parts.join(', ');
  }
}

export const enhancedSearchBarService = new EnhancedSearchBarService();