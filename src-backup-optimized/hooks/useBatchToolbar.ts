/**
 * Custom Hook for Batch Operations Toolbar
 * Manages toolbar state and operations
 */

import { useState, useCallback, useMemo } from 'react';
import { batchOperationsToolbarService } from '../services/batchOperationsToolbarService';
import type { BatchOperation } from './useBatchOperations';

export interface UseBatchToolbarProps {
  selectedCount: number;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  operations: BatchOperation[];
  isProcessing: boolean;
  onCategorySelect?: (categoryId: string) => void;
  onTagsSelect?: (tags: string[]) => void;
}

export interface UseBatchToolbarReturn {
  // State
  showCategoryPicker: boolean;
  showTagPicker: boolean;
  showMoreMenu: boolean;
  
  // Handlers
  setShowCategoryPicker: (show: boolean) => void;
  setShowTagPicker: (show: boolean) => void;
  setShowMoreMenu: (show: boolean) => void;
  handleOperation: (operation: BatchOperation) => Promise<void>;
  
  // Computed
  primaryOperations: BatchOperation[];
  secondaryOperations: BatchOperation[];
  selectionIconStyles: string;
  selectionTooltip: string;
  toolbarStyles: string;
}

export function useBatchToolbar({
  selectedCount,
  isAllSelected,
  isPartiallySelected,
  operations,
  isProcessing,
  onCategorySelect,
  onTagsSelect
}: UseBatchToolbarProps): UseBatchToolbarReturn {
  // Modal states
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  
  // Group operations
  const { primaryOperations, secondaryOperations } = useMemo(() => {
    const grouped = batchOperationsToolbarService.groupOperations(operations);
    return {
      primaryOperations: grouped.get('primary') || [],
      secondaryOperations: grouped.get('secondary') || []
    };
  }, [operations]);
  
  // Handle operation execution
  const handleOperation = useCallback(async (operation: BatchOperation) => {
    // Special handling for category and tag operations
    if (operation.id === 'categorize' && onCategorySelect) {
      setShowCategoryPicker(true);
      return;
    }
    
    if (operation.id === 'tag' && onTagsSelect) {
      setShowTagPicker(true);
      return;
    }
    
    // Check if operation can be performed
    if (isProcessing || selectedCount === 0) {
      return;
    }
    
    // Confirm if needed
    const confirmed = await batchOperationsToolbarService.confirmOperation(operation, selectedCount);
    if (!confirmed) return;
    
    // Execute operation
    await operation.action([]);
  }, [selectedCount, isProcessing, onCategorySelect, onTagsSelect]);
  
  // Get computed styles
  const selectionIconStyles = useMemo(() => 
    batchOperationsToolbarService.getSelectionIconStyles(selectedCount),
    [isAllSelected, isPartiallySelected]
  );
  
  const selectionTooltip = useMemo(() => 
    selectedCount === 0 ? 'No items selected' : `${selectedCount} items selected`,
    [selectedCount]
  );
  
  const toolbarStyles = useMemo(() => 
    batchOperationsToolbarService.getToolbarStyles(selectedCount > 0, selectedCount),
    [selectedCount]
  );
  
  return {
    // State
    showCategoryPicker,
    showTagPicker,
    showMoreMenu,
    
    // Handlers
    setShowCategoryPicker,
    setShowTagPicker,
    setShowMoreMenu,
    handleOperation,
    
    // Computed
    primaryOperations,
    secondaryOperations,
    selectionIconStyles,
    selectionTooltip,
    toolbarStyles
  };
}