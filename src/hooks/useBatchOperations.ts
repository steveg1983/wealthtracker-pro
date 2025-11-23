import { useState, useCallback, useMemo } from 'react';
import type { Transaction } from '../types';
import { useMemoizedLogger } from '../loggers/useMemoizedLogger';

export interface BatchOperation {
  id: string;
  label: string;
  icon?: React.ComponentType<Record<string, unknown>>;
  action: (transactions: Transaction[]) => Promise<void> | void;
  requiresConfirmation?: boolean;
  confirmMessage?: (count: number) => string;
  variant?: 'primary' | 'danger' | 'secondary';
}

interface UseBatchOperationsProps {
  transactions: Transaction[];
  onUpdate: (id: string, updates: Partial<Transaction>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport?: (transactions: Transaction[]) => void;
}

export function useBatchOperations({
  transactions,
  onUpdate,
  onDelete,
  onExport
}: UseBatchOperationsProps) {
  const logger = useMemoizedLogger('useBatchOperations');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOperation, setLastOperation] = useState<string | null>(null);

  // Get selected transactions
  const selectedTransactions = useMemo(
    () => transactions.filter(t => selectedIds.has(t.id)),
    [transactions, selectedIds]
  );

  // Toggle single selection
  const toggleSelection = useCallback((transactionId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  }, []);

