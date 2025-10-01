/**
 * useLocalStorage REAL Tests
 * Tests local storage operations
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage - REAL Tests', () => {
  it('persists data to real localStorage', () => {
    const { result } = renderHook(() => 
      useLocalStorage('test-key', 'initial-value')
    );
    
    expect(result.current[0]).toBe('initial-value');
    
    // Update value
    act(() => {
      result.current[1]('updated-value');
    });
    
    expect(result.current[0]).toBe('updated-value');
    
    // Verify it's in localStorage
    expect(localStorage.getItem('test-key')).toBe('"updated-value"');
    
    // Clean up
    localStorage.removeItem('test-key');
  });
});