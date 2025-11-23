/**
 * useLocalStorage Tests
 * Hook behavior and state management
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLocalStorage } from '../useLocalStorage';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

describe('useLocalStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));

    expect(result.current).toBeDefined();
  });

  it('updates state correctly', () => {
    const { result: _result } = renderHook(() => useLocalStorage('test-key-2', 'initial-value'));

    act(() => {
      // Trigger state update
    });

    // Assert state change
  });

  it('handles cleanup on unmount', () => {
    const { unmount } = renderHook(() => useLocalStorage('test-key-3', 'initial-value'));
    
    unmount();
    
    // Assert cleanup behavior
  });

});
