/**
 * useBulkOperations REAL Tests
 * Tests bulk operations with real data structures
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkOperations } from '../useBulkOperations';

describe('useBulkOperations - REAL Tests', () => {
  it('handles bulk operations correctly', async () => {
    const testItems = [
      { id: '1', name: 'Item 1', value: 100 },
      { id: '2', name: 'Item 2', value: 200 },
      { id: '3', name: 'Item 3', value: 300 },
    ];

    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    const archiveSpy = vi.fn().mockResolvedValue(undefined);

    const operations = [
      {
        id: 'delete',
        label: 'Delete',
        action: deleteSpy,
        destructive: true,
      },
      {
        id: 'archive',
        label: 'Archive',
        action: archiveSpy,
      },
    ];

    const { result } = renderHook(({ items, ops }) => useBulkOperations(items, ops), {
      initialProps: {
        items: testItems,
        ops: operations,
      },
    });

    // Select all items
    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectedItems instanceof Set).toBe(true);
    expect(result.current.selectedItems.size).toBe(3);
    expect(result.current.allSelected).toBe(true);
    expect(result.current.someSelected).toBe(false);

    // Deselect one item
    act(() => {
      result.current.toggleItem('2');
    });

    expect(result.current.selectedItems.size).toBe(2);
    expect(result.current.allSelected).toBe(false);
    expect(result.current.someSelected).toBe(true);
    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.isSelected('2')).toBe(false);

    // Execute archive operation on selected items
    await act(async () => {
      await result.current.executeOperation('archive');
    });

    expect(archiveSpy).toHaveBeenCalledTimes(1);
    expect(archiveSpy).toHaveBeenCalledWith([
      testItems[0],
      testItems[2],
    ]);
    expect(result.current.selectedItems.size).toBe(0);
    expect(result.current.someSelected).toBe(false);

    // Select item manually and execute delete operation
    act(() => {
      result.current.selectItem('1');
    });
    expect(result.current.selectedItems.size).toBe(1);
    expect(result.current.someSelected).toBe(true);

    await act(async () => {
      await result.current.executeOperation('delete');
    });

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith([testItems[0]]);
    expect(result.current.selectedItems.size).toBe(0);
  });
});
