/**
 * useDebounce Hook Tests
 * Tests for the debounce hook used in search and performance optimization
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useRealTimers(); // Reset timers first
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    
    expect(result.current).toBe('initial');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'changed', delay: 500 });
    
    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 250ms (less than delay)
    act(() => {
      vi.advanceTimersByTime(250);
    });
    
    // Still should not have changed
    expect(result.current).toBe('initial');

    // Fast-forward remaining time
    act(() => {
      vi.advanceTimersByTime(250);
    });
    
    // Now should be updated
    expect(result.current).toBe('changed');
  });

  it('resets timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    );

    // First change
    rerender({ value: 'change1', delay: 500 });
    
    // Advance time partially
    act(() => {
      vi.advanceTimersByTime(250);
    });
    
    // Second change before first one completes
    rerender({ value: 'change2', delay: 500 });
    
    // Advance time by original remaining time
    act(() => {
      vi.advanceTimersByTime(250);
    });
    
    // Should still be initial because timer was reset
    expect(result.current).toBe('initial');
    
    // Advance by full delay from second change
    act(() => {
      vi.advanceTimersByTime(250);
    });
    
    // Now should be the latest change
    expect(result.current).toBe('change2');
  });

  it('handles different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 1000 }
      }
    );

    rerender({ value: 'changed', delay: 1000 });
    
    // Should not change after 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('initial');
    
    // Should change after full 1000ms
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('changed');
  });

  it('handles zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 0 }
      }
    );

    rerender({ value: 'changed', delay: 0 });
    
    // With zero delay, should update immediately on next tick
    act(() => {
      vi.advanceTimersByTime(0);
    });
    
    expect(result.current).toBe('changed');
  });

  it('works with different data types', () => {
    // Test with numbers
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 0, delay: 100 }
      }
    );

    numberRerender({ value: 42, delay: 100 });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(numberResult.current).toBe(42);

    // Test with objects
    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: { id: 1 }, delay: 100 }
      }
    );

    const newObject = { id: 2, name: 'test' };
    objectRerender({ value: newObject, delay: 100 });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(objectResult.current).toEqual(newObject);
  });

  it('cleans up timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    );

    rerender({ value: 'changed', delay: 500 });
    
    // Unmount before timeout completes
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    clearTimeoutSpy.mockRestore();
  });

  it('handles rapid successive changes correctly', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 }
      }
    );

    const values = ['change1', 'change2', 'change3', 'change4', 'final'];
    
    // Make rapid changes
    values.forEach((value, index) => {
      rerender({ value, delay: 300 });
      
      // Advance time slightly between changes
      act(() => {
        vi.advanceTimersByTime(50);
      });
    });
    
    // Should still be initial
    expect(result.current).toBe('initial');
    
    // Complete the debounce period
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    // Should have the final value
    expect(result.current).toBe('final');
  });

  it('works correctly with search scenarios', () => {
    // Simulate a search input scenario
    const { result, rerender } = renderHook(
      ({ searchTerm }) => useDebounce(searchTerm, 300),
      {
        initialProps: { searchTerm: '' }
      }
    );

    // User starts typing
    rerender({ searchTerm: 't' });
    rerender({ searchTerm: 'te' });
    rerender({ searchTerm: 'tes' });
    rerender({ searchTerm: 'test' });
    
    // Advance time between keystrokes
    act(() => {
      vi.advanceTimersByTime(50);
    });
    
    // Add more characters
    rerender({ searchTerm: 'test ' });
    rerender({ searchTerm: 'test s' });
    rerender({ searchTerm: 'test se' });
    rerender({ searchTerm: 'test search' });
    
    // Should still be empty (original value)
    expect(result.current).toBe('');
    
    // Complete debounce period
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    // Should have final search term
    expect(result.current).toBe('test search');
  });

  it('handles changing delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 }
      }
    );

    // Change value and delay
    rerender({ value: 'changed', delay: 1000 });
    
    // Advance by original delay
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    // Should not have changed yet (new delay is longer)
    expect(result.current).toBe('initial');
    
    // Advance by remaining time
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    // Now should be updated
    expect(result.current).toBe('changed');
  });

  it('maintains reference equality for unchanged values', () => {
    const initialObject = { id: 1, name: 'test' };
    
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialObject, delay: 300 }
      }
    );

    // Reference should be maintained
    expect(result.current).toBe(initialObject);
    
    // Change to different object
    const newObject = { id: 2, name: 'updated' };
    rerender({ value: newObject, delay: 300 });
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    // Should now reference new object
    expect(result.current).toBe(newObject);
    expect(result.current).not.toBe(initialObject);
  });
});