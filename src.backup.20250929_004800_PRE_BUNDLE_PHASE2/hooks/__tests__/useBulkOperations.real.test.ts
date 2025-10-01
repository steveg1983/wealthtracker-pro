/**
 * useBulkOperations REAL Tests
 * Tests bulk operations with real data structures
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkOperations } from '../useBulkOperations';

describe('useBulkOperations - REAL Tests', () => {
  it('handles bulk operations correctly', () => {
    const { result } = renderHook(() => useBulkOperations());
    
    // Test with real data arrays
    const testItems = [
      { id: '1', name: 'Item 1', value: 100 },
      { id: '2', name: 'Item 2', value: 200 },
      { id: '3', name: 'Item 3', value: 300 },
    ];
    
    act(() => {
      result.current.selectItems(testItems);
    });
    
    expect(result.current.selectedItems).toHaveLength(3);
    expect(result.current.selectedItems[0].id).toBe('1');
    
    // Test bulk delete
    act(() => {
      result.current.deleteSelected();
    });
    
    expect(result.current.selectedItems).toHaveLength(0);
  });
});