/**
 * useKeyboardShortcuts REAL Tests
 * Tests keyboard shortcut handling
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts - REAL Tests', () => {
  it('registers and handles keyboard shortcuts', () => {
    const mockCallback = vi.fn();
    
    const { result } = renderHook(() => useKeyboardShortcuts());
    
    // Register a shortcut
    act(() => {
      result.current.registerShortcut('ctrl+s', mockCallback);
    });
    
    // Simulate keyboard event
    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
    });
    
    act(() => {
      document.dispatchEvent(event);
    });
    
    expect(mockCallback).toHaveBeenCalled();
  });
});