  // Select all visible transactions
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(transactions.map(t => t.id)));
  }, [transactions]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Select by criteria
  const selectByCriteria = useCallback((
    predicate: (transaction: Transaction) => boolean
  ) => {
    const matching = transactions.filter(predicate);
    setSelectedIds(new Set(matching.map(t => t.id)));
  }, [transactions]);

  // Invert selection
  const invertSelection = useCallback(() => {
    const newSet = new Set<string>();
    transactions.forEach(t => {
      if (!selectedIds.has(t.id)) {
        newSet.add(t.id);
      }
    });
    setSelectedIds(newSet);
  }, [transactions, selectedIds]);

  // Batch update
  const batchUpdate = useCallback(async (
    updates: Partial<Transaction>,
    options?: { skipConfirmation?: boolean }
  ) => {
    if (selectedTransactions.length === 0) return;

    if (!options?.skipConfirmation) {
      const confirmed = confirm(
        `Update ${selectedTransactions.length} transaction${selectedTransactions.length !== 1 ? 's' : ''}?`
      );
      if (!confirmed) return;
    }

    setIsProcessing(true);
    setLastOperation('update');

    try {
      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < selectedTransactions.length; i += batchSize) {
        const batch = selectedTransactions.slice(i, i + batchSize);
        await Promise.all(
          batch.map(transaction => onUpdate(transaction.id, updates))
        );
      }

      // Clear selection after successful update
      clearSelection();
    } catch (error) {
      logger.error?.('Batch update failed', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedTransactions, onUpdate, clearSelection, logger]);

  // Batch delete
  const batchDelete = useCallback(async (options?: { skipConfirmation?: boolean }) => {
    if (selectedTransactions.length === 0) return;

    if (!options?.skipConfirmation) {
      const confirmed = confirm(
        `Delete ${selectedTransactions.length} transaction${selectedTransactions.length !== 1 ? 's' : ''}? This cannot be undone.`
      );
      if (!confirmed) return;
    }

    setIsProcessing(true);
    setLastOperation('delete');

    try {
      // Process in batches
      const batchSize = 10;
      for (let i = 0; i < selectedTransactions.length; i += batchSize) {
        const batch = selectedTransactions.slice(i, i + batchSize);
        await Promise.all(
          batch.map(transaction => onDelete(transaction.id))
        );
      }

      // Clear selection after successful delete
      clearSelection();
    } catch (error) {
      logger.error?.('Batch delete failed', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedTransactions, onDelete, clearSelection, logger]);

  // Batch categorize
  const batchCategorize = useCallback(async (categoryId: string) => {
    await batchUpdate({ category: categoryId }, { skipConfirmation: true });
  }, [batchUpdate]);

  // Batch tag
  const batchAddTags = useCallback(async (tags: string[]) => {
    setIsProcessing(true);
    setLastOperation('tag');

    try {
      const updates = selectedTransactions.map(async (transaction) => {
        const existingTags = transaction.tags || [];
        const newTags = Array.from(new Set([...existingTags, ...tags]));
        return onUpdate(transaction.id, { tags: newTags });
      });

      await Promise.all(updates);
      clearSelection();
    } catch (error) {
      logger.error?.('Batch tag failed', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedTransactions, onUpdate, clearSelection, logger]);

  // Batch remove tags
  const batchRemoveTags = useCallback(async (tagsToRemove: string[]) => {
    setIsProcessing(true);
    setLastOperation('untag');

    try {
      const updates = selectedTransactions.map(async (transaction) => {
        const existingTags = transaction.tags || [];
        const newTags = existingTags.filter(tag => !tagsToRemove.includes(tag));
        return onUpdate(transaction.id, { tags: newTags });
      });

      await Promise.all(updates);
      clearSelection();
    } catch (error) {
      logger.error?.('Batch untag failed', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedTransactions, onUpdate, clearSelection, logger]);

  // Batch mark as cleared/uncleared
  const batchSetCleared = useCallback(async (cleared: boolean) => {
    await batchUpdate({ cleared }, { skipConfirmation: true });
  }, [batchUpdate]);

  // Batch export
  const batchExport = useCallback(() => {
    if (onExport && selectedTransactions.length > 0) {
      onExport(selectedTransactions);
    }
  }, [selectedTransactions, onExport]);

  // Available operations
  const operations: BatchOperation[] = useMemo(() => [
    {
      id: 'categorize',
      label: 'Categorize',
      action: async () => {
        // Placeholder hook for category picker
        logger.info?.('Open category picker');
      },
      variant: 'primary'
    },
    {
      id: 'tag',
      label: 'Add Tags',
      action: async () => {
        // Placeholder hook for tag picker
        logger.info?.('Open tag picker');
      },
      variant: 'primary'
    },
    {
      id: 'clear',
      label: 'Mark as Cleared',
      action: () => batchSetCleared(true),
      variant: 'secondary'
    },
    {
      id: 'unclear',
      label: 'Mark as Uncleared',
      action: () => batchSetCleared(false),
      variant: 'secondary'
    },
    {
      id: 'export',
      label: 'Export Selected',
      action: batchExport,
      variant: 'secondary'
    },
    {
      id: 'delete',
      label: 'Delete Selected',
      action: () => batchDelete(),
      requiresConfirmation: true,
      confirmMessage: (count) => `Delete ${count} transaction${count !== 1 ? 's' : ''}?`,
      variant: 'danger'
    }
  ], [batchSetCleared, batchExport, batchDelete, logger]);

  // Selection statistics
  const selectionStats = useMemo(() => {
    const selected = selectedTransactions;
    const totalAmount = selected.reduce((sum, t) => 
      sum + (t.type === 'expense' ? -t.amount : t.amount), 0
    );
    const income = selected.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = selected.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return {
      count: selected.length,
      totalAmount,
      income,
      expenses,
      byType: {
        income: selected.filter(t => t.type === 'income').length,
        expense: selected.filter(t => t.type === 'expense').length,
        transfer: selected.filter(t => t.type === 'transfer').length,
      }
    };
  }, [selectedTransactions]);

  return {
    // Selection state
    selectedIds,
    selectedTransactions,
    selectedCount: selectedIds.size,
    isAllSelected: selectedIds.size === transactions.length && transactions.length > 0,
    isPartiallySelected: selectedIds.size > 0 && selectedIds.size < transactions.length,
    
    // Selection actions
    toggleSelection,
    selectAll,
    clearSelection,
    selectByCriteria,
    invertSelection,
    
    // Batch operations
    batchUpdate,
    batchDelete,
    batchCategorize,
    batchAddTags,
    batchRemoveTags,
    batchSetCleared,
    batchExport,
    operations,
    
    // State
    isProcessing,
    lastOperation,
    selectionStats
  };
}
