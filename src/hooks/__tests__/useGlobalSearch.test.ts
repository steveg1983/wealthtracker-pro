/**
 * useGlobalSearch Tests
 * Tests for the useGlobalSearch hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGlobalSearch } from '../useGlobalSearch';
import { AllProviders } from '../../test/testUtils';

describe('useGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state correctly', () => {
      const { result } = renderHook(() => useGlobalSearch(), {
        wrapper: AllProviders
      });

      expect(result.current).toMatchObject({
        // Add expected initial state
        data: null,
        loading: false,
        error: null
      });
    });

    it('loads data on mount when autoLoad is true', async () => {
      const { result } = renderHook(() => useGlobalSearch({ autoLoad: true }), {
        wrapper: AllProviders
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.data).toBeDefined();
      });
    });
  });

  describe('actions', () => {
    it('performs search correctly', async () => {
      const { result } = renderHook(() => useGlobalSearch(), {
        wrapper: AllProviders
      });

      act(() => {
        result.current.search('test query');
      });

      await waitFor(() => {
        expect(result.current.results).toHaveLength(3);
        expect(result.current.results[0]).toMatchObject({
          title: expect.stringContaining('test')
        });
      });
    });

    it('handles errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('API Error'));
      
      const { result } = renderHook(() => useGlobalSearch({ fetcher: mockFetch }), {
        wrapper: AllProviders
      });

      act(() => {
        result.current.load();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('API Error');
        expect(result.current.loading).toBe(false);
      });
    });

    it('cancels pending requests on unmount', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      
      const { result, unmount } = renderHook(() => useGlobalSearch(), {
        wrapper: AllProviders
      });

      act(() => {
        result.current.load();
      });

      unmount();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('memoization', () => {
    it('memoizes expensive calculations', () => {
      const expensiveCalculation = vi.fn();
      
      const { result, rerender } = renderHook(
        ({ value }) => useGlobalSearch({ value, calculate: expensiveCalculation }),
        {
          wrapper: AllProviders,
          initialProps: { value: 10 }
        }
      );

      expect(expensiveCalculation).toHaveBeenCalledTimes(1);

      // Same props, should not recalculate
      rerender({ value: 10 });
      expect(expensiveCalculation).toHaveBeenCalledTimes(1);

      // Different props, should recalculate
      rerender({ value: 20 });
      expect(expensiveCalculation).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('handles rapid updates correctly', async () => {
      const { result } = renderHook(() => useGlobalSearch(), {
        wrapper: AllProviders
      });

      // Rapid fire multiple updates
      act(() => {
        result.current.update('value1');
        result.current.update('value2');
        result.current.update('value3');
      });

      await waitFor(() => {
        // Should only process the latest update
        expect(result.current.value).toBe('value3');
      });
    });

    it('handles concurrent operations', async () => {
      const { result } = renderHook(() => useGlobalSearch(), {
        wrapper: AllProviders
      });

      // Start multiple operations
      const promises = [
        act(() => result.current.operation1()),
        act(() => result.current.operation2()),
        act(() => result.current.operation3())
      ];

      await Promise.all(promises);

      // All operations should complete successfully
      expect(result.current.status).toBe('completed');
    });
  });
});