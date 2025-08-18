import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkOperations, type BulkOperation } from '../useBulkOperations';

interface TestItem {
  id: string;
  name: string;
  value: number;
}

describe('useBulkOperations', () => {
  let mockItems: TestItem[];
  let mockOperations: BulkOperation<TestItem>[];
  let mockDeleteOperation: vi.Mock;
  let mockUpdateOperation: vi.Mock;

  beforeEach(() => {
    mockItems = [
      { id: '1', name: 'Item 1', value: 100 },
      { id: '2', name: 'Item 2', value: 200 },
      { id: '3', name: 'Item 3', value: 300 },
    ];

    mockDeleteOperation = vi.fn().mockResolvedValue(undefined);
    mockUpdateOperation = vi.fn().mockResolvedValue(undefined);

    mockOperations = [
      {
        id: 'delete',
        label: 'Delete Items',
        action: mockDeleteOperation,
        requiresConfirmation: true,
        confirmationMessage: 'Are you sure you want to delete these items?',
        destructive: true
      },
      {
        id: 'update',
        label: 'Update Items',
        action: mockUpdateOperation,
        requiresConfirmation: false
      }
    ];

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state correctly', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      expect(result.current.selectedItems).toBeInstanceOf(Set);
      expect(result.current.selectedItems.size).toBe(0);
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.allSelected).toBe(false);
      expect(result.current.someSelected).toBe(false);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.availableOperations).toBe(mockOperations);
    });

    it('provides all required functions', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      expect(typeof result.current.selectItem).toBe('function');
      expect(typeof result.current.deselectItem).toBe('function');
      expect(typeof result.current.toggleItem).toBe('function');
      expect(typeof result.current.selectAll).toBe('function');
      expect(typeof result.current.deselectAll).toBe('function');
      expect(typeof result.current.toggleAll).toBe('function');
      expect(typeof result.current.executeOperation).toBe('function');
      expect(typeof result.current.isSelected).toBe('function');
    });
  });

  describe('item selection', () => {
    it('selects single item correctly', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      act(() => {
        result.current.selectItem('1');
      });

      expect(result.current.selectedItems.has('1')).toBe(true);
      expect(result.current.selectedCount).toBe(1);
      expect(result.current.isSelected('1')).toBe(true);
      expect(result.current.isSelected('2')).toBe(false);
      expect(result.current.someSelected).toBe(true);
      expect(result.current.allSelected).toBe(false);
    });

    it('selects multiple items correctly', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      act(() => {
        result.current.selectItem('1');
        result.current.selectItem('2');
      });

      expect(result.current.selectedItems.has('1')).toBe(true);
      expect(result.current.selectedItems.has('2')).toBe(true);
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.someSelected).toBe(true);
      expect(result.current.allSelected).toBe(false);
    });

    it('deselects item correctly', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      act(() => {
        result.current.selectItem('1');
        result.current.selectItem('2');
      });

      act(() => {
        result.current.deselectItem('1');
      });

      expect(result.current.selectedItems.has('1')).toBe(false);
      expect(result.current.selectedItems.has('2')).toBe(true);
      expect(result.current.selectedCount).toBe(1);
    });

    it('toggles item selection correctly', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      // Toggle to select
      act(() => {
        result.current.toggleItem('1');
      });

      expect(result.current.isSelected('1')).toBe(true);

      // Toggle to deselect
      act(() => {
        result.current.toggleItem('1');
      });

      expect(result.current.isSelected('1')).toBe(false);
    });

    it('selects all items correctly', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selectedCount).toBe(3);
      expect(result.current.allSelected).toBe(true);
      expect(result.current.someSelected).toBe(false);
      mockItems.forEach(item => {
        expect(result.current.isSelected(item.id)).toBe(true);
      });
    });

    it('deselects all items correctly', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      // First select all
      act(() => {
        result.current.selectAll();
      });

      // Then deselect all
      act(() => {
        result.current.deselectAll();
      });

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.allSelected).toBe(false);
      expect(result.current.someSelected).toBe(false);
    });

    it('toggles all items correctly', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      // Initially none selected, toggleAll should select all
      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.allSelected).toBe(true);

      // All selected, toggleAll should deselect all
      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.selectedCount).toBe(0);
    });

    it('handles toggle all with partial selection', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      // Select one item
      act(() => {
        result.current.selectItem('1');
      });

      expect(result.current.someSelected).toBe(true);

      // Toggle all should select all remaining
      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.allSelected).toBe(true);
    });
  });

  describe('operation execution', () => {
    it('executes operation with selected items', async () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      act(() => {
        result.current.selectItem('1');
        result.current.selectItem('2');
      });

      await act(async () => {
        await result.current.executeOperation('delete');
      });

      expect(mockDeleteOperation).toHaveBeenCalledWith([
        { id: '1', name: 'Item 1', value: 100 },
        { id: '2', name: 'Item 2', value: 200 }
      ]);
    });

    it('clears selection after successful operation', async () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      act(() => {
        result.current.selectItem('1');
      });

      await act(async () => {
        await result.current.executeOperation('delete');
      });

      expect(result.current.selectedCount).toBe(0);
    });

    it('sets processing state during operation', async () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      let resolveOperation: () => void;
      const slowOperation = new Promise<void>(resolve => {
        resolveOperation = resolve;
      });
      mockDeleteOperation.mockImplementation(() => slowOperation);

      act(() => {
        result.current.selectItem('1');
      });

      // Start the operation without awaiting
      let operationPromise: Promise<void>;
      act(() => {
        operationPromise = result.current.executeOperation('delete');
      });

      // Should be processing
      expect(result.current.isProcessing).toBe(true);

      // Resolve the operation
      resolveOperation!();
      await act(async () => {
        await operationPromise!;
      });

      // Should no longer be processing
      expect(result.current.isProcessing).toBe(false);
    });

    it('handles operation errors correctly', async () => {
      const error = new Error('Operation failed');
      mockDeleteOperation.mockRejectedValue(error);

      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      act(() => {
        result.current.selectItem('1');
      });

      await expect(act(async () => {
        await result.current.executeOperation('delete');
      })).rejects.toThrow('Operation failed');

      expect(result.current.isProcessing).toBe(false);
      // Selection should remain after error
      expect(result.current.selectedCount).toBe(1);
    });

    it('does nothing when operation not found', async () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      act(() => {
        result.current.selectItem('1');
      });

      await act(async () => {
        await result.current.executeOperation('nonexistent');
      });

      expect(mockDeleteOperation).not.toHaveBeenCalled();
      expect(mockUpdateOperation).not.toHaveBeenCalled();
    });

    it('does nothing when no items selected', async () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      await act(async () => {
        await result.current.executeOperation('delete');
      });

      expect(mockDeleteOperation).not.toHaveBeenCalled();
    });
  });

  describe('state consistency', () => {
    it('handles empty items array', () => {
      const { result } = renderHook(() => 
        useBulkOperations([], mockOperations)
      );

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.allSelected).toBe(false);
      expect(result.current.someSelected).toBe(false);

      // Should handle selectAll gracefully
      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selectedCount).toBe(0);
    });

    it('maintains consistency when items change', () => {
      const { result, rerender } = renderHook(
        ({ items }) => useBulkOperations(items, mockOperations),
        { initialProps: { items: mockItems } }
      );

      act(() => {
        result.current.selectItem('1');
        result.current.selectItem('2');
      });

      expect(result.current.selectedCount).toBe(2);

      // Remove one of the selected items
      const newItems = mockItems.filter(item => item.id !== '1');
      rerender({ items: newItems });

      // Check that selectAll works with new items
      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selectedCount).toBe(2); // Only remaining items
      expect(result.current.allSelected).toBe(true);
    });

    it('handles items with duplicate ids gracefully', () => {
      const duplicateItems = [
        { id: '1', name: 'Item 1a', value: 100 },
        { id: '1', name: 'Item 1b', value: 150 },
        { id: '2', name: 'Item 2', value: 200 },
      ];

      const { result } = renderHook(() => 
        useBulkOperations(duplicateItems, mockOperations)
      );

      act(() => {
        result.current.selectItem('1');
      });

      expect(result.current.selectedCount).toBe(1);
      expect(result.current.isSelected('1')).toBe(true);
    });
  });

  describe('memoization and performance', () => {
    it('functions are stable across re-renders', () => {
      const { result, rerender } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      const initialFunctions = {
        selectItem: result.current.selectItem,
        deselectItem: result.current.deselectItem,
        toggleItem: result.current.toggleItem,
        executeOperation: result.current.executeOperation,
        isSelected: result.current.isSelected,
      };

      rerender();

      expect(result.current.selectItem).toBe(initialFunctions.selectItem);
      expect(result.current.deselectItem).toBe(initialFunctions.deselectItem);
      expect(result.current.toggleItem).toBe(initialFunctions.toggleItem);
      expect(result.current.executeOperation).toBe(initialFunctions.executeOperation);
      expect(result.current.isSelected).toBe(initialFunctions.isSelected);
    });

    it('selectAll and deselectAll update when items change', () => {
      const { result, rerender } = renderHook(
        ({ items }) => useBulkOperations(items, mockOperations),
        { initialProps: { items: mockItems } }
      );

      const initialSelectAll = result.current.selectAll;

      // Change items
      rerender({ items: mockItems.slice(0, 2) });

      expect(result.current.selectAll).not.toBe(initialSelectAll);
    });

    it('handles large item sets efficiently', () => {
      const largeItemSet = Array(1000).fill(null).map((_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        value: i
      }));

      const { result } = renderHook(() => 
        useBulkOperations(largeItemSet, mockOperations)
      );

      const startTime = performance.now();

      act(() => {
        result.current.selectAll();
      });

      const endTime = performance.now();

      expect(result.current.selectedCount).toBe(1000);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast
    });
  });

  describe('edge cases', () => {
    it('handles operations with empty operations array', async () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, [])
      );

      expect(result.current.availableOperations).toEqual([]);

      act(() => {
        result.current.selectItem('1');
      });

      // Should not throw when executing non-existent operation
      await act(async () => {
        await result.current.executeOperation('delete');
      });
    });

    it('handles synchronous operations', async () => {
      const syncOperation: BulkOperation<TestItem> = {
        id: 'sync',
        label: 'Sync Operation',
        action: vi.fn() // Synchronous function
      };

      const { result } = renderHook(() => 
        useBulkOperations(mockItems, [syncOperation])
      );

      act(() => {
        result.current.selectItem('1');
      });

      await act(async () => {
        await result.current.executeOperation('sync');
      });

      expect(syncOperation.action).toHaveBeenCalled();
      expect(result.current.selectedCount).toBe(0); // Should clear selection
    });

    it('preserves selection state immutably', () => {
      const { result } = renderHook(() => 
        useBulkOperations(mockItems, mockOperations)
      );

      act(() => {
        result.current.selectItem('1');
      });

      const firstSelectedItems = result.current.selectedItems;

      act(() => {
        result.current.selectItem('2');
      });

      const secondSelectedItems = result.current.selectedItems;

      // Should be different Set instances
      expect(firstSelectedItems).not.toBe(secondSelectedItems);
      expect(firstSelectedItems.has('1')).toBe(true);
      expect(firstSelectedItems.has('2')).toBe(false);
      expect(secondSelectedItems.has('1')).toBe(true);
      expect(secondSelectedItems.has('2')).toBe(true);
    });
  });
});