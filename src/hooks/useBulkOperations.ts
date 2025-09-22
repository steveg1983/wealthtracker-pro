import { useState, useCallback } from 'react';
import type { IconProps } from '../components/icons';
import { lazyLogger as logger } from '../services/serviceFactory';

export interface BulkOperation<T> {
  id: string;
  label: string;
  icon?: React.ComponentType<IconProps>;
  action: (items: T[]) => Promise<void> | void;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  destructive?: boolean;
}

export function useBulkOperations<T extends { id: string }>(
  items: T[],
  operations: BulkOperation<T>[]
) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const selectItem = useCallback((id: string) => {
    setSelectedItems(prev => new Set(prev).add(id));
  }, []);

  const deselectItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const toggleItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItems(new Set(items.map(item => item.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedItems.size === items.length) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [selectedItems.size, items.length, selectAll, deselectAll]);

  const executeOperation = useCallback(async (operationId: string) => {
    const operation = operations.find(op => op.id === operationId);
    if (!operation) return;

    const selectedObjects = items.filter(item => selectedItems.has(item.id));
    if (selectedObjects.length === 0) return;

    setIsProcessing(true);
    try {
      await operation.action(selectedObjects);
      setSelectedItems(new Set()); // Clear selection after successful operation
    } catch (error) {
      logger.error('Bulk operation failed:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [operations, items, selectedItems]);

  const isSelected = useCallback((id: string) => selectedItems.has(id), [selectedItems]);

  const selectedCount = selectedItems.size;
  const allSelected = selectedCount === items.length && items.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < items.length;

  return {
    selectedItems,
    selectedCount,
    allSelected,
    someSelected,
    isProcessing,
    selectItem,
    deselectItem,
    toggleItem,
    selectAll,
    deselectAll,
    toggleAll,
    executeOperation,
    isSelected,
    availableOperations: operations,
  };
}