/**
 * Batch Operations Toolbar Service
 * Manages batch operations logic and filtering
 */

import type { BatchOperation } from '../hooks/useBatchOperations';
import type { Transaction } from '../types';

export interface SelectionStats {
  count: number;
  totalAmount: number;
  income: number;
  expenses: number;
}

class BatchOperationsToolbarService {
  /**
   * Common tags for tagging operations
   */
  getCommonTags(): string[] {
    return ['Recurring', 'Business', 'Personal', 'Tax Deductible', 'Review Later'];
  }

  /**
   * Filter operations into primary and secondary groups
   */
  categorizeOperations(operations: BatchOperation[]) {
    const primaryIds = ['categorize', 'tag', 'clear', 'delete'];
    
    const primary = operations.filter(op => 
      primaryIds.includes(op.id)
    );
    
    const secondary = operations.filter(op => 
      !primaryIds.includes(op.id)
    );
    
    return { primary, secondary };
  }

  /**
   * Get icon for operation by ID
   */
  getOperationIcon(operationId: string) {
    const iconMap: Record<string, string> = {
      'categorize': 'FolderIcon',
      'tag': 'TagIcon',
      'clear': 'CheckCircleIcon',
      'delete': 'TrashIcon',
      'export': 'DownloadIcon',
      'reconcile': 'CheckSquareIcon',
      'duplicate': 'CopyIcon'
    };
    
    return iconMap[operationId] || 'MoreVerticalIcon';
  }

  /**
   * Handle operation confirmation
   */
  async confirmOperation(
    operation: BatchOperation,
    selectedCount: number
  ): Promise<boolean> {
    if (!operation.requiresConfirmation || !operation.confirmMessage) {
      return true;
    }
    
    const message = operation.confirmMessage(selectedCount);
    return window.confirm(message);
  }

  /**
   * Format selection stats for display
   */
  formatSelectionStats(stats: SelectionStats) {
    return {
      total: Math.abs(stats.totalAmount),
      hasIncome: stats.income > 0,
      hasExpenses: stats.expenses > 0,
      income: stats.income,
      expenses: stats.expenses
    };
  }

  /**
   * Validate tag input
   */
  validateTag(tag: string, existingTags: string[]): boolean {
    const trimmed = tag.trim();
    return trimmed.length > 0 && !existingTags.includes(trimmed);
  }

  /**
   * Get selection state classes
   */
  getSelectionStateClasses(isAllSelected: boolean, isPartiallySelected: boolean) {
    if (isAllSelected) {
      return 'text-gray-600';
    }
    if (isPartiallySelected) {
      return 'text-gray-500';
    }
    return 'text-gray-400';
  }

  /**
   * Get toolbar visibility
   */
  shouldShowToolbar(selectedCount: number): boolean {
    return selectedCount > 0;
  }

  /**
   * Process batch operation
   */
  async processBatchOperation(
    operation: BatchOperation,
    selectedTransactions: Transaction[],
    onComplete?: () => void
  ): Promise<void> {
    try {
      await operation.action(selectedTransactions);
      onComplete?.();
    } catch (error) {
      console.error('Batch operation failed:', error);
      throw error;
    }
  }

  /**
   * Group operations by type
   */
  groupOperations(operations: BatchOperation[]): Map<string, BatchOperation[]> {
    const grouped = new Map<string, BatchOperation[]>();
    operations.forEach(op => {
      const group = op.group || 'other';
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group)!.push(op);
    });
    return grouped;
  }

  /**
   * Get selection icon styles based on count
   */
  getSelectionIconStyles(selectedCount: number): string {
    if (selectedCount === 0) return 'text-gray-400';
    if (selectedCount < 5) return 'text-blue-500';
    if (selectedCount < 10) return 'text-green-500';
    return 'text-purple-500';
  }

  /**
   * Get selection tooltip text
   */
  getSelectionTooltip(selectedCount: number, totalCount: number): string {
    if (selectedCount === 0) return 'No items selected';
    if (selectedCount === totalCount) return 'All items selected';
    return `${selectedCount} of ${totalCount} items selected`;
  }

  /**
   * Get toolbar styles based on state
   */
  getToolbarStyles(isVisible: boolean, selectedCount: number): string {
    const baseStyles = 'transition-all duration-200 ease-in-out';
    const visibilityStyles = isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4';
    const colorStyles = selectedCount > 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800';
    return `${baseStyles} ${visibilityStyles} ${colorStyles}`;
  }

  /**
   * Check if tag is valid
   */
  isValidTag(tag: string, existingTags: string[]): boolean {
    return this.validateTag(tag, existingTags);
  }

  /**
   * Process selected tags for operations
   */
  processSelectedTags(selectedTags: string[], newTag?: string): string[] {
    const tags = [...selectedTags];
    if (newTag && newTag.trim() && !tags.includes(newTag.trim())) {
      tags.push(newTag.trim());
    }
    return tags;
  }
}

export const batchOperationsToolbarService = new BatchOperationsToolbarService();