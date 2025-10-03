/**
 * Virtualized List Service
 * Handles all business logic for virtualized list operations
 */

import type { Transaction } from '../types';

export interface VirtualizedListConfig {
  itemHeight: number;
  overscan: number;
  scrollToTopThreshold: number;
  estimatedItemSize: number;
  minimumBatchSize: number;
  loadMoreThreshold: number;
}

export interface VirtualItem {
  key: string | number;
  index: number;
  start: number;
  size: number;
}

/**
 * Service for managing virtualized list operations
 */
export class VirtualizedListService {
  /**
   * Get default configuration for virtualized lists
   */
  static getDefaultConfig(): VirtualizedListConfig {
    return {
      itemHeight: 60,
      overscan: 5,
      scrollToTopThreshold: 300,
      estimatedItemSize: 60,
      minimumBatchSize: 10,
      loadMoreThreshold: 5
    };
  }

  /**
   * Get transaction list specific config
   */
  static getTransactionConfig(): VirtualizedListConfig {
    return {
      ...this.getDefaultConfig(),
      itemHeight: 80,
      overscan: 10
    };
  }

  /**
   * Get dropdown specific config
   */
  static getDropdownConfig(): VirtualizedListConfig {
    return {
      ...this.getDefaultConfig(),
      itemHeight: 40,
      overscan: 3
    };
  }

  /**
   * Check if an item is loaded
   */
  static isItemLoaded<T>(index: number, items: T[], hasMore: boolean): boolean {
    return !hasMore || index < items.length;
  }

  /**
   * Get total item count including potential loading indicator
   */
  static getItemCount<T>(items: T[], hasMore: boolean): number {
    return hasMore ? items.length + 1 : items.length;
  }

  /**
   * Check if list is empty
   */
  static isListEmpty<T>(items: T[], loading: boolean): boolean {
    return items.length === 0 && !loading;
  }

  /**
   * Check if should show scroll to top button
   */
  static shouldShowScrollTop(scrollTop: number, threshold: number): boolean {
    return scrollTop > threshold;
  }

  /**
   * Check if should show loading overlay
   */
  static shouldShowLoadingOverlay<T>(items: T[], loading: boolean): boolean {
    return items.length > 0 && loading;
  }

  /**
   * Get list dimensions for virtual sizing
   */
  static getListDimensions(totalSize: number, horizontal: boolean): React.CSSProperties {
    return horizontal
      ? { width: `${totalSize}px`, height: '100%' }
      : { height: `${totalSize}px`, width: '100%' };
  }

  /**
   * Get item transform for positioning
   */
  static getItemTransform(start: number, horizontal: boolean): React.CSSProperties {
    return {
      position: 'absolute',
      [horizontal ? 'left' : 'top']: `${start}px`,
      ...(horizontal ? { top: 0 } : { left: 0 })
    };
  }

  /**
   * Handle transaction selection
   */
  static handleTransactionSelection(
    transactionId: string,
    selectedIds: string[],
    selected: boolean
  ): string[] {
    if (selected) {
      return [...selectedIds, transactionId];
    }
    return selectedIds.filter(id => id !== transactionId);
  }

  /**
   * Format transaction amount for display
   */
  static formatTransactionAmount(amount: number): { text: string; className: string } {
    const isExpense = amount < 0;
    return {
      text: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(Math.abs(amount)),
      className: isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
    };
  }

  /**
   * Filter items based on search
   */
  static filterItems<T>(
    items: T[],
    search: string,
    getSearchableText: (item: T) => string
  ): T[] {
    if (!search.trim()) {
      return items;
    }
    
    const searchLower = search.toLowerCase();
    return items.filter(item => {
      const text = getSearchableText(item);
      return text.toLowerCase().includes(searchLower);
    });
  }

  /**
   * Calculate visible range for virtualization
   */
  static calculateVisibleRange(
    scrollTop: number,
    containerHeight: number,
    itemHeight: number | ((index: number) => number),
    itemCount: number,
    overscan: number
  ): { startIndex: number; endIndex: number } {
    if (typeof itemHeight === 'number') {
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endIndex = Math.min(
        itemCount - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
      );
      return { startIndex, endIndex };
    }
    
    // Variable height calculation would be more complex
    // For now, return conservative estimates
    return { startIndex: 0, endIndex: Math.min(50, itemCount - 1) };
  }

  /**
   * Get row props for rendering
   */
  static getRowProps(index: number, style: React.CSSProperties, data: any): any {
    return {
      index,
      style,
      data
    };
  }

  /**
   * Determine if should use fixed or variable size list
   */
  static shouldUseFixedSizeList(itemHeight: number | ((index: number) => number)): boolean {
    return typeof itemHeight === 'number';
  }

  /**
   * Get default empty state message
   */
  static getEmptyStateMessage(type: 'default' | 'transaction' | 'search'): string {
    switch (type) {
      case 'transaction':
        return 'No transactions found';
      case 'search':
        return 'No results found';
      default:
        return 'No items to display';
    }
  }
